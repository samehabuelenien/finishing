// إنشاء حساب مدير أو إعادة تعيين كلمة مروره
// الاستخدام: npm run create-admin -- email@example.com "كلمة مرور قوية" "الاسم"
require('dotenv').config({ quiet: true });
const { db, migrate } = require('../src/db');
const { hashPassword, validatePassword } = require('../src/auth');

migrate();
const [email, password, name = 'مدير النظام'] = process.argv.slice(2);
if (!email || !password) {
  console.log('الاستخدام: npm run create-admin -- email@example.com "PASSWORD" "الاسم"');
  process.exit(1);
}
const err = validatePassword(password);
if (err) { console.error(err); process.exit(1); }
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare("UPDATE users SET password_hash = ?, role = 'admin', active = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?").run(hashPassword(password), existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`تم تحديث كلمة مرور المدير: ${email}`);
} else {
  db.prepare("INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?,?,?,'admin',1,?)").run(name, email.toLowerCase(), hashPassword(password), new Date().toISOString());
  console.log(`تم إنشاء حساب المدير: ${email}`);
}
