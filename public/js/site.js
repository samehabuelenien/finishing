/* واجهة الزوار: التنقل، المعرض، النموذج، واتساب، وتتبع التحويلات */
(function () {
  'use strict';
  var SITE = window.SITE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- التتبع ---------------- */
  function track(event, params) {
    var data = Object.assign({ event: event }, params || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
    // في حالة عدم استخدام GTM: إرسال مباشر عبر gtag
    if (!SITE.gtmId && typeof window.gtag === 'function') {
      var p = Object.assign({}, params || {});
      window.gtag('event', event, p);
      if (SITE.adsId) {
        if (event === 'generate_lead' && SITE.adsLeadLabel) {
          window.gtag('event', 'conversion', { send_to: SITE.adsId + '/' + SITE.adsLeadLabel, transaction_id: String(p.lead_id || '') });
        }
        if (event === 'whatsapp_click' && SITE.adsWaLabel) {
          window.gtag('event', 'conversion', { send_to: SITE.adsId + '/' + SITE.adsWaLabel });
        }
      }
    }
  }

  /* ---------------- مصدر الزيارة (أول لمسة في الجلسة) ---------------- */
  var ATTR_KEY = 'lead_attr_v1';
  function readAttr() { try { return JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { return null; } }
  (function captureAttr() {
    var q = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
    var fresh = {}, has = false;
    keys.forEach(function (k) { var v = q.get(k); if (v) { fresh[k] = v.slice(0, 200); has = true; } });
    var existing = readAttr();
    if (has || !existing) {
      fresh.referrer = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer.slice(0, 500) : (existing && existing.referrer) || '';
      fresh.landing_page = (location.pathname + location.search).slice(0, 500);
      try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(fresh)); } catch (e) { /* التخزين غير متاح */ }
    }
  })();

  /* ---------------- القائمة ---------------- */
  var menuBtn = $('[data-menu]');
  if (menuBtn) {
    var setMenu = function (open) {
      document.body.classList.toggle('nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    };
    menuBtn.addEventListener('click', function () { setMenu(!document.body.classList.contains('nav-open')); });
    $$('[data-nav] a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------------- النقرات على CTA وواتساب ---------------- */
  document.addEventListener('click', function (e) {
    var wa = e.target.closest('[data-wa]');
    if (wa && wa.getAttribute('href') && wa.getAttribute('href').indexOf('wa.me') > -1) {
      // فتح واتساب فقط — لا يعني أن رسالة أُرسلت
      track('whatsapp_click', { click_location: wa.getAttribute('data-wa') });
    }
    var cta = e.target.closest('[data-cta]');
    if (cta) track('cta_click', { click_location: cta.getAttribute('data-cta') });
    var call = e.target.closest('[data-call]');
    if (call) track('phone_click', { click_location: call.getAttribute('data-call') });
    var svcLink = e.target.closest('[data-service]');
    if (svcLink) {
      var sel = $('#f-service');
      if (sel) { sel.value = svcLink.getAttribute('data-service'); clearErr(sel); }
    }
  });

  /* ---------------- معاينة الخدمات على الشاشات الكبيرة ---------------- */
  var preview = $('.svc-preview-img');
  if (preview) {
    $$('[data-svc]').forEach(function (row) {
      var activate = function () {
        $$('[data-svc]').forEach(function (r) { r.classList.toggle('is-active', r === row); });
        var base = row.getAttribute('data-img');
        if (!base) return;
        var next = base + '-sm.webp';
        if (preview.getAttribute('src') === next) return;
        preview.style.opacity = '0';
        var im = new Image();
        im.onload = function () { preview.src = next; preview.srcset = base + '-sm.webp 800w, ' + base + '.webp 1600w'; preview.alt = row.getAttribute('data-alt') || ''; preview.style.opacity = '1'; };
        im.src = next;
      };
      row.addEventListener('mouseenter', activate);
      row.addEventListener('focusin', activate);
    });
  }

  /* ---------------- تصفية المشاريع ---------------- */
  $$('[data-filters] .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      $$('[data-filters] .chip').forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
      var items = $$('[data-proj-grid] .proj'), visible = [];
      items.forEach(function (p) {
        var show = f === 'all' || p.getAttribute('data-cat') === f;
        p.classList.toggle('is-hidden', !show);
        p.classList.remove('proj-wide');
        if (show) visible.push(p);
      });
      // بطاقات عريضة بعدد يكمل الصفوف في شبكة من 3 أعمدة
      var n = visible.length, w = n > 2 ? (3 - n % 3) % 3 : 0;
      if (w >= 1) visible[0].classList.add('proj-wide');
      if (w === 2) visible[3].classList.add('proj-wide');
    });
  });

  /* ---------------- نافذة تفاصيل المشروع ---------------- */
  var projects = [];
  try { projects = JSON.parse(($('#projects-data') || {}).textContent || '[]'); } catch (e) { projects = []; }
  var pm = $('[data-proj-modal]');
  var src = function (base, big) { return base + (big ? '.webp' : '-sm.webp'); };
  var setSrc = function (el, base) { el.src = src(base, false); el.srcset = src(base, false) + ' 800w, ' + src(base, true) + ' 1600w'; el.sizes = '(min-width: 860px) 60vw, 100vw'; };

  function openProject(id) {
    var p = projects.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p || !pm) return;
    $('[data-pm-title]', pm).textContent = p.title;
    $('[data-pm-cat]', pm).textContent = p.category || '';
    $('[data-pm-desc]', pm).textContent = p.description || '';
    $('[data-pm-demo]', pm).hidden = !p.demo;
    var facts = $('[data-pm-facts]', pm); facts.innerHTML = '';
    [['الموقع', p.location], ['المساحة', p.area]].forEach(function (f) {
      if (!f[1]) return;
      var dt = document.createElement('dt'); dt.textContent = f[0];
      var dd = document.createElement('dd'); dd.textContent = f[1];
      facts.appendChild(dt); facts.appendChild(dd);
    });
    facts.hidden = !facts.children.length;

    var ba = $('[data-ba]', pm), main = $('[data-pm-main]', pm), thumbs = $('[data-pm-thumbs]', pm);
    var hasBA = !!(p.before && p.after);
    ba.hidden = !hasBA;
    if (hasBA) {
      setSrc($('[data-ba-before]', pm), p.before); $('[data-ba-before]', pm).alt = p.title + ' — قبل';
      setSrc($('[data-ba-after]', pm), p.after); $('[data-ba-after]', pm).alt = p.title + ' — بعد';
      setBA(50);
    }
    var imgs = (p.images || []).map(function (x) { return { image: x.image, alt: x.alt || p.title }; });
    if (!imgs.length && p.cover) imgs.push({ image: p.cover, alt: p.title });
    var mainImg = $('[data-pm-img]', pm);
    main.hidden = hasBA || !imgs.length;
    if (imgs.length) { setSrc(mainImg, imgs[0].image); mainImg.alt = imgs[0].alt; }
    thumbs.innerHTML = '';
    var all = imgs.slice();
    if (hasBA && all.length) all.unshift({ ba: true, image: p.after, alt: 'مقارنة قبل وبعد' });
    if (all.length > 1) {
      all.forEach(function (it, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = i === 0 ? 'is-on' : '';
        b.setAttribute('aria-label', it.ba ? 'عرض مقارنة قبل وبعد' : 'عرض الصورة ' + (i + 1));
        var im = document.createElement('img'); im.src = src(it.image, false); im.alt = ''; im.loading = 'lazy';
        b.appendChild(im);
        b.addEventListener('click', function () {
          $$('button', thumbs).forEach(function (x) { x.classList.toggle('is-on', x === b); });
          if (it.ba) { ba.hidden = false; main.hidden = true; } else { ba.hidden = true; main.hidden = false; setSrc(mainImg, it.image); mainImg.alt = it.alt; }
        });
        thumbs.appendChild(b);
      });
    }
    $('[data-similar]', pm).setAttribute('data-title', p.title);
    if (typeof pm.showModal === 'function') pm.showModal(); else pm.setAttribute('open', '');
    track('project_view', { project_title: p.title });
  }
  $$('[data-project]').forEach(function (b) { b.addEventListener('click', function () { openProject(b.getAttribute('data-project')); }); });

  function setBA(v) {
    if (!pm) return;
    v = Math.max(0, Math.min(100, v));
    $('[data-ba-clip]', pm).style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)';
    $('[data-ba-handle]', pm).style.left = v + '%';
    $('[data-ba-range]', pm).value = v;
  }
  if (pm) {
    var range = $('[data-ba-range]', pm);
    range.setAttribute('dir', 'ltr');
    range.addEventListener('input', function () { setBA(Number(range.value)); });
    var stage = $('.ba-stage', pm), dragging = false;
    var fromEvent = function (e) { var r = stage.getBoundingClientRect(); setBA(((e.clientX - r.left) / r.width) * 100); };
    stage.addEventListener('pointerdown', function (e) { dragging = true; stage.setPointerCapture(e.pointerId); fromEvent(e); });
    stage.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    stage.addEventListener('pointerup', function () { dragging = false; });
    $('[data-similar]', pm).addEventListener('click', function () {
      var t = this.getAttribute('data-title'), d = $('#f-details');
      if (d && !d.value) d.value = 'مهتم بتنفيذ مشروع مشابه لـ: ' + t;
      pm.close();
    });
  }
  $$('dialog.modal').forEach(function (d) {
    $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  /* ---------------- شريط الموبايل ---------------- */
  var bar = $('[data-mobile-bar]'), hero = $('.hero'), reqSec = $('#request');
  if (bar && 'IntersectionObserver' in window && hero) {
    var heroVisible = true, formVisible = false;
    var upd = function () { bar.classList.toggle('is-visible', !heroVisible && !formVisible); };
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe(hero);
    if (reqSec) new IntersectionObserver(function (en) { formVisible = en[0].isIntersecting; upd(); }, { threshold: 0.1 }).observe(reqSec);
  }

  /* ---------------- أدوات النماذج ---------------- */
  function clearErr(el) {
    var f = el.closest('.field'); if (!f) return;
    f.classList.remove('has-error');
    var e = $('[data-err]', f); if (e) e.textContent = '';
    if (el.removeAttribute) el.removeAttribute('aria-invalid');
  }
  function showErrors(form, fields) {
    var first = null;
    Object.keys(fields || {}).forEach(function (name) {
      var input = form.elements[name];
      var el = input && (input.length && !input.tagName ? input[0] : input);
      var holder = el ? el.closest('.field') : null;
      var msg = holder ? $('[data-err]', holder) : $('[data-err="' + name + '"]', form);
      if (holder) holder.classList.add('has-error');
      if (msg) msg.textContent = fields[name];
      if (el && el.setAttribute) el.setAttribute('aria-invalid', 'true');
      if (!first && el) first = el;
    });
    if (first) first.focus({ preventScroll: false });
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function toAscii(s) { return String(s || '').replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; }); }
  function setLoading(btn, on) { btn.disabled = on; btn.classList.toggle('is-loading', on); btn.setAttribute('aria-busy', String(on)); }
  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'استجابة غير متوقعة من الخادم.' }; }).then(function (j) { j._status = r.status; return j; }); });
  }

  /* ---------------- نموذج طلب المعاينة ---------------- */
  var form = $('[data-lead-form]');
  if (form) {
    var startedAt = 0, idemKey = uuid(), submitting = false;
    var status = $('[data-status]', form), btn = $('[data-submit]', form);
    form.addEventListener('focusin', function () {
      if (!startedAt) { startedAt = Date.now(); track('form_start', { form_name: 'inspection_request' }); }
    });
    form.addEventListener('input', function (e) { clearErr(e.target); status.textContent = ''; status.classList.remove('is-error'); });
    form.addEventListener('change', function (e) { clearErr(e.target); });

    function clientValidate() {
      var f = form.elements, errs = {};
      if ((f.name.value || '').trim().length < 2) errs.name = 'يرجى كتابة الاسم (حرفان على الأقل).';
      var ph = toAscii(f.phone.value).replace(/[\s\-().]/g, '');
      if (!ph) errs.phone = 'يرجى كتابة رقم الجوال.';
      else if (!/^\+?\d{8,15}$/.test(ph)) errs.phone = 'رقم الجوال غير صحيح. مثال: ' + (f.phone.getAttribute('placeholder') || '');
      if ((f.city.value || '').trim().length < 2) errs.city = 'يرجى كتابة المدينة أو المنطقة.';
      if (!f.service.value) errs.service = 'يرجى اختيار نوع الخدمة.';
      if (!f.property_type.value) errs.property_type = 'يرجى اختيار نوع العقار.';
      var area = toAscii(f.area.value).replace(/[,،\s]/g, '');
      if (area && (!/^\d+(\.\d+)?$/.test(area) || +area < 5)) errs.area = 'اكتب المساحة بالأرقام بالمتر المربع، أو اتركها فارغة.';
      if (!form.querySelector('input[name=contact_time]:checked')) errs.contact_time = 'يرجى اختيار الوقت المناسب للتواصل.';
      if (f.consent && !f.consent.checked) errs.consent = 'يرجى الموافقة على سياسة الخصوصية لإرسال الطلب.';
      return errs;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return; // منع الإرسال المزدوج
      status.textContent = ''; status.classList.remove('is-error');
      var errs = clientValidate();
      if (Object.keys(errs).length) {
        showErrors(form, errs);
        status.textContent = 'يرجى مراجعة الحقول المظللة.'; status.classList.add('is-error');
        track('form_error', { form_name: 'inspection_request', error_fields: Object.keys(errs).join(',') });
        return;
      }
      var f = form.elements;
      var ct = form.querySelector('input[name=contact_time]:checked');
      var ts = form.querySelector('[name="cf-turnstile-response"]');
      var payload = {
        name: f.name.value, phone: f.phone.value, city: f.city.value, service: f.service.value, property_type: f.property_type.value,
        area: f.area.value, budget: f.budget ? f.budget.value : '', contact_time: ct ? ct.value : '', details: f.details.value,
        consent: f.consent ? f.consent.checked : false, company_website: f.company_website.value,
        started_at: startedAt || Date.now(), idempotency_key: idemKey, attribution: readAttr() || {},
        'cf-turnstile-response': ts ? ts.value : undefined,
      };
      submitting = true; setLoading(btn, true);
      status.textContent = 'جارٍ إرسال الطلب…';
      post('/api/leads', payload).then(function (res) {
        if (res.ok && res.leadId) {
          // النجاح يظهر فقط بعد تأكيد الخادم أن الطلب حُفظ في قاعدة البيانات
          if (!res.duplicate) track('generate_lead', { form_name: 'inspection_request', lead_id: res.leadId, service: payload.service, property_type: payload.property_type });
          var ok = $('[data-success]');
          $('[data-lead-id]', ok).textContent = '#' + res.leadId;
          var waBtn = $('[data-wa-after]', ok);
          if (SITE.wa) waBtn.href = 'https://wa.me/' + SITE.wa + '?text=' + encodeURIComponent('مرحبًا، أرسلت طلب معاينة عبر الموقع برقم #' + res.leadId + ' (' + payload.service + '). أرغب في متابعة الطلب.');
          else waBtn.hidden = true;
          form.hidden = true; ok.hidden = false; ok.focus();
          ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (res.fields) showErrors(form, res.fields);
        status.textContent = res.error || 'تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.';
        status.classList.add('is-error');
        if (window.turnstile && ts) try { window.turnstile.reset(); } catch (x) { /* */ }
      }).catch(function () {
        status.textContent = 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة، أو تواصل معنا عبر واتساب.';
        status.classList.add('is-error');
      }).then(function () {
        submitting = false; setLoading(btn, false);
        if (!form.hidden && status.textContent === 'جارٍ إرسال الطلب…') status.textContent = '';
      });
    });
  }

  /* ---------------- نموذج إضافة رأي ---------------- */
  var rvModal = $('[data-review-modal]'), rvForm = $('[data-review-form]');
  $$('[data-open-review]').forEach(function (b) { b.addEventListener('click', function () { if (rvModal) rvModal.showModal(); }); });
  if (rvForm) {
    var rvBusy = false;
    rvForm.addEventListener('input', function (e) { clearErr(e.target); });
    rvForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (rvBusy) return;
      var f = rvForm.elements, st = $('[data-status]', rvForm), b = $('[data-submit]', rvForm);
      var errs = {};
      if (f.name.value.trim().length < 2) errs.name = 'يرجى كتابة الاسم.';
      if (f.text.value.trim().length < 15) errs.text = 'يرجى كتابة رأيك (15 حرفًا على الأقل).';
      if (!f.consent.checked) errs.consent = 'يرجى الموافقة على نشر الاسم والرأي.';
      if (Object.keys(errs).length) { showErrors(rvForm, errs); return; }
      var rating = rvForm.querySelector('input[name=rating]:checked');
      rvBusy = true; setLoading(b, true); st.classList.remove('is-error'); st.textContent = 'جارٍ الإرسال…';
      post('/api/testimonials', { name: f.name.value, city: f.city.value, text: f.text.value, rating: rating ? rating.value : '', consent: f.consent.checked, company_website: f.company_website.value })
        .then(function (res) {
          if (res.ok) { rvForm.reset(); st.textContent = 'شكرًا لك! وصلنا رأيك وسيظهر بعد المراجعة.'; return; }
          if (res.fields) showErrors(rvForm, res.fields);
          st.textContent = res.error || 'تعذر الإرسال.'; st.classList.add('is-error');
        })
        .catch(function () { st.textContent = 'تعذر الاتصال بالخادم.'; st.classList.add('is-error'); })
        .then(function () { rvBusy = false; setLoading(b, false); });
    });
  }
})();
