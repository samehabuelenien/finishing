const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { db, now, getAllSettings, getSetting } = require('../db');
const { validateLead, attribution, clean, MARKETS } = require('../validation');

const router = express.Router();

function loadPublicContent() {
  const services = db.prepare('SELECT id, title, description, image FROM services WHERE published = 1 ORDER BY sort_order, id').all();
  const categories = db.prepare(`SELECT c.id, c.name FROM project_categories c
    WHERE EXISTS (SELECT 1 FROM projects p WHERE p.category_id = c.id AND p.published = 1) ORDER BY c.sort_order, c.id`).all();
  const projects = db.prepare(`SELECT p.id, p.title, p.category_id, c.name AS category, p.location, p.area, p.summary, p.description,
      p.cover_image, p.before_image, p.after_image, p.is_demo
    FROM projects p LEFT JOIN project_categories c ON c.id = p.category_id
    WHERE p.published = 1 ORDER BY p.sort_order, p.id`).all();
  const imgStmt = db.prepare('SELECT image, alt FROM project_images WHERE project_id = ? ORDER BY sort_order, id');
  projects.forEach((p) => { p.images = imgStmt.all(p.id); });
  const features = db.prepare('SELECT title, description FROM features WHERE published = 1 ORDER BY sort_order, id').all();
  const steps = db.prepare('SELECT title, description FROM steps WHERE published = 1 ORDER BY sort_order, id').all();
  const faqs = db.prepare('SELECT question, answer FROM faqs WHERE published = 1 ORDER BY sort_order, id').all();
  const testimonials = db.prepare(`SELECT name, city, service, text, rating FROM testimonials
    WHERE status = 'approved' AND consent = 1 ORDER BY sort_order, id DESC`).all();
  return { services, categories, projects, features, steps, faqs, testimonials };
}

function publicSettings() {
  const s = getAllSettings();
  // لا تُرسل الأسرار أبدًا إلى الواجهة
  const tracking = { ...s.tracking };
  delete tracking.turnstileSecret;
  return { ...s, tracking };
}

const siteUrl = (req) => (getSetting('seo')?.siteUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

router.get('/', (req, res) => {
  const s = publicSettings();
  const c = loadPublicContent();
  res.render('index', { s, c, url: siteUrl(req), market: MARKETS[s.form.market] || MARKETS.SA, nonce: res.locals.nonce, year: new Date().getFullYear() });
});

router.get('/privacy', (req, res) => {
  const s = publicSettings();
  res.render('privacy', { s, url: siteUrl(req), nonce: res.locals.nonce, year: new Date().getFullYear() });
});

router.get('/robots.txt', (req, res) => {
  const indexable = getSetting('seo')?.indexable;
  res.type('text/plain').send(indexable
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${siteUrl(req)}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n');
});

router.get('/sitemap.xml', (req, res) => {
  const u = siteUrl(req);
  const d = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${u}/</loc><lastmod>${d}</lastmod><priority>1.0</priority></url>
  <url><loc>${u}/privacy</loc><lastmod>${d}</lastmod><priority>0.3</priority></url>
</urlset>`);
});

// ---------------- استقبال طلبات المعاينة ----------------
const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, limit: Number(process.env.LEAD_RATE_LIMIT || 5), standardHeaders: 'draft-7', legacyHeaders: false,
  message: { ok: false, error: 'تم إرسال عدة طلبات من هذا الجهاز خلال وقت قصير. يرجى المحاولة بعد قليل أو التواصل عبر واتساب.' },
});

async function verifyTurnstile(token, ip) {
  const secret = getSetting('tracking')?.turnstileSecret || process.env.TURNSTILE_SECRET;
  if (!secret) return true; // غير مفعّل
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip || '' }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    return !!j.success;
  } catch { return false; }
}

const ipHash = (ip) => crypto.createHash('sha256').update(`${ip}|${process.env.SESSION_SECRET || 'salt'}`).digest('hex').slice(0, 32);

function notifyWebhook(lead) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ event: 'lead.created', lead }),
  }).catch((e) => console.error('[webhook] failed:', e.message));
}

router.post('/api/leads', leadLimiter, async (req, res) => {
  const body = req.body || {};
  // 1) مصيدة الروبوتات: حقل مخفي يجب أن يبقى فارغًا
  if (clean(body.company_website, 200)) return res.status(400).json({ ok: false, error: 'تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.' });
  // 2) زمن تعبئة غير واقعي (أقل من ثانيتين)
  const started = Number(body.started_at);
  if (!started || Date.now() - started < 2000) return res.status(400).json({ ok: false, error: 'تعذر التحقق من الطلب. يرجى المحاولة مرة أخرى بعد ثوانٍ.' });
  // 3) Cloudflare Turnstile عند تفعيله
  if (!(await verifyTurnstile(body['cf-turnstile-response'], req.ip))) {
    return res.status(400).json({ ok: false, error: 'يرجى إكمال خطوة التحقق ثم إعادة الإرسال.' });
  }

  const form = getSetting('form');
  const services = db.prepare('SELECT title FROM services WHERE published = 1').all().map((r) => r.title);
  const v = validateLead(body, {
    market: form.market, services, propertyTypes: form.propertyTypes, budgets: form.budgets,
    contactTimes: form.contactTimes, privacyRequired: form.privacyRequired,
  });
  if (v.errors) return res.status(422).json({ ok: false, error: 'يرجى مراجعة الحقول المظللة.', fields: v.errors });

  const key = clean(body.idempotency_key, 64);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) return res.status(400).json({ ok: false, error: 'تعذر إرسال الطلب. يرجى تحديث الصفحة والمحاولة مرة أخرى.' });

  // إعادة إرسال نفس النموذج (ضغط مزدوج/إعادة محاولة الشبكة) ⇒ نفس الطلب
  const existing = db.prepare('SELECT id FROM leads WHERE idempotency_key = ?').get(key);
  if (existing) return res.json({ ok: true, leadId: existing.id, duplicate: true });
  // نفس الرقم خلال 10 دقائق ⇒ لا ننشئ طلبًا مكررًا
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const recent = db.prepare('SELECT id FROM leads WHERE phone_e164 = ? AND created_at > ? ORDER BY id DESC').get(v.data.phone_e164, since);
  if (recent) return res.json({ ok: true, leadId: recent.id, duplicate: true });

  const d = v.data, a = attribution(body), t = now();
  try {
    const info = db.prepare(`INSERT INTO leads (name, phone, phone_e164, city, service, property_type, area, budget, contact_time, details, consent,
        status, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid, fbclid, referrer, landing_page,
        ip_hash, user_agent, idempotency_key, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.name, d.phone, d.phone_e164, d.city, d.service, d.property_type, d.area || null, d.budget || null, d.contact_time, d.details || null, d.consent ? 1 : 0,
      a.channel, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content, a.gclid, a.gbraid, a.wbraid, a.fbclid, a.referrer, a.landing_page,
      ipHash(req.ip), clean(req.get('user-agent'), 300), key, t, t);
    const id = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO lead_events (lead_id, type, to_status, created_at) VALUES (?, 'created', 'new', ?)").run(id, t);
    // تأكيد القراءة بعد الكتابة قبل إبلاغ العميل بالنجاح
    if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(id)) throw new Error('lead not persisted');
    notifyWebhook({ id, ...d, channel: a.channel, created_at: t });
    return res.status(201).json({ ok: true, leadId: id, duplicate: false });
  } catch (e) {
    if (String(e.message).includes('UNIQUE') && key) {
      const ex = db.prepare('SELECT id FROM leads WHERE idempotency_key = ?').get(key);
      if (ex) return res.json({ ok: true, leadId: ex.id, duplicate: true });
    }
    console.error('[lead] save failed:', e);
    return res.status(500).json({ ok: false, error: 'تعذر حفظ طلبك بسبب خطأ في الخادم. يرجى المحاولة مرة أخرى أو التواصل عبر واتساب.' });
  }
});

// ---------------- إرسال رأي عميل (يظهر بعد الموافقة فقط) ----------------
const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { ok: false, error: 'تم إرسال عدة آراء من هذا الجهاز. يرجى المحاولة لاحقًا.' } });

router.post('/api/testimonials', reviewLimiter, async (req, res) => {
  const b = req.body || {};
  if (clean(b.company_website, 200)) return res.status(400).json({ ok: false, error: 'تعذر الإرسال.' });
  if (!(await verifyTurnstile(b['cf-turnstile-response'], req.ip))) return res.status(400).json({ ok: false, error: 'يرجى إكمال خطوة التحقق.' });
  const fields = {};
  const name = clean(b.name, 60), city = clean(b.city, 60), text = clean(b.text, 600);
  const rating = Number(b.rating);
  if (name.length < 2) fields.name = 'يرجى كتابة الاسم.';
  if (text.length < 15) fields.text = 'يرجى كتابة رأيك (15 حرفًا على الأقل).';
  if (b.rating && !(rating >= 1 && rating <= 5)) fields.rating = 'التقييم من 1 إلى 5.';
  if (!(b.consent === true || b.consent === 'on')) fields.consent = 'يرجى الموافقة على نشر الاسم والرأي.';
  if (Object.keys(fields).length) return res.status(422).json({ ok: false, error: 'يرجى مراجعة الحقول.', fields });
  const t = now();
  db.prepare(`INSERT INTO testimonials (name, city, service, text, rating, consent, status, source, created_at, updated_at)
    VALUES (?,?,?,?,?,1,'pending','website',?,?)`).run(name, city, clean(b.service, 120), text, rating || null, t, t);
  res.status(201).json({ ok: true });
});

module.exports = { router, loadPublicContent };
