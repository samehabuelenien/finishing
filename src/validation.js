// تحقق من المدخلات وتطبيع أرقام الهاتف للأسواق المدعومة

const MARKETS = {
  SA: { name: 'السعودية', code: '966', local: /^0?(5\d{8})$/, national: /^5\d{8}$/, example: '05XXXXXXXX' },
  AE: { name: 'الإمارات', code: '971', local: /^0?(5[024568]\d{7})$/, national: /^5[024568]\d{7}$/, example: '05XXXXXXXX' },
  KW: { name: 'الكويت', code: '965', local: /^([569]\d{7})$/, national: /^[569]\d{7}$/, example: 'XXXXXXXX' },
  QA: { name: 'قطر', code: '974', local: /^([3567]\d{7})$/, national: /^[3567]\d{7}$/, example: 'XXXXXXXX' },
  BH: { name: 'البحرين', code: '973', local: /^([36]\d{7})$/, national: /^[36]\d{7}$/, example: 'XXXXXXXX' },
  OM: { name: 'عُمان', code: '968', local: /^([79]\d{7})$/, national: /^[79]\d{7}$/, example: 'XXXXXXXX' },
  EG: { name: 'مصر', code: '20', local: /^0?(1[0125]\d{8})$/, national: /^1[0125]\d{8}$/, example: '01XXXXXXXXX' },
};

function toAsciiDigits(s) {
  return String(s || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** يعيد { ok, e164, display } أو { ok:false } */
function normalizePhone(raw, market = 'SA') {
  let s = toAsciiDigits(raw).replace(/[\s\-().]/g, '');
  if (!s) return { ok: false };
  let intl = false;
  if (s.startsWith('+')) { s = s.slice(1); intl = true; } else if (s.startsWith('00')) { s = s.slice(2); intl = true; }
  if (!/^\d+$/.test(s)) return { ok: false };

  if (intl) {
    for (const m of Object.values(MARKETS)) {
      if (s.startsWith(m.code)) {
        let rest = s.slice(m.code.length);
        if (rest.startsWith('0')) rest = rest.slice(1);
        if (m.national.test(rest)) return { ok: true, e164: `+${m.code}${rest}` };
      }
    }
    return { ok: false };
  }
  const m = MARKETS[market] || MARKETS.SA;
  // رقم محلي بدون + لكن يبدأ بمفتاح الدولة (مثل 9665XXXXXXXX)
  if (s.startsWith(m.code) && m.national.test(s.slice(m.code.length))) return { ok: true, e164: `+${s}` };
  const match = s.match(m.local);
  if (match) return { ok: true, e164: `+${m.code}${match[1]}` };
  return { ok: false };
}

const clean = (v, max) => {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
};

/**
 * يتحقق من بيانات طلب المعاينة. يعيد { data } أو { errors: {field: message} }
 */
function validateLead(body, opts) {
  const { market, services, propertyTypes, budgets, contactTimes, privacyRequired } = opts;
  const errors = {};
  const d = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    city: clean(body.city, 60),
    service: clean(body.service, 120),
    property_type: clean(body.property_type, 60),
    area: clean(body.area, 12),
    budget: clean(body.budget, 60),
    contact_time: clean(body.contact_time, 60),
    details: clean(body.details, 1000),
    consent: body.consent === true || body.consent === 'true' || body.consent === 'on' || body.consent === '1',
  };

  if (d.name.length < 2) errors.name = 'يرجى كتابة الاسم (حرفان على الأقل).';
  else if (!/^[\p{L}\s.'\-]+$/u.test(d.name)) errors.name = 'يرجى كتابة الاسم بالحروف فقط.';

  const p = normalizePhone(d.phone, market);
  if (!d.phone) errors.phone = 'يرجى كتابة رقم الجوال.';
  else if (!p.ok) errors.phone = `رقم الجوال غير صحيح. مثال: ${(MARKETS[market] || MARKETS.SA).example}`;
  else d.phone_e164 = p.e164;

  if (d.city.length < 2) errors.city = 'يرجى كتابة المدينة أو المنطقة.';

  const serviceOptions = [...services, 'أخرى'];
  if (!d.service) errors.service = 'يرجى اختيار نوع الخدمة.';
  else if (!serviceOptions.includes(d.service)) errors.service = 'يرجى اختيار نوع الخدمة من القائمة.';

  if (!d.property_type) errors.property_type = 'يرجى اختيار نوع العقار.';
  else if (!propertyTypes.includes(d.property_type)) errors.property_type = 'يرجى اختيار نوع العقار من القائمة.';

  if (d.area) {
    const n = Number(toAsciiDigits(d.area).replace(/[,،\s]/g, ''));
    if (!Number.isFinite(n) || n < 5 || n > 100000) errors.area = 'اكتب المساحة بالأرقام بالمتر المربع (مثال: 150)، أو اتركها فارغة.';
    else d.area = String(Math.round(n));
  }
  if (d.budget && !budgets.includes(d.budget)) errors.budget = 'يرجى اختيار الميزانية من القائمة.';

  if (!d.contact_time) errors.contact_time = 'يرجى اختيار الوقت المناسب للتواصل.';
  else if (!contactTimes.includes(d.contact_time)) errors.contact_time = 'يرجى اختيار الوقت من القائمة.';

  if (privacyRequired && !d.consent) errors.consent = 'يرجى الموافقة على سياسة الخصوصية لإرسال الطلب.';

  return Object.keys(errors).length ? { errors } : { data: d };
}

function attribution(body) {
  const a = body && typeof body.attribution === 'object' && body.attribution ? body.attribution : {};
  const out = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid']) out[k] = clean(a[k], 200) || null;
  out.referrer = clean(a.referrer, 500) || null;
  out.landing_page = clean(a.landing_page, 500) || null;
  out.channel = deriveChannel(out);
  return out;
}

function deriveChannel(a) {
  const src = (a.utm_source || '').toLowerCase();
  const med = (a.utm_medium || '').toLowerCase();
  if (a.gclid || a.gbraid || a.wbraid || (src.includes('google') && /cpc|ppc|paid/.test(med))) return 'إعلانات Google';
  if (a.fbclid || /facebook|instagram|meta|fb|ig/.test(src)) return /cpc|paid|ads/.test(med) ? 'إعلانات Meta' : 'سوشيال ميديا';
  if (/tiktok|snap|x|twitter|linkedin|youtube/.test(src)) return /cpc|paid|ads/.test(med) ? 'إعلانات سوشيال' : 'سوشيال ميديا';
  if (src) return `حملة: ${a.utm_source}`;
  if (a.referrer) {
    const r = a.referrer.toLowerCase();
    if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(r)) return 'بحث مجاني';
    if (/facebook|instagram|tiktok|snapchat|t\.co|twitter|linkedin|youtube/.test(r)) return 'سوشيال ميديا';
    return 'موقع آخر';
  }
  return 'مباشر';
}

module.exports = { MARKETS, normalizePhone, validateLead, attribution, clean, toAsciiDigits };
