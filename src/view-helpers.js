// أدوات مساعدة للقوالب: الأيقونات والصور وروابط واتساب
const P = {
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" fill="currentColor"/>',
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1Z" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  mail: '<path d="M4 6h16v12H4z M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z M12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  arrow: '<path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  snapchat: '<path d="M12 3.5c3 0 4.8 2.2 4.8 5v2.3l1.9-.5c.5.3.4.9-.1 1.2l-1.8.9c.6 1.9 2 3.2 3.4 3.6-.3.8-1.6.9-2.5 1.1-.2.6-.2 1.2-.6 1.3-.8 0-1.8-.4-3 .3-.8.5-1.3 1-2.1 1s-1.3-.5-2.1-1c-1.2-.7-2.2-.3-3-.3-.4-.1-.4-.7-.6-1.3-.9-.2-2.2-.3-2.5-1.1 1.4-.4 2.8-1.7 3.4-3.6l-1.8-.9c-.5-.3-.6-.9-.1-1.2l1.9.5V8.5c0-2.8 1.8-5 4.8-5Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  x: '<path d="M4 4l16 16M20 4 4 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  facebook: '<path d="M14 8h3V4.5h-3a4 4 0 0 0-4 4V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.7c0-.4.3-.7.5-.7Z" fill="currentColor"/>',
  youtube: '<rect x="3" y="6" width="18" height="12" rx="3.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/>',
  linkedin: '<path d="M6.5 9.5V18M6.5 6v.01M10.5 18v-5a3 3 0 0 1 6 0v5M10.5 9.5V18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="currentColor"/>',
};
const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;

/** صورة متجاوبة من "مسار أساسي" له نسختان (-sm.webp و .webp) */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function img(base, alt, { sizes = '100vw', cls = '', eager = false, w = 1600, h = 1100 } = {}) {
  if (!base) return '';
  return `<img class="${cls}" src="${esc(base)}-sm.webp" srcset="${esc(base)}-sm.webp 800w, ${esc(base)}.webp 1600w" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
const waLink = (num, msg) => (num ? `https://wa.me/${String(num).replace(/\D/g, '')}?text=${encodeURIComponent(msg || '')}` : '#request');

module.exports = { icon, img, waLink, esc };
