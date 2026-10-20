const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, now, getSetting, setSetting, getAllSettings, audit } = require('../db');
const auth = require('../auth');
const { clean, normalizePhone, MARKETS } = require('../validation');
const { processUpload, deleteUpload, isValidImageRef } = require('../images');
const { DEFAULT_SETTINGS } = require('../seed');

const router = express.Router();
router.use(auth.csrfGuard);

const LEAD_STATUSES = {
  new: 'جديد', contact_attempted: 'تمت محاولة التواصل', qualified: 'مؤهل',
  quote_sent: 'تم إرسال عرض سعر', won: 'تم التحويل إلى عميل', disqualified: 'غير مؤهل',
};

// ---------------- المصادقة ----------------
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'محاولات دخول كثيرة. حاول بعد 15 دقيقة.' } });

router.post('/auth/login', loginLimiter, async (req, res) => {
  const r = await auth.login(req.body?.email, req.body?.password);
  if (r.error) return res.status(401).json({ error: r.error });
  auth.createSession(res, r.user.id);
  audit(r.user.id, 'login');
  res.json({ user: { id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.role, permissions: auth.PERMISSIONS[r.user.role] } });
});
router.post('/auth/logout', (req, res) => { auth.destroySession(req, res); res.json({ ok: true }); });
router.get('/auth/me', auth.requireAuth, (req, res) =>
  res.json({ user: { ...req.user, permissions: auth.PERMISSIONS[req.user.role] }, statuses: LEAD_STATUSES, company: (getSetting('company') || {}).name || '' }));
router.post('/auth/password', auth.requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!require('bcryptjs').compareSync(String(current || ''), u.password_hash)) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
  const err = auth.validatePassword(next);
  if (err) return res.status(400).json({ error: err });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(next), req.user.id);
  audit(req.user.id, 'password.change');
  res.json({ ok: true });
});

router.use(auth.requireAuth);

// ---------------- لوحة المؤشرات ----------------
router.get('/dashboard', auth.requirePerm('dashboard'), (req, res) => {
  const out = {
    content: {
      services: db.prepare('SELECT COUNT(*) c FROM services WHERE published = 1').get().c,
      projects: db.prepare('SELECT COUNT(*) c FROM projects WHERE published = 1').get().c,
      pendingTestimonials: db.prepare("SELECT COUNT(*) c FROM testimonials WHERE status = 'pending'").get().c,
    },
  };
  if (auth.can(req.user, 'leads.view')) {
    const by = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM leads GROUP BY status').all().map((r) => [r.status, r.c]));
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    out.leads = {
      total: db.prepare('SELECT COUNT(*) c FROM leads').get().c,
      new: by.new || 0,
      inProgress: (by.contact_attempted || 0) + (by.qualified || 0) + (by.quote_sent || 0),
      won: by.won || 0,
      disqualified: by.disqualified || 0,
      last30: db.prepare('SELECT COUNT(*) c FROM leads WHERE created_at >= ?').get(since30).c,
      byStatus: by,
      byChannel: db.prepare('SELECT COALESCE(channel, ?) channel, COUNT(*) c FROM leads WHERE created_at >= ? GROUP BY 1 ORDER BY c DESC LIMIT 6').all('غير معروف', since30),
      daily: db.prepare("SELECT substr(created_at,1,10) d, COUNT(*) c FROM leads WHERE created_at >= ? GROUP BY d ORDER BY d").all(new Date(Date.now() - 14 * 864e5).toISOString()),
      recent: db.prepare('SELECT id, name, phone, phone_e164, service, city, status, channel, created_at FROM leads ORDER BY id DESC LIMIT 6').all(),
    };
  }
  res.json(out);
});

// ---------------- الطلبات (CRM) ----------------
function leadFilters(q) {
  const where = [], args = [];
  if (q.q) {
    const term = `%${clean(q.q, 60)}%`;
    const digits = clean(q.q, 30).replace(/\D/g, '');
    where.push(`(name LIKE ? OR phone LIKE ?${digits.length >= 4 ? ' OR phone_e164 LIKE ?' : ''})`);
    args.push(term, term); if (digits.length >= 4) args.push(`%${digits.replace(/^0+/, '')}%`);
  }
  if (q.status && LEAD_STATUSES[q.status]) { where.push('status = ?'); args.push(q.status); }
  if (q.service) { where.push('service = ?'); args.push(clean(q.service, 120)); }
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) { where.push('created_at >= ?'); args.push(`${q.from}T00:00:00.000Z`); }
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) { where.push('created_at <= ?'); args.push(`${q.to}T23:59:59.999Z`); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

router.get('/leads', auth.requirePerm('leads.view'), (req, res) => {
  const f = leadFilters(req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = 25;
  const total = db.prepare(`SELECT COUNT(*) c FROM leads ${f.sql}`).get(...f.args).c;
  const rows = db.prepare(`SELECT l.id, l.name, l.phone, l.phone_e164, l.service, l.city, l.status, l.channel, l.created_at,
      (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) notes
    FROM leads l ${f.sql} ORDER BY l.id DESC LIMIT ? OFFSET ?`).all(...f.args, size, (page - 1) * size);
  const services = db.prepare('SELECT DISTINCT service FROM leads ORDER BY service').all().map((r) => r.service);
  res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / size)), services });
});

router.get('/leads/export.csv', auth.requirePerm('leads.export'), (req, res) => {
  const f = leadFilters(req.query);
  const rows = db.prepare(`SELECT * FROM leads ${f.sql} ORDER BY id DESC`).all(...f.args);
  const cols = [['id', 'رقم الطلب'], ['created_at', 'التاريخ'], ['name', 'الاسم'], ['phone_e164', 'الجوال'], ['city', 'المدينة'], ['service', 'الخدمة'],
    ['property_type', 'نوع العقار'], ['area', 'المساحة'], ['budget', 'الميزانية'], ['contact_time', 'وقت التواصل'], ['details', 'التفاصيل'],
    ['status', 'الحالة'], ['channel', 'المصدر'], ['utm_source', 'utm_source'], ['utm_medium', 'utm_medium'], ['utm_campaign', 'utm_campaign'],
    ['utm_term', 'utm_term'], ['gclid', 'gclid']];
  // منع حقن الصيغ في Excel
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.map((c) => esc(c[1])).join(',')];
  for (const r of rows) lines.push(cols.map(([k]) => esc(k === 'status' ? LEAD_STATUSES[r[k]] : r[k])).join(','));
  audit(req.user.id, 'leads.export', { count: rows.length, filters: req.query });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

router.get('/leads/:id', auth.requirePerm('leads.view'), (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'الطلب غير موجود.' });
  delete lead.ip_hash; delete lead.idempotency_key;
  const notes = db.prepare('SELECT n.id, n.note, n.created_at, u.name author FROM lead_notes n LEFT JOIN users u ON u.id = n.user_id WHERE lead_id = ? ORDER BY n.id DESC').all(lead.id);
  const events = db.prepare('SELECT e.type, e.from_status, e.to_status, e.created_at, u.name author FROM lead_events e LEFT JOIN users u ON u.id = e.user_id WHERE lead_id = ? ORDER BY e.id DESC').all(lead.id);
  res.json({ lead, notes, events });
});

router.patch('/leads/:id', auth.requirePerm('leads.edit'), (req, res) => {
  const lead = db.prepare('SELECT id, status FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'الطلب غير موجود.' });
  const st = req.body?.status;
  if (!LEAD_STATUSES[st]) return res.status(400).json({ error: 'حالة غير صحيحة.' });
  if (st !== lead.status) {
    const t = now();
    db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(st, t, lead.id);
    db.prepare("INSERT INTO lead_events (lead_id, user_id, type, from_status, to_status, created_at) VALUES (?,?, 'status', ?, ?, ?)").run(lead.id, req.user.id, lead.status, st, t);
  }
  res.json({ ok: true });
});

router.post('/leads/:id/notes', auth.requirePerm('leads.edit'), (req, res) => {
  const note = clean(req.body?.note, 2000);
  if (!note) return res.status(400).json({ error: 'اكتب الملاحظة أولًا.' });
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'الطلب غير موجود.' });
  const t = now();
  db.prepare('INSERT INTO lead_notes (lead_id, user_id, note, created_at) VALUES (?,?,?,?)').run(req.params.id, req.user.id, note, t);
  db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(t, req.params.id);
  res.status(201).json({ ok: true });
});

router.post('/leads/:id/whatsapp', auth.requirePerm('leads.edit'), (req, res) => {
  // تسجيل فتح محادثة واتساب (لا يعني أن رسالة أُرسلت)
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'الطلب غير موجود.' });
  db.prepare("INSERT INTO lead_events (lead_id, user_id, type, created_at) VALUES (?,?, 'whatsapp_opened', ?)").run(req.params.id, req.user.id, now());
  res.json({ ok: true });
});

router.delete('/leads/:id', auth.requirePerm('leads.delete'), (req, res) => {
  const r = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'الطلب غير موجود.' });
  audit(req.user.id, 'lead.delete', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// ---------------- رفع الصور ----------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.post('/uploads', (req, res, next) => (auth.can(req.user, 'content') || auth.can(req.user, 'settings') ? next() : res.status(403).json({ error: 'ليست لديك صلاحية.' })),
  (req, res) => upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة أكبر من 10 ميجابايت.' : 'تعذر رفع الملف.' });
    if (!req.file) return res.status(400).json({ error: 'اختر صورة أولًا.' });
    try { res.status(201).json({ image: await processUpload(req.file.buffer) }); } catch (e) { res.status(400).json({ error: e.message }); }
  }));

// ---------------- إدارة المحتوى (مولّد عام) ----------------
/*  type: s (نص قصير) | t (نص طويل) | b (منطقي) | i (رقم) | img (صورة) | fk (مرجع) | enum  */
const RESOURCES = {
  services: { table: 'services', perm: 'content', order: 'sort_order, id', fields: { title: ['s', 120, true], description: ['t', 600], image: ['img'], sort_order: ['i'], published: ['b'] } },
  categories: { table: 'project_categories', perm: 'content', order: 'sort_order, id', fields: { name: ['s', 60, true], sort_order: ['i'] } },
  projects: { table: 'projects', perm: 'content', order: 'sort_order, id', fields: {
    title: ['s', 120, true], category_id: ['fk', 'project_categories'], location: ['s', 80], area: ['s', 40], summary: ['t', 300], description: ['t', 3000],
    cover_image: ['img'], before_image: ['img'], after_image: ['img'], is_demo: ['b'], sort_order: ['i'], published: ['b'] } },
  features: { table: 'features', perm: 'content', order: 'sort_order, id', fields: { title: ['s', 100, true], description: ['t', 400], sort_order: ['i'], published: ['b'] } },
  steps: { table: 'steps', perm: 'content', order: 'sort_order, id', fields: { title: ['s', 100, true], description: ['t', 400], sort_order: ['i'], published: ['b'] } },
  faqs: { table: 'faqs', perm: 'content', order: 'sort_order, id', fields: { question: ['s', 200, true], answer: ['t', 1500, true], sort_order: ['i'], published: ['b'] } },
  testimonials: { table: 'testimonials', perm: 'testimonials', order: "CASE status WHEN 'pending' THEN 0 ELSE 1 END, sort_order, id DESC", fields: {
    name: ['s', 60, true], city: ['s', 60], service: ['s', 120], text: ['t', 600, true], rating: ['i', 1, false, 1, 5], consent: ['b'],
    status: ['enum', ['pending', 'approved', 'rejected']], sort_order: ['i'] } },
};

function parseFields(spec, body, partial) {
  const out = {}, errors = {};
  for (const [k, [type, a, required, min, max]] of Object.entries(spec)) {
    if (!(k in body)) { if (!partial && required) errors[k] = 'هذا الحقل مطلوب.'; continue; }
    const v = body[k];
    if (type === 's' || type === 't') { const s = clean(v, a); if (required && !s) errors[k] = 'هذا الحقل مطلوب.'; out[k] = s; }
    else if (type === 'b') out[k] = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    else if (type === 'i') {
      if (v === '' || v === null) { out[k] = k === 'sort_order' ? 0 : null; continue; }
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || (min !== undefined && (n < min || n > max))) errors[k] = 'قيمة رقمية غير صحيحة.'; else out[k] = n;
    } else if (type === 'img') { if (!isValidImageRef(v || '')) errors[k] = 'صورة غير صالحة.'; else out[k] = v || null; }
    else if (type === 'fk') {
      if (v === '' || v === null) out[k] = null;
      else if (!db.prepare(`SELECT id FROM ${a} WHERE id = ?`).get(v)) errors[k] = 'العنصر المرتبط غير موجود.';
      else out[k] = Number(v);
    } else if (type === 'enum') { if (!a.includes(v)) errors[k] = 'قيمة غير صحيحة.'; else out[k] = v; }
  }
  return { out, errors };
}

for (const [name, r] of Object.entries(RESOURCES)) {
  const guard = auth.requirePerm(r.perm);
  router.get(`/${name}`, guard, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${r.table} ORDER BY ${r.order}`).all();
    if (name === 'projects') {
      const st = db.prepare('SELECT id, image, alt, sort_order FROM project_images WHERE project_id = ? ORDER BY sort_order, id');
      rows.forEach((p) => { p.images = st.all(p.id); });
    }
    res.json({ rows });
  });
  router.post(`/${name}`, guard, (req, res) => {
    const { out, errors } = parseFields(r.fields, req.body || {}, false);
    if (Object.keys(errors).length) return res.status(422).json({ error: 'يرجى مراجعة الحقول.', fields: errors });
    if ('sort_order' in r.fields && out.sort_order === undefined) out.sort_order = (db.prepare(`SELECT COALESCE(MAX(sort_order),0)+1 n FROM ${r.table}`).get().n);
    const t = now();
    const keys = [...Object.keys(out), 'created_at', 'updated_at'];
    const info = db.prepare(`INSERT INTO ${r.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(out), t, t);
    audit(req.user.id, `${name}.create`, { id: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });
  router.put(`/${name}/:id`, guard, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${r.table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'العنصر غير موجود.' });
    const { out, errors } = parseFields(r.fields, req.body || {}, true);
    if (Object.keys(errors).length) return res.status(422).json({ error: 'يرجى مراجعة الحقول.', fields: errors });
    if (!Object.keys(out).length) return res.json({ ok: true });
    db.prepare(`UPDATE ${r.table} SET ${Object.keys(out).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...Object.values(out), now(), row.id);
    for (const [k, [type]] of Object.entries(r.fields)) if (type === 'img' && k in out && row[k] !== out[k] && !imageInUse(row[k])) deleteUpload(row[k]);
    audit(req.user.id, `${name}.update`, { id: row.id });
    res.json({ ok: true });
  });
  router.delete(`/${name}/:id`, guard, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${r.table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'العنصر غير موجود.' });
    const imgs = name === 'projects' ? db.prepare('SELECT image FROM project_images WHERE project_id = ?').all(row.id).map((x) => x.image) : [];
    db.prepare(`DELETE FROM ${r.table} WHERE id = ?`).run(row.id);
    for (const [k, [type]] of Object.entries(r.fields)) if (type === 'img') imgs.push(row[k]);
    imgs.filter((x) => x && !imageInUse(x)).forEach(deleteUpload);
    audit(req.user.id, `${name}.delete`, { id: row.id });
    res.json({ ok: true });
  });
}

function imageInUse(ref) {
  if (!ref) return false;
  const q = [
    'SELECT 1 FROM services WHERE image = ?', 'SELECT 1 FROM projects WHERE cover_image = ? OR before_image = ? OR after_image = ?',
    'SELECT 1 FROM project_images WHERE image = ?',
  ];
  if (db.prepare(q[0]).get(ref) || db.prepare(q[1]).get(ref, ref, ref) || db.prepare(q[2]).get(ref)) return true;
  const s = getAllSettings();
  return [s.hero.image, s.company.logoImage].includes(ref);
}

// صور معرض المشروع
router.post('/projects/:id/images', auth.requirePerm('content'), (req, res) => {
  const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'المشروع غير موجود.' });
  const image = req.body?.image;
  if (!image || !isValidImageRef(image)) return res.status(400).json({ error: 'صورة غير صالحة.' });
  const n = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM project_images WHERE project_id = ?').get(p.id).n;
  const info = db.prepare('INSERT INTO project_images (project_id, image, alt, sort_order, created_at) VALUES (?,?,?,?,?)').run(p.id, image, clean(req.body?.alt, 150), n, now());
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
router.put('/projects/:id/images/:imgId', auth.requirePerm('content'), (req, res) => {
  const r = db.prepare('UPDATE project_images SET alt = COALESCE(?, alt), sort_order = COALESCE(?, sort_order) WHERE id = ? AND project_id = ?')
    .run(req.body?.alt !== undefined ? clean(req.body.alt, 150) : null, Number.isFinite(+req.body?.sort_order) ? +req.body.sort_order : null, req.params.imgId, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'الصورة غير موجودة.' });
  res.json({ ok: true });
});
router.delete('/projects/:id/images/:imgId', auth.requirePerm('content'), (req, res) => {
  const row = db.prepare('SELECT image FROM project_images WHERE id = ? AND project_id = ?').get(req.params.imgId, req.params.id);
  if (!row) return res.status(404).json({ error: 'الصورة غير موجودة.' });
  db.prepare('DELETE FROM project_images WHERE id = ?').run(req.params.imgId);
  if (!imageInUse(row.image)) deleteUpload(row.image);
  res.json({ ok: true });
});

// ترتيب العناصر بالسحب
router.post('/reorder/:name', (req, res) => {
  const r = RESOURCES[req.params.name];
  if (!r || !auth.can(req.user, r.perm)) return res.status(403).json({ error: 'ليست لديك صلاحية.' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  const st = db.prepare(`UPDATE ${r.table} SET sort_order = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => st.run(i + 1, id)))();
  res.json({ ok: true });
});

// ---------------- الإعدادات ----------------
const strList = (v, maxItems, maxLen) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems);
const SETTINGS_SCHEMA = {
  company: (b, prev) => {
    const errors = {};
    const wa = String(b.whatsapp || '').replace(/\D/g, '');
    if (wa && !/^\d{8,15}$/.test(wa)) errors.whatsapp = 'اكتب رقم واتساب بالصيغة الدولية بدون + (مثال: 9665XXXXXXXX).';
    const email = clean(b.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'بريد إلكتروني غير صحيح.';
    if (b.logoImage && !isValidImageRef(b.logoImage)) errors.logoImage = 'صورة غير صالحة.';
    const socials = {};
    for (const k of Object.keys(DEFAULT_SETTINGS.company.socials)) {
      const u = clean(b.socials?.[k], 300);
      if (u && !/^https:\/\/[^\s]+$/.test(u)) errors[`socials.${k}`] = 'الرابط يجب أن يبدأ بـ https://';
      socials[k] = u;
    }
    return { errors, value: { name: clean(b.name, 80) || prev.name, shortName: clean(b.shortName, 30), tagline: clean(b.tagline, 80), logoImage: b.logoImage || '',
      phone: clean(b.phone, 30), whatsapp: wa, whatsappMessage: clean(b.whatsappMessage, 400), email, address: clean(b.address, 200),
      workingHours: clean(b.workingHours, 120), serviceArea: clean(b.serviceArea, 120), socials, demoMode: !!b.demoMode } };
  },
  hero: (b) => ({ errors: b.image && !isValidImageRef(b.image) ? { image: 'صورة غير صالحة.' } : {}, value: {
    title: clean(b.title, 140), subtitle: clean(b.subtitle, 400), primaryCta: clean(b.primaryCta, 40) || 'اطلب معاينة',
    secondaryCta: clean(b.secondaryCta, 40) || 'تواصل عبر واتساب', image: b.image || '', imageAlt: clean(b.imageAlt, 150), dimensionLabel: clean(b.dimensionLabel, 60) } }),
  trust: (b) => ({ errors: {}, value: { items: strList(b.items, 6, 80) } }),
  sections: (b) => {
    const v = {};
    for (const k of Object.keys(DEFAULT_SETTINGS.sections)) v[k] = clean(b[k], 200);
    return { errors: {}, value: v };
  },
  form: (b) => {
    const errors = {};
    if (!MARKETS[b.market]) errors.market = 'اختر الدولة.';
    const v = { market: b.market, propertyTypes: strList(b.propertyTypes, 15, 60), budgets: strList(b.budgets, 12, 60),
      contactTimes: strList(b.contactTimes, 8, 60), cities: strList(b.cities, 60, 60), privacyRequired: !!b.privacyRequired,
      successMessage: clean(b.successMessage, 300) || DEFAULT_SETTINGS.form.successMessage, notifyEmail: '' };
    if (!v.propertyTypes.length) errors.propertyTypes = 'أضف نوع عقار واحدًا على الأقل.';
    if (!v.contactTimes.length) errors.contactTimes = 'أضف وقت تواصل واحدًا على الأقل.';
    return { errors, value: v };
  },
  seo: (b) => {
    const errors = {};
    const siteUrl = clean(b.siteUrl, 200).replace(/\/$/, '');
    if (siteUrl && !/^https?:\/\/[^\s/]+$/.test(siteUrl)) errors.siteUrl = 'اكتب النطاق فقط، مثال: https://example.com';
    const og = clean(b.ogImage, 300);
    return { errors, value: { title: clean(b.title, 70), description: clean(b.description, 170), siteUrl, ogImage: og, indexable: !!b.indexable } };
  },
  tracking: (b, prev) => {
    const errors = {};
    const t = { gtmId: clean(b.gtmId, 20).toUpperCase(), ga4Id: clean(b.ga4Id, 20).toUpperCase(), adsConversionId: clean(b.adsConversionId, 20).toUpperCase(),
      adsLeadLabel: clean(b.adsLeadLabel, 60), adsWhatsappLabel: clean(b.adsWhatsappLabel, 60), turnstileSiteKey: clean(b.turnstileSiteKey, 100) };
    if (t.gtmId && !/^GTM-[A-Z0-9]{4,10}$/.test(t.gtmId)) errors.gtmId = 'صيغة GTM غير صحيحة (GTM-XXXXXXX).';
    if (t.ga4Id && !/^G-[A-Z0-9]{4,12}$/.test(t.ga4Id)) errors.ga4Id = 'صيغة GA4 غير صحيحة (G-XXXXXXXXXX).';
    if (t.adsConversionId && !/^AW-\d{6,12}$/.test(t.adsConversionId)) errors.adsConversionId = 'صيغة معرف Google Ads غير صحيحة (AW-XXXXXXXXX).';
    for (const k of ['adsLeadLabel', 'adsWhatsappLabel']) if (t[k] && !/^[A-Za-z0-9_-]+$/.test(t[k])) errors[k] = 'تسمية التحويل تحتوي على رموز غير مسموحة.';
    // السر لا يُعاد للواجهة: قيمة فارغة = إبقاء القديم، "__clear__" = حذف
    t.turnstileSecret = b.turnstileSecret === '__clear__' ? '' : (clean(b.turnstileSecret, 200) || prev.turnstileSecret || '');
    return { errors, value: t };
  },
  privacy: (b) => ({ errors: {}, value: { body: clean(b.body, 20000), lastUpdated: new Date().toISOString().slice(0, 10) } }),
};

router.get('/settings', auth.requirePerm('settings'), (req, res) => {
  const s = getAllSettings();
  s.tracking = { ...s.tracking, turnstileSecret: s.tracking.turnstileSecret ? '••••••••' : '' };
  res.json({ settings: s, markets: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.name])) });
});
router.put('/settings/:group', auth.requirePerm('settings'), (req, res) => {
  const fn = SETTINGS_SCHEMA[req.params.group];
  if (!fn) return res.status(404).json({ error: 'مجموعة إعدادات غير معروفة.' });
  const prev = getSetting(req.params.group) || {};
  const { errors, value } = fn(req.body || {}, prev);
  if (Object.keys(errors).length) return res.status(422).json({ error: 'يرجى مراجعة الحقول.', fields: errors });
  setSetting(req.params.group, value);
  audit(req.user.id, `settings.${req.params.group}`);
  res.json({ ok: true });
});

// ---------------- المستخدمون ----------------
router.get('/users', auth.requirePerm('users'), (req, res) =>
  res.json({ rows: db.prepare('SELECT id, name, email, role, active, last_login_at, created_at FROM users ORDER BY id').all() }));
router.post('/users', auth.requirePerm('users'), (req, res) => {
  const b = req.body || {}, fields = {};
  const name = clean(b.name, 60), email = clean(b.email, 120).toLowerCase();
  if (name.length < 2) fields.name = 'اكتب الاسم.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'بريد إلكتروني غير صحيح.';
  else if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) fields.email = 'هذا البريد مستخدم بالفعل.';
  if (!auth.PERMISSIONS[b.role]) fields.role = 'اختر الدور.';
  const pwErr = auth.validatePassword(b.password);
  if (pwErr) fields.password = pwErr;
  if (Object.keys(fields).length) return res.status(422).json({ error: 'يرجى مراجعة الحقول.', fields });
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,1,?)').run(name, email, auth.hashPassword(b.password), b.role, now());
  audit(req.user.id, 'users.create', { id: Number(info.lastInsertRowid), role: b.role });
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
router.put('/users/:id', auth.requirePerm('users'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  const b = req.body || {};
  const role = b.role !== undefined ? b.role : u.role;
  const active = b.active !== undefined ? (b.active ? 1 : 0) : u.active;
  if (!auth.PERMISSIONS[role]) return res.status(422).json({ error: 'دور غير صحيح.' });
  if (u.id === req.user.id && (role !== 'admin' || !active)) return res.status(400).json({ error: 'لا يمكنك تغيير دورك أو إيقاف حسابك بنفسك.' });
  if (u.role === 'admin' && (role !== 'admin' || !active)) {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1").get().c;
    if (admins <= 1) return res.status(400).json({ error: 'يجب أن يبقى مدير نشط واحد على الأقل.' });
  }
  if (b.password) {
    const e = auth.validatePassword(b.password);
    if (e) return res.status(422).json({ error: e, fields: { password: e } });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(b.password), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(clean(b.name, 60) || u.name, role, active, u.id);
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  audit(req.user.id, 'users.update', { id: u.id, role, active });
  res.json({ ok: true });
});

router.use((req, res) => res.status(404).json({ error: 'المسار غير موجود.' }));

module.exports = { router, LEAD_STATUSES };
