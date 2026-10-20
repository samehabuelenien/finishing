const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * كل صورة تُخزَّن كـ "مسار أساسي" بدون امتداد، ولها نسختان WebP:
 *   <base>.webp     عرض حتى 1600px
 *   <base>-sm.webp  عرض 800px
 */
async function processUpload(buffer) {
  let meta;
  try { meta = await sharp(buffer).metadata(); } catch { throw new Error('الملف ليس صورة صالحة.'); }
  if (!['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'].includes(meta.format)) throw new Error('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.');
  if ((meta.width || 0) < 300) throw new Error('الصورة صغيرة جدًا. الحد الأدنى للعرض 300 بكسل.');
  const name = crypto.randomBytes(10).toString('hex');
  const base = path.join(UPLOAD_DIR, name);
  const img = sharp(buffer, { failOn: 'error' }).rotate(); // تصحيح الاتجاه وحذف بيانات EXIF
  await img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${base}.webp`);
  await img.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${base}-sm.webp`);
  return `/uploads/${name}`;
}

function deleteUpload(baseUrl) {
  if (!baseUrl || !baseUrl.startsWith('/uploads/')) return;
  const name = path.basename(baseUrl);
  if (!/^[a-f0-9]{20}$/.test(name)) return;
  for (const s of ['.webp', '-sm.webp']) fs.rm(path.join(UPLOAD_DIR, name + s), { force: true }, () => {});
}

const isValidImageRef = (v) => v === '' || v === null || /^\/(uploads\/[a-f0-9]{20}|img\/demo\/[a-z0-9-]+)$/.test(v);

module.exports = { processUpload, deleteUpload, isValidImageRef, UPLOAD_DIR };
