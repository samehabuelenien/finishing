require('dotenv').config({ quiet: true });
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { db, migrate } = require('./src/db');
const { seed } = require('./src/seed');
const auth = require('./src/auth');
const { UPLOAD_DIR } = require('./src/images');

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error('SESSION_SECRET مطلوب في بيئة الإنتاج (32 حرفًا على الأقل). راجع ملف .env.example');
  process.exit(1);
}

migrate();
seed();

// إنشاء أول مدير من متغيرات البيئة إن لم يوجد أي مستخدم
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const err = auth.validatePassword(ADMIN_PASSWORD);
    if (err) { console.error('ADMIN_PASSWORD:', err); process.exit(1); }
    db.prepare("INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?,?,?,'admin',1,?)")
      .run(ADMIN_NAME || 'مدير النظام', ADMIN_EMAIL.toLowerCase(), auth.hashPassword(ADMIN_PASSWORD), new Date().toISOString());
    console.log(`تم إنشاء حساب المدير: ${ADMIN_EMAIL}`);
  } else {
    console.warn('⚠ لا يوجد مستخدمون. أنشئ حساب مدير: npm run create-admin');
  }
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
Object.assign(app.locals, require('./src/view-helpers'));

app.use((req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });

const G = ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com',
  'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net', 'https://www.google.com', 'https://*.doubleclick.net'];
const CF = 'https://challenges.cloudflare.com';
const extra = (process.env.CSP_EXTRA_SOURCES || '').split(/\s+/).filter(Boolean);
app.use(helmet({
  contentSecurityPolicy: process.env.CSP_DISABLED === '1' ? false : {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, ...G, CF, ...extra],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", ...G, CF, ...extra],
      'frame-src': [...G, CF, 'https://td.doubleclick.net', ...extra],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '100kb' }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, fallthrough: false }));
app.use('/admin', (req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store'); next(); },
  express.static(path.join(__dirname, 'public', 'admin'), { index: 'index.html' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0 }));

app.use('/api/admin', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, require('./src/routes/admin').router);
app.use(require('./src/routes/public').router);

app.use((req, res) => res.status(404).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>الصفحة غير موجودة</title><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>الصفحة غير موجودة</h1><p><a href="/">العودة للرئيسية</a></p></body></html>'));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'بيانات غير صالحة.' });
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, error: 'حدث خطأ في الخادم.' });
  res.status(500).send('حدث خطأ في الخادم.');
});

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(PORT, () => console.log(`الموقع يعمل على http://localhost:${PORT}  —  لوحة التحكم: http://localhost:${PORT}/admin`));
}
module.exports = app;
