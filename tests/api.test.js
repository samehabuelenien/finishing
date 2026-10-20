// اختبارات تكامل للواجهات البرمجية: node --test tests/
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.SESSION_SECRET = 'test-secret-0123456789abcdef0123456789';
process.env.ADMIN_EMAIL = 'owner@test.local';
process.env.ADMIN_PASSWORD = 'OwnerPass12345';
process.env.NODE_ENV = 'test';
process.env.LEAD_RATE_LIMIT = '100';

const app = require('../server');
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const H = (extra = {}) => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { Cookie: cookie } : {}), ...extra });
const post = (u, b, h) => fetch(base + u, { method: 'POST', headers: H(h), body: JSON.stringify(b) });
const validLead = (o = {}) => ({ name: 'محمد أحمد', phone: '0551234567', city: 'الرياض', service: 'التشطيب الكامل للشقق', property_type: 'شقة',
  area: '١٥٠', contact_time: 'أي وقت', consent: true, started_at: Date.now() - 10000, idempotency_key: 'k-' + Math.random().toString(36).slice(2) + '-abcdefgh',
  attribution: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'riyadh-finishing', gclid: 'abc123' }, ...o });

test('الصفحة الرئيسية تُعرض بالمحتوى ومن دون أسرار', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /dir="rtl"/);
  assert.match(html, /التشطيب الكامل للشقق/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /turnstileSecret/);
  assert.ok(r.headers.get('content-security-policy'));
});

test('رفض طلب ناقص مع أخطاء الحقول بالعربية', async () => {
  const r = await post('/api/leads', validLead({ name: '', phone: '123', property_type: 'قصر' }));
  assert.equal(r.status, 422);
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.ok(j.fields.name && j.fields.phone && j.fields.property_type);
});

test('مصيدة الروبوتات والإرسال السريع يُرفضان', async () => {
  let r = await post('/api/leads', validLead({ company_website: 'spam.com' }));
  assert.equal(r.status, 400);
  r = await post('/api/leads', validLead({ started_at: Date.now() }));
  assert.equal(r.status, 400);
});

let leadId;
test('حفظ طلب صحيح وعدم تكراره عند إعادة الإرسال', async () => {
  const body = validLead();
  const r = await post('/api/leads', body);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.duplicate, false); leadId = j.leadId;
  const again = await (await post('/api/leads', body)).json();
  assert.equal(again.leadId, leadId); assert.equal(again.duplicate, true);
  const samePhone = await (await post('/api/leads', validLead({ phone: '+966551234567' }))).json();
  assert.equal(samePhone.duplicate, true);
});

test('لوحة التحكم محمية', async () => {
  assert.equal((await fetch(base + '/api/admin/leads', { headers: H() })).status, 401);
  const noHdr = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noHdr.status, 403);
  const bad = await post('/api/admin/auth/login', { email: 'owner@test.local', password: 'wrong' });
  assert.equal(bad.status, 401);
});

test('تسجيل الدخول وإدارة الطلب', async () => {
  const r = await post('/api/admin/auth/login', { email: 'owner@test.local', password: 'OwnerPass12345' });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  const list = await (await fetch(base + '/api/admin/leads?q=0551234567', { headers: H() })).json();
  assert.equal(list.total, 1);
  const d = await (await fetch(base + '/api/admin/leads/' + leadId, { headers: H() })).json();
  assert.equal(d.lead.phone_e164, '+966551234567');
  assert.equal(d.lead.area, '150');
  assert.equal(d.lead.channel, 'إعلانات Google');
  const up = await fetch(base + '/api/admin/leads/' + leadId, { method: 'PATCH', headers: H(), body: JSON.stringify({ status: 'qualified' }) });
  assert.equal(up.status, 200);
  assert.equal((await post(`/api/admin/leads/${leadId}/notes`, { note: 'اتصلنا وحددنا موعدًا' })).status, 201);
  const d2 = await (await fetch(base + '/api/admin/leads/' + leadId, { headers: H() })).json();
  assert.equal(d2.lead.status, 'qualified'); assert.equal(d2.notes.length, 1);
  const dash = await (await fetch(base + '/api/admin/dashboard', { headers: H() })).json();
  assert.equal(dash.leads.total, 1); assert.equal(dash.leads.inProgress, 1);
  const csv = await fetch(base + '/api/admin/leads/export.csv', { headers: H() });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /محمد أحمد/);
});

test('صلاحيات دور المبيعات', async () => {
  const c = await post('/api/admin/users', { name: 'موظف مبيعات', email: 'sales@test.local', role: 'sales', password: 'SalesPass12345' });
  assert.equal(c.status, 201);
  const adminCookie = cookie;
  const r = await post('/api/admin/auth/login', { email: 'sales@test.local', password: 'SalesPass12345' });
  cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/api/admin/leads', { headers: H() })).status, 200);
  assert.equal((await fetch(base + '/api/admin/leads/export.csv', { headers: H() })).status, 403);
  assert.equal((await fetch(base + '/api/admin/settings', { headers: H() })).status, 403);
  assert.equal((await post('/api/admin/services', { title: 'x' })).status, 403);
  cookie = adminCookie;
});

test('إدارة المحتوى تنعكس على الموقع', async () => {
  const c = await post('/api/admin/services', { title: 'عزل الأسطح', description: 'عزل مائي وحراري', published: true });
  assert.equal(c.status, 201);
  assert.match(await (await fetch(base + '/')).text(), /عزل الأسطح/);
  const { id } = await c.json();
  await fetch(base + '/api/admin/services/' + id, { method: 'PUT', headers: H(), body: JSON.stringify({ published: false }) });
  assert.doesNotMatch(await (await fetch(base + '/')).text(), /عزل الأسطح/);
});

test('رأي العميل لا يظهر قبل الاعتماد', async () => {
  const r = await post('/api/testimonials', { name: 'سارة', text: 'تجربة ممتازة والتزام بالمواعيد والتفاصيل', rating: 5, consent: true });
  assert.equal(r.status, 201);
  assert.doesNotMatch(await (await fetch(base + '/')).text(), /تجربة ممتازة والتزام/);
  const list = await (await fetch(base + '/api/admin/testimonials', { headers: H() })).json();
  const t = list.rows.find((x) => x.name === 'سارة');
  await fetch(base + '/api/admin/testimonials/' + t.id, { method: 'PUT', headers: H(), body: JSON.stringify({ status: 'approved' }) });
  assert.match(await (await fetch(base + '/')).text(), /تجربة ممتازة والتزام/);
});

test('الإعدادات: التحقق والسر لا يُعاد', async () => {
  let r = await fetch(base + '/api/admin/settings/tracking', { method: 'PUT', headers: H(), body: JSON.stringify({ gtmId: 'bad', turnstileSecret: 'sec' }) });
  assert.equal(r.status, 422);
  r = await fetch(base + '/api/admin/settings/tracking', { method: 'PUT', headers: H(), body: JSON.stringify({ gtmId: 'GTM-ABC1234', turnstileSecret: '' }) });
  assert.equal(r.status, 200);
  const s = await (await fetch(base + '/api/admin/settings', { headers: H() })).json();
  assert.equal(s.settings.tracking.gtmId, 'GTM-ABC1234');
  assert.match(await (await fetch(base + '/')).text(), /GTM-ABC1234/);
});
