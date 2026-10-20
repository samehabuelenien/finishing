const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, now } = require('./db');

const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const COOKIE = 'sid';
const IS_PROD = process.env.NODE_ENV === 'production';

// صلاحيات كل دور
const PERMISSIONS = {
  admin: ['dashboard', 'leads.view', 'leads.edit', 'leads.export', 'leads.delete', 'content', 'testimonials', 'settings', 'users'],
  sales: ['dashboard', 'leads.view', 'leads.edit'],
  editor: ['dashboard', 'content', 'testimonials'],
};
const can = (user, perm) => !!user && (PERMISSIONS[user.role] || []).includes(perm);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, value, maxAgeSec) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
  if (IS_PROD) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + SESSION_HOURS * 3600e3).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)').run(sha(token), userId, exp, now());
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  setCookie(res, token, SESSION_HOURS * 3600);
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  setCookie(res, '', 0);
}

function loadUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.active, s.expires_at, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token));
  if (!row || !row.active || row.expires_at < now()) return null;
  // تمديد الجلسة عند الاستخدام (sliding)
  const newExp = new Date(Date.now() + SESSION_HOURS * 3600e3).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(newExp, row.token_hash);
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/** حماية CSRF: الطلبات المعدِّلة يجب أن تأتي من نفس الأصل وبترويسة مخصصة */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return res.status(403).json({ error: 'طلب غير مسموح.' });
  const origin = req.get('Origin');
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host !== req.get('host')) return res.status(403).json({ error: 'مصدر الطلب غير مسموح.' });
    } catch { return res.status(403).json({ error: 'مصدر الطلب غير مسموح.' }); }
  }
  next();
}

function requireAuth(req, res, next) {
  const user = loadUser(req);
  if (!user) return res.status(401).json({ error: 'انتهت الجلسة، يرجى تسجيل الدخول.' });
  req.user = user;
  next();
}
const requirePerm = (perm) => (req, res, next) =>
  can(req.user, perm) ? next() : res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء.' });

const MAX_FAILS = 5, LOCK_MIN = 15;
// hash ثابت لمقارنة وهمية عند عدم وجود المستخدم (يقلل فرق التوقيت)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

async function login(email, password) {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  if (!u) { await bcrypt.compare(String(password || ''), DUMMY_HASH); return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }; }
  if (!u.active) return { error: 'هذا الحساب موقوف. تواصل مع مدير النظام.' };
  if (u.locked_until && u.locked_until > now()) return { error: `تم إيقاف الدخول مؤقتًا بسبب محاولات متكررة. حاول بعد ${LOCK_MIN} دقيقة.` };
  const ok = await bcrypt.compare(String(password || ''), u.password_hash);
  if (!ok) {
    const fails = u.failed_attempts + 1;
    const lock = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60e3).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : fails, lock, u.id);
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  }
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(now(), u.id);
  return { user: u };
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.';
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام.';
  return null;
}
const hashPassword = (pw) => bcrypt.hashSync(pw, 12);

module.exports = { PERMISSIONS, can, createSession, destroySession, loadUser, requireAuth, requirePerm, csrfGuard, login, validatePassword, hashPassword, sha };
