/* لوحة التحكم — تطبيق صفحة واحدة بدون مكتبات */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var ME = null, STATUSES = {}, SETTINGS_CACHE = null, BADGES = {};

  /* ---------------- أدوات ---------------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var can = function (p) { return ME && ME.permissions.indexOf(p) > -1; };
  var fmtDate = function (iso, withTime) {
    if (!iso) return '';
    var d = new Date(iso);
    var o = { year: 'numeric', month: 'short', day: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    try { return d.toLocaleString('ar-EG', o); } catch (e) { return iso.slice(0, 16).replace('T', ' '); }
  };
  var ICONS = {
    dash: '<path d="M4 13h7V4H4zm9 7h7V11h-7zM4 20h7v-5H4zm9-11h7V4h-7z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    leads: '<path d="M4 5h16v14H4zM4 9h16M9 13h6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    svc: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    proj: '<rect x="3.5" y="5" width="17" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4 16 5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    cat: '<path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    star: '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    steps: '<path d="M5 18h4v-4h4v-4h4V6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    faq: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 16.5v.01" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    quote: '<path d="M5 6h14v10H9l-4 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    users: '<circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.5a3 3 0 0 1 0 5.6M18 14c1.6.6 2.6 2.2 3 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    key: '<circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m11 12 8-8M16 7l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    up: '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    down: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" fill="currentColor"/>',
    phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1Z" fill="currentColor"/>',
  };
  var ic = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; };

  function toast(msg, err) {
    var t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(function () { t.remove(); }, err ? 6000 : 3000);
  }

  function api(method, url, body, isForm) {
    var opt = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } };
    if (body !== undefined) {
      if (isForm) opt.body = body; else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    }
    return fetch('/api/admin' + url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && url.indexOf('/auth/') !== 0) { ME = null; renderLogin(j.error); throw new Error('unauth'); }
        if (!r.ok) { var e = new Error(j.error || 'حدث خطأ غير متوقع.'); e.fields = j.fields; e.status = r.status; throw e; }
        return j;
      });
    });
  }
  var fail = function (e) { if (e && e.message !== 'unauth') toast(e.message || 'تعذر تنفيذ العملية.', true); };

  /* ---------------- تسجيل الدخول ---------------- */
  function renderLogin(msg) {
    document.body.classList.remove('side-open');
    app.innerHTML = '<main class="login"><form class="login-card" id="login-form" novalidate>' +
      '<h1>لوحة التحكم</h1><p class="muted">سجّل الدخول لإدارة الموقع والطلبات.</p>' +
      '<div class="fld"><label for="lg-email">البريد الإلكتروني</label><input type="email" id="lg-email" name="email" autocomplete="username" required class="ltr"></div>' +
      '<div class="fld"><label for="lg-pass">كلمة المرور</label><input type="password" id="lg-pass" name="password" autocomplete="current-password" required class="ltr"></div>' +
      '<p class="e" style="color:var(--danger);min-height:1.5em" id="lg-err" role="alert">' + esc(msg && msg !== 'انتهت الجلسة، يرجى تسجيل الدخول.' ? msg : '') + '</p>' +
      '<button class="btn btn-primary" style="width:100%;min-height:44px" type="submit">تسجيل الدخول</button></form></main>';
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, b = $('button', f);
      if (!f.email.value || !f.password.value) { $('#lg-err').textContent = 'اكتب البريد الإلكتروني وكلمة المرور.'; return; }
      b.disabled = true; b.textContent = 'جارٍ الدخول…';
      api('POST', '/auth/login', { email: f.email.value, password: f.password.value })
        .then(function () { return boot(); })
        .catch(function (err) { $('#lg-err').textContent = err.message; b.disabled = false; b.textContent = 'تسجيل الدخول'; });
    });
    $('#lg-email').focus();
  }

  /* ---------------- الهيكل ---------------- */
  var NAV = [
    { id: 'dashboard', t: 'الرئيسية', i: 'dash', p: 'dashboard' },
    { id: 'leads', t: 'طلبات العملاء', i: 'leads', p: 'leads.view', badge: 'leads' },
    { g: 'محتوى الموقع' },
    { id: 'services', t: 'الخدمات', i: 'svc', p: 'content' },
    { id: 'projects', t: 'المشاريع', i: 'proj', p: 'content' },
    { id: 'categories', t: 'تصنيفات المشاريع', i: 'cat', p: 'content' },
    { id: 'features', t: 'لماذا نحن', i: 'star', p: 'content' },
    { id: 'steps', t: 'مراحل العمل', i: 'steps', p: 'content' },
    { id: 'testimonials', t: 'آراء العملاء', i: 'quote', p: 'testimonials', badge: 'reviews' },
    { id: 'faqs', t: 'الأسئلة الشائعة', i: 'faq', p: 'content' },
    { g: 'الإدارة' },
    { id: 'settings', t: 'الإعدادات', i: 'gear', p: 'settings' },
    { id: 'users', t: 'المستخدمون', i: 'users', p: 'users' },
    { id: 'account', t: 'حسابي', i: 'key' },
  ];
  var ROLE_NAMES = { admin: 'مدير', sales: 'مبيعات', editor: 'محرر محتوى' };

  function renderShell() {
    var nav = NAV.filter(function (n) { return n.g || !n.p || can(n.p); });
    // إخفاء عناوين المجموعات الفارغة
    nav = nav.filter(function (n, i) { return !n.g || (nav[i + 1] && !nav[i + 1].g); });
    app.innerHTML = '<div class="shell"><aside class="side" id="side">' +
      '<a class="brand" href="#/dashboard"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 24V8h16" stroke="#B48A4E" stroke-width="2.5" fill="none"/><path d="M12 24h12V12" stroke="#E7E8E3" stroke-width="2.5" fill="none"/></svg><div><b>لوحة التحكم</b><span>إدارة الموقع والطلبات</span></div></a><nav>' +
      nav.map(function (n) {
        if (n.g) return '<div class="grp">' + n.g + '</div>';
        return '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.i) + '<span>' + n.t + '</span>' + (n.badge ? '<span class="badge" data-badge="' + n.badge + '" hidden></span>' : '') + '</a>';
      }).join('') +
      '<a href="/" target="_blank" rel="noopener">' + ic('ext') + '<span>عرض الموقع</span></a></nav></aside>' +
      '<div class="main"><header class="top"><button class="btn btn-icon menu-toggle" id="menu-toggle" aria-label="القائمة">' + ic('menu') + '</button>' +
      '<strong id="page-title"></strong><div class="who"><span class="name">' + esc(ME.name) + '</span><span class="role">' + ROLE_NAMES[ME.role] + '</span>' +
      '<button class="btn btn-sm" id="logout">تسجيل الخروج</button></div></header><div class="content" id="view"></div></div></div>';
    $('#logout').addEventListener('click', function () { api('POST', '/auth/logout', {}).then(function () { ME = null; renderLogin(); }).catch(fail); });
    $('#menu-toggle').addEventListener('click', function () { document.body.classList.toggle('side-open'); });
    document.addEventListener('click', function (e) { if (document.body.classList.contains('side-open') && !e.target.closest('#side') && !e.target.closest('#menu-toggle')) document.body.classList.remove('side-open'); });
    refreshBadges();
  }

  function refreshBadges() {
    api('GET', '/dashboard').then(function (d) {
      BADGES.leads = d.leads ? d.leads.new : 0; BADGES.reviews = d.content.pendingTestimonials;
      $$('[data-badge]').forEach(function (b) { var n = BADGES[b.getAttribute('data-badge')]; b.hidden = !n; b.textContent = n; });
    }).catch(function () {});
  }

  function view() { return $('#view'); }
  function setTitle(t) { $('#page-title').textContent = t; document.title = t + ' — لوحة التحكم'; }

  /* ---------------- التوجيه ---------------- */
  function route() {
    if (!ME) return;
    var h = (location.hash || '#/dashboard').slice(2).split('/');
    var name = h[0] || 'dashboard';
    var item = NAV.filter(function (n) { return n.id === name; })[0];
    if (!item || (item.p && !can(item.p))) { name = 'dashboard'; }
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === name); });
    document.body.classList.remove('side-open');
    closeOverlay();
    var r = { dashboard: viewDashboard, leads: viewLeads, settings: viewSettings, users: viewUsers, account: viewAccount }[name];
    if (r) r(h[1]); else if (RES[name]) viewResource(name);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------------- الرئيسية ---------------- */
  function viewDashboard() {
    setTitle('الرئيسية');
    view().innerHTML = '<p class="muted">جارٍ تحميل البيانات…</p>';
    api('GET', '/dashboard').then(function (d) {
      var k = '';
      if (d.leads) {
        k += kpi(d.leads.total, 'إجمالي الطلبات', true) + kpi(d.leads.new, 'طلبات جديدة') + kpi(d.leads.inProgress, 'قيد المتابعة') +
          kpi(d.leads.won, 'تحولت إلى عملاء') + kpi(d.leads.last30, 'طلبات آخر 30 يومًا');
      }
      k += kpi(d.content.services, 'خدمات منشورة') + kpi(d.content.projects, 'مشاريع منشورة');
      if (can('testimonials')) k += kpi(d.content.pendingTestimonials, 'آراء بانتظار المراجعة');
      var html = '<div class="page-head"><div><h1>مرحبًا، ' + esc(ME.name) + '</h1><p class="muted">ملخص الموقع والطلبات. الأرقام محسوبة مباشرة من قاعدة البيانات.</p></div></div><div class="kpis">' + k + '</div>';
      if (d.leads) {
        // آخر 14 يومًا
        var days = [], map = {};
        d.leads.daily.forEach(function (x) { map[x.d] = x.c; });
        for (var i = 13; i >= 0; i--) { var dt = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ d: dt, c: map[dt] || 0 }); }
        var max = Math.max.apply(null, days.map(function (x) { return x.c; }).concat([1]));
        var bars = '<div class="bars" role="img" aria-label="عدد الطلبات اليومية آخر 14 يومًا">' + days.map(function (x) {
          return '<div class="b" title="' + x.d + ': ' + x.c + '"><span>' + (x.c || '') + '</span><i style="height:' + Math.round((x.c / max) * 100) + '%"></i></div>';
        }).join('') + '</div><div class="bar-labels">' + days.map(function (x, i) { return '<span>' + (i % 2 ? '' : x.d.slice(8) + '/' + x.d.slice(5, 7)) + '</span>'; }).join('') + '</div>';
        var channels = d.leads.byChannel.length ? '<ul class="hlist">' + d.leads.byChannel.map(function (c) { return '<li><span>' + esc(c.channel) + '</span><b>' + c.c + '</b></li>'; }).join('') + '</ul>' : '<p class="muted">لا توجد طلبات خلال آخر 30 يومًا.</p>';
        html += '<div class="panels"><section class="panel"><h2>الطلبات اليومية <span class="muted small">آخر 14 يومًا</span></h2>' + bars + '</section>' +
          '<section class="panel"><h2>مصادر الطلبات <span class="muted small">آخر 30 يومًا</span></h2>' + channels + '</section></div>';
        html += '<section class="panel" style="margin-top:16px"><h2>أحدث الطلبات <a class="btn btn-sm" href="#/leads">كل الطلبات</a></h2>' +
          (d.leads.recent.length ? leadsTable(d.leads.recent) : '<div class="empty">لم تصل أي طلبات بعد. عند إرسال أول طلب من نموذج الموقع سيظهر هنا.</div>') + '</section>';
      }
      view().innerHTML = html;
      bindLeadRows(view());
    }).catch(fail);
  }
  function kpi(n, l, accent) { return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }
  function stBadge(s) { return '<span class="st st-' + esc(s) + '">' + esc(STATUSES[s] || s) + '</span>'; }

  /* ---------------- الطلبات ---------------- */
  var leadState = { q: '', status: '', service: '', from: '', to: '', page: 1 };
  function leadsTable(rows) {
    return '<div class="table-wrap"><table><thead><tr><th>#</th><th>العميل</th><th>الجوال</th><th>الخدمة</th><th>المدينة</th><th>التاريخ</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="click" data-lead="' + r.id + '" tabindex="0"><td class="num">' + r.id + '</td><td><b>' + esc(r.name) + '</b>' + (r.notes ? ' <span class="muted small">(' + r.notes + ' ملاحظة)</span>' : '') + '</td><td class="num">' + esc(r.phone_e164 || r.phone) + '</td><td>' + esc(r.service) + '</td><td>' + esc(r.city) + '</td><td class="small">' + fmtDate(r.created_at, true) + '</td><td>' + stBadge(r.status) + '</td><td class="small">' + esc(r.channel || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function bindLeadRows(root) {
    $$('[data-lead]', root).forEach(function (tr) {
      var open = function () { openLead(tr.getAttribute('data-lead')); };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
    });
  }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); }

  function viewLeads(openId) {
    setTitle('طلبات العملاء');
    var statusOpts = '<option value="">كل الحالات</option>' + Object.keys(STATUSES).map(function (k) { return '<option value="' + k + '"' + (leadState.status === k ? ' selected' : '') + '>' + STATUSES[k] + '</option>'; }).join('');
    view().innerHTML = '<div class="page-head"><div><h1>طلبات العملاء</h1><p class="muted">كل الطلبات الواردة من نموذج طلب المعاينة في الموقع.</p></div>' +
      (can('leads.export') ? '<button class="btn" id="export">تصدير CSV</button>' : '') + '</div>' +
      '<form class="filters" id="lf"><label class="f q">بحث<input name="q" type="search" placeholder="الاسم أو رقم الجوال" value="' + esc(leadState.q) + '"></label>' +
      '<label class="f">الحالة<select name="status">' + statusOpts + '</select></label>' +
      '<label class="f">الخدمة<select name="service"><option value="">كل الخدمات</option></select></label>' +
      '<label class="f">من<input name="from" type="date" value="' + esc(leadState.from) + '"></label><label class="f">إلى<input name="to" type="date" value="' + esc(leadState.to) + '"></label>' +
      '<button class="btn btn-primary" type="submit">تطبيق</button><button class="btn" type="button" id="lf-reset">مسح</button></form><div id="leads-list"><p class="muted">جارٍ التحميل…</p></div>';
    var f = $('#lf');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      ['q', 'status', 'service', 'from', 'to'].forEach(function (k) { leadState[k] = f[k].value.trim(); });
      leadState.page = 1; loadLeads();
    });
    f.status.addEventListener('change', function () { f.requestSubmit(); });
    f.service.addEventListener('change', function () { f.requestSubmit(); });
    $('#lf-reset').addEventListener('click', function () { leadState = { q: '', status: '', service: '', from: '', to: '', page: 1 }; viewLeads(); });
    if ($('#export')) $('#export').addEventListener('click', function () {
      var p = Object.assign({}, leadState); delete p.page;
      location.href = '/api/admin/leads/export.csv?' + qs(p);
    });
    loadLeads();
    if (openId) openLead(openId);
  }
  function loadLeads() {
    api('GET', '/leads?' + qs(leadState)).then(function (d) {
      var sel = $('#lf') && $('#lf').service;
      if (sel && sel.options.length <= 1) d.services.forEach(function (s) { var o = document.createElement('option'); o.textContent = s; o.value = s; if (s === leadState.service) o.selected = true; sel.appendChild(o); });
      var filtered = leadState.q || leadState.status || leadState.service || leadState.from || leadState.to;
      var box = $('#leads-list'); if (!box) return;
      if (!d.rows.length) { box.innerHTML = '<div class="empty">' + (filtered ? 'لا توجد طلبات تطابق التصفية الحالية.' : 'لا توجد طلبات بعد. ستظهر هنا الطلبات المرسلة من نموذج الموقع.') + '</div>'; return; }
      box.innerHTML = '<p class="muted small">' + d.total + ' طلب</p>' + leadsTable(d.rows) +
        (d.pages > 1 ? '<div class="pager"><button class="btn btn-sm" data-pg="' + (d.page - 1) + '"' + (d.page <= 1 ? ' disabled' : '') + '>السابق</button><span>صفحة ' + d.page + ' من ' + d.pages + '</span><button class="btn btn-sm" data-pg="' + (d.page + 1) + '"' + (d.page >= d.pages ? ' disabled' : '') + '>التالي</button></div>' : '');
      bindLeadRows(box);
      $$('[data-pg]', box).forEach(function (b) { b.addEventListener('click', function () { leadState.page = +b.getAttribute('data-pg'); loadLeads(); }); });
    }).catch(fail);
  }

  var overlay = null, lastFocus = null;
  function closeOverlay() { if (overlay) { overlay.forEach(function (n) { n.remove(); }); overlay = null; document.removeEventListener('keydown', escClose); if (lastFocus) lastFocus.focus(); } }
  function escClose(e) { if (e.key === 'Escape') closeOverlay(); }
  function openDrawer(title, bodyHtml, headExtra) {
    closeOverlay(); lastFocus = document.activeElement;
    var bg = document.createElement('div'); bg.className = 'drawer-bg';
    var dr = document.createElement('aside'); dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-label', title);
    dr.innerHTML = '<div class="drawer-head"><h2>' + esc(title) + '</h2>' + (headExtra || '') + '<button class="btn btn-icon" data-x aria-label="إغلاق">' + ic('close') + '</button></div><div class="drawer-body">' + bodyHtml + '</div>';
    document.body.appendChild(bg); document.body.appendChild(dr); overlay = [bg, dr];
    bg.addEventListener('click', closeOverlay); $('[data-x]', dr).addEventListener('click', closeOverlay);
    document.addEventListener('keydown', escClose);
    $('[data-x]', dr).focus();
    return dr;
  }
  function openModal(title, bodyHtml) {
    closeOverlay(); lastFocus = document.activeElement;
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="drawer-head"><h2>' + esc(title) + '</h2><button class="btn btn-icon" data-x aria-label="إغلاق">' + ic('close') + '</button></div><div class="drawer-body">' + bodyHtml + '</div></div>';
    document.body.appendChild(bg); overlay = [bg];
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeOverlay(); });
    $('[data-x]', bg).addEventListener('click', closeOverlay);
    document.addEventListener('keydown', escClose);
    var first = $('input, select, textarea', bg); (first || $('[data-x]', bg)).focus();
    return $('.modal', bg);
  }

  var EVENT_NAMES = { created: 'تم استلام الطلب من الموقع', status: 'تغيير الحالة', whatsapp_opened: 'فتح محادثة واتساب' };
  function openLead(id) {
    api('GET', '/leads/' + id).then(function (d) {
      var l = d.lead, editable = can('leads.edit');
      var waNum = (l.phone_e164 || '').replace(/\D/g, '');
      var company = (SETTINGS_CACHE && SETTINGS_CACHE.company && SETTINGS_CACHE.company.name) || '';
      var waText = 'مرحبًا ' + l.name + '، معك فريق ' + (company || 'الشركة') + ' بخصوص طلب المعاينة رقم #' + l.id + ' (' + l.service + ').';
      var src = [['القناة', l.channel], ['utm_source', l.utm_source], ['utm_medium', l.utm_medium], ['utm_campaign', l.utm_campaign], ['utm_term', l.utm_term], ['utm_content', l.utm_content],
        ['gclid', l.gclid], ['gbraid', l.gbraid], ['wbraid', l.wbraid], ['fbclid', l.fbclid], ['صفحة الهبوط', l.landing_page], ['المُحيل', l.referrer]].filter(function (x) { return x[1]; });
      var body =
        '<div class="sec"><div class="actions-row">' +
        '<a class="btn btn-wa" target="_blank" rel="noopener" data-wa href="https://wa.me/' + waNum + '?text=' + encodeURIComponent(waText) + '">' + ic('wa') + ' فتح واتساب</a>' +
        '<a class="btn" href="tel:' + esc(l.phone_e164) + '">' + ic('phone') + ' اتصال</a>' +
        (can('leads.delete') ? '<button class="btn btn-danger" data-del style="margin-inline-start:auto">حذف الطلب</button>' : '') + '</div>' +
        '<p class="muted small" style="margin:8px 0 0">فتح واتساب لا يعني أن الرسالة أُرسلت؛ غيّر الحالة يدويًا بعد التواصل.</p></div>' +
        '<div class="sec"><h3>الحالة</h3>' + (editable ? '<select id="ld-status" class="fld" style="min-height:40px;padding:6px 10px;border:1px solid #CFD2CB;border-radius:6px;width:100%">' +
          Object.keys(STATUSES).map(function (k) { return '<option value="' + k + '"' + (k === l.status ? ' selected' : '') + '>' + STATUSES[k] + '</option>'; }).join('') + '</select>' : stBadge(l.status)) + '</div>' +
        '<div class="sec"><h3>بيانات الطلب</h3><dl class="kv">' + [['الاسم', l.name], ['الجوال', '<span dir="ltr">' + esc(l.phone_e164) + '</span>', 1], ['كما كتبه العميل', '<span dir="ltr">' + esc(l.phone) + '</span>', 1], ['المدينة', l.city], ['الخدمة', l.service], ['نوع العقار', l.property_type],
          ['المساحة', l.area ? l.area + ' م²' : '—'], ['الميزانية', l.budget || '—'], ['وقت التواصل', l.contact_time], ['التفاصيل', l.details || '—'], ['الموافقة على الخصوصية', l.consent ? 'نعم' : 'لا'], ['تاريخ الطلب', fmtDate(l.created_at, true)]]
          .map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + (x[2] ? x[1] : esc(x[1])) + '</dd>'; }).join('') + '</dl></div>' +
        '<div class="sec"><h3>المصدر التسويقي</h3>' + (src.length ? '<dl class="kv">' + src.map(function (x) { return '<dt>' + x[0] + '</dt><dd class="small" dir="auto">' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' : '<p class="muted">لا تتوفر بيانات مصدر لهذا الطلب.</p>') + '</div>' +
        '<div class="sec"><h3>الملاحظات الداخلية</h3>' + (editable ? '<form id="note-form"><div class="fld"><label class="sr-only" for="note">ملاحظة</label><textarea id="note" name="note" maxlength="2000" placeholder="اكتب ملاحظة لا يراها العميل…" required></textarea></div><button class="btn btn-primary btn-sm" type="submit">إضافة الملاحظة</button></form>' : '') +
        '<ul class="notes">' + (d.notes.length ? d.notes.map(function (n) { return '<li><div style="white-space:pre-wrap">' + esc(n.note) + '</div><div class="meta">' + esc(n.author || '—') + ' · ' + fmtDate(n.created_at, true) + '</div></li>'; }).join('') : '<li class="muted">لا توجد ملاحظات.</li>') + '</ul></div>' +
        '<div class="sec"><h3>سجل الطلب</h3><ul class="timeline">' + d.events.map(function (e) {
          var t = EVENT_NAMES[e.type] || e.type;
          if (e.type === 'status') t += ': ' + (STATUSES[e.from_status] || '') + ' ← ' + (STATUSES[e.to_status] || '');
          return '<li>' + esc(t) + '<div class="muted small">' + esc(e.author || 'النظام') + ' · ' + fmtDate(e.created_at, true) + '</div></li>';
        }).join('') + '</ul></div>';
      var dr = openDrawer('طلب #' + l.id + ' — ' + l.name, body);
      var st = $('#ld-status', dr);
      if (st) st.addEventListener('change', function () {
        api('PATCH', '/leads/' + l.id, { status: st.value }).then(function () { toast('تم تحديث الحالة إلى: ' + STATUSES[st.value]); afterLeadChange(l.id); }).catch(fail);
      });
      var nf = $('#note-form', dr);
      if (nf) nf.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!nf.note.value.trim()) return;
        api('POST', '/leads/' + l.id + '/notes', { note: nf.note.value }).then(function () { toast('تمت إضافة الملاحظة.'); afterLeadChange(l.id); }).catch(fail);
      });
      var wa = $('[data-wa]', dr);
      if (wa && editable) wa.addEventListener('click', function () { api('POST', '/leads/' + l.id + '/whatsapp', {}).catch(function () {}); });
      var del = $('[data-del]', dr);
      if (del) del.addEventListener('click', function () {
        if (!confirm('حذف الطلب #' + l.id + ' نهائيًا مع ملاحظاته؟ لا يمكن التراجع.')) return;
        api('DELETE', '/leads/' + l.id).then(function () { toast('تم حذف الطلب.'); closeOverlay(); refreshCurrent(); }).catch(fail);
      });
    }).catch(fail);
  }
  function afterLeadChange(id) { refreshBadges(); refreshCurrent(); openLead(id); }
  function refreshCurrent() { if ($('#leads-list')) loadLeads(); else if (location.hash.indexOf('dashboard') > -1 || !location.hash) viewDashboard(); }

  /* ---------------- إدارة المحتوى (عام) ---------------- */
  var RES = {
    services: { title: 'الخدمات', sub: 'تظهر في قسم «ما الذي ننفذه» وفي قائمة نوع الخدمة بالنموذج.', single: 'خدمة', thumb: 'image', cols: [['title', 'الخدمة'], ['published', 'الحالة']],
      fields: [{ k: 'title', l: 'اسم الخدمة', req: 1, max: 120 }, { k: 'description', l: 'الوصف', t: 'textarea', max: 600 }, { k: 'image', l: 'الصورة', t: 'image' }, { k: 'published', l: 'منشورة في الموقع', t: 'bool', def: 1 }] },
    projects: { title: 'المشاريع', sub: 'معرض الأعمال. أضف صورة قبل وصورة بعد لتفعيل منزلق المقارنة.', single: 'مشروع', thumb: 'cover_image', cols: [['title', 'المشروع'], ['category_id', 'التصنيف'], ['published', 'الحالة']],
      fields: [{ k: 'title', l: 'اسم المشروع', req: 1, max: 120 }, { k: 'category_id', l: 'التصنيف', t: 'category' }, { k: 'location', l: 'الموقع / الحي', max: 80 }, { k: 'area', l: 'المساحة', max: 40, hint: 'مثال: 180 م²' },
        { k: 'summary', l: 'وصف مختصر', t: 'textarea', max: 300 }, { k: 'description', l: 'تفاصيل المشروع', t: 'textarea', max: 3000 },
        { k: 'cover_image', l: 'صورة الغلاف', t: 'image' }, { k: 'before_image', l: 'صورة قبل', t: 'image' }, { k: 'after_image', l: 'صورة بعد', t: 'image' },
        { k: 'is_demo', l: 'مشروع توضيحي (يظهر عليه وسم «توضيحي»)', t: 'bool', def: 0 }, { k: 'published', l: 'منشور في الموقع', t: 'bool', def: 1 }], gallery: true },
    categories: { title: 'تصنيفات المشاريع', sub: 'تُستخدم كفلاتر في معرض المشاريع.', single: 'تصنيف', cols: [['name', 'التصنيف']], fields: [{ k: 'name', l: 'اسم التصنيف', req: 1, max: 60 }] },
    features: { title: 'لماذا نحن', sub: 'المزايا التي تظهر في قسم «لماذا يختارنا العملاء».', single: 'ميزة', cols: [['title', 'الميزة'], ['published', 'الحالة']],
      fields: [{ k: 'title', l: 'العنوان', req: 1, max: 100 }, { k: 'description', l: 'الوصف', t: 'textarea', max: 400 }, { k: 'published', l: 'منشورة', t: 'bool', def: 1 }] },
    steps: { title: 'مراحل العمل', sub: 'تظهر مرقمة حسب ترتيبها هنا.', single: 'مرحلة', cols: [['title', 'المرحلة'], ['published', 'الحالة']],
      fields: [{ k: 'title', l: 'العنوان', req: 1, max: 100 }, { k: 'description', l: 'الوصف', t: 'textarea', max: 400 }, { k: 'published', l: 'منشورة', t: 'bool', def: 1 }] },
    faqs: { title: 'الأسئلة الشائعة', sub: 'تظهر في الموقع وتُضاف تلقائيًا كبيانات منظمة (FAQPage) لمحركات البحث.', single: 'سؤال', cols: [['question', 'السؤال'], ['published', 'الحالة']],
      fields: [{ k: 'question', l: 'السؤال', req: 1, max: 200 }, { k: 'answer', l: 'الإجابة', t: 'textarea', req: 1, max: 1500 }, { k: 'published', l: 'منشور', t: 'bool', def: 1 }] },
    testimonials: { title: 'آراء العملاء', sub: 'لا يظهر الرأي في الموقع إلا إذا كانت حالته «معتمد» ووافق العميل على النشر.', single: 'رأي', cols: [['name', 'العميل'], ['text', 'الرأي'], ['status', 'الحالة']],
      fields: [{ k: 'name', l: 'اسم العميل', req: 1, max: 60 }, { k: 'city', l: 'المدينة', max: 60 }, { k: 'service', l: 'الخدمة', max: 120 }, { k: 'text', l: 'نص الرأي', t: 'textarea', req: 1, max: 600 },
        { k: 'rating', l: 'التقييم', t: 'select', opts: [['', 'بدون تقييم'], ['5', '5'], ['4', '4'], ['3', '3'], ['2', '2'], ['1', '1']] },
        { k: 'status', l: 'الحالة', t: 'select', opts: [['pending', 'بانتظار المراجعة'], ['approved', 'معتمد (يظهر في الموقع)'], ['rejected', 'مرفوض']], def: 'pending' },
        { k: 'consent', l: 'العميل وافق على نشر اسمه ورأيه', t: 'bool', def: 0, hint: 'مطلوب لظهور الرأي في الموقع.' }] },
  };
  var CATS = [];

  function viewResource(name) {
    var R = RES[name];
    setTitle(R.title);
    view().innerHTML = '<div class="page-head"><div><h1>' + R.title + '</h1><p class="muted">' + R.sub + '</p></div><button class="btn btn-primary" id="add">إضافة ' + R.single + '</button></div><div id="res-list"><p class="muted">جارٍ التحميل…</p></div>';
    $('#add').addEventListener('click', function () { openEditor(name, null); });
    loadResource(name);
  }
  function loadResource(name) {
    var R = RES[name];
    var catP = name === 'projects' ? api('GET', '/categories').then(function (c) { CATS = c.rows; }) : Promise.resolve();
    catP.then(function () { return api('GET', '/' + name); }).then(function (d) {
      R.rows = d.rows;
      var box = $('#res-list'); if (!box) return;
      if (!d.rows.length) { box.innerHTML = '<div class="empty">لا توجد عناصر بعد. اضغط «إضافة ' + R.single + '» للبدء.</div>'; return; }
      var orderable = name !== 'testimonials';
      box.innerHTML = '<div class="table-wrap"><table><thead><tr>' + (R.thumb ? '<th>الصورة</th>' : '') + R.cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + (orderable ? '<th>الترتيب</th>' : '') + '<th></th></tr></thead><tbody>' +
        d.rows.map(function (r, i) {
          var cells = R.cols.map(function (c) {
            var v = r[c[0]];
            if (c[0] === 'published') return '<td><button class="link-btn" data-toggle="' + r.id + '" title="تبديل حالة النشر">' + (v ? '<span class="st st-on">منشور</span>' : '<span class="st st-off">مخفي</span>') + '</button></td>';
            if (c[0] === 'status') return '<td><span class="st st-' + v + '">' + { pending: 'بانتظار المراجعة', approved: 'معتمد', rejected: 'مرفوض' }[v] + '</span>' + (!r.consent ? '<div class="small" style="color:var(--danger)">بدون موافقة نشر</div>' : '') + (r.source === 'website' ? '<div class="small muted">من الموقع</div>' : '') + '</td>';
            if (c[0] === 'category_id') { var cat = CATS.filter(function (x) { return x.id === v; })[0]; return '<td>' + esc(cat ? cat.name : '—') + '</td>'; }
            if (c[0] === 'text') return '<td class="small" style="max-width:380px">' + esc(String(v).slice(0, 140)) + (String(v).length > 140 ? '…' : '') + '</td>';
            return '<td><b>' + esc(v) + '</b>' + (r.is_demo ? ' <span class="st st-off">توضيحي</span>' : '') + '</td>';
          }).join('');
          var th = R.thumb ? '<td>' + (r[R.thumb] ? '<img class="thumb" src="' + esc(r[R.thumb]) + '-sm.webp" alt="">' : '<span class="thumb"></span>') + '</td>' : '';
          var ord = orderable ? '<td><button class="btn btn-icon btn-sm" data-move="' + i + ':-1" aria-label="تحريك لأعلى"' + (i === 0 ? ' disabled' : '') + '>' + ic('up') + '</button> <button class="btn btn-icon btn-sm" data-move="' + i + ':1" aria-label="تحريك لأسفل"' + (i === d.rows.length - 1 ? ' disabled' : '') + '>' + ic('down') + '</button></td>' : '';
          var quick = name === 'testimonials' && r.status !== 'approved' ? '<button class="btn btn-sm" data-approve="' + r.id + '"' + (!r.consent ? ' disabled title="لا توجد موافقة نشر"' : '') + '>اعتماد</button> ' : '';
          return '<tr>' + th + cells + ord + '<td style="white-space:nowrap">' + quick + '<button class="btn btn-sm" data-edit="' + r.id + '">تعديل</button> <button class="btn btn-sm btn-danger" data-delete="' + r.id + '">حذف</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      $$('[data-edit]', box).forEach(function (b) { b.addEventListener('click', function () { openEditor(name, +b.getAttribute('data-edit')); }); });
      $$('[data-delete]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('حذف هذا العنصر نهائيًا؟')) return;
          api('DELETE', '/' + name + '/' + b.getAttribute('data-delete')).then(function () { toast('تم الحذف.'); loadResource(name); refreshBadges(); }).catch(fail);
        });
      });
      $$('[data-toggle]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var r = R.rows.filter(function (x) { return x.id === +b.getAttribute('data-toggle'); })[0];
          api('PUT', '/' + name + '/' + r.id, { published: !r.published }).then(function () { toast(r.published ? 'تم إخفاء العنصر من الموقع.' : 'تم نشر العنصر.'); loadResource(name); }).catch(fail);
        });
      });
      $$('[data-approve]', box).forEach(function (b) {
        b.addEventListener('click', function () { api('PUT', '/testimonials/' + b.getAttribute('data-approve'), { status: 'approved' }).then(function () { toast('تم اعتماد الرأي ونشره.'); loadResource(name); refreshBadges(); }).catch(fail); });
      });
      $$('[data-move]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = b.getAttribute('data-move').split(':'), i = +p[0], j = i + +p[1];
          var ids = R.rows.map(function (x) { return x.id; }); var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
          api('POST', '/reorder/' + name, { ids: ids }).then(function () { loadResource(name); }).catch(fail);
        });
      });
    }).catch(fail);
  }

  function fieldHtml(f, val) {
    var id = 'fld-' + f.k, v = val === undefined || val === null ? (f.def !== undefined ? f.def : '') : val;
    var lbl = '<label for="' + id + '">' + esc(f.l) + (f.req ? ' <span style="color:var(--danger)">*</span>' : '') + '</label>';
    var hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    var err = '<span class="e" data-e="' + f.k + '"></span>';
    var full = f.t === 'textarea' || f.t === 'image' || f.t === 'bool' || f.full ? ' full' : '';
    if (f.t === 'bool') return '<div class="fld' + full + '"><label class="switch"><input type="checkbox" id="' + id + '" name="' + f.k + '"' + (v ? ' checked' : '') + '> ' + esc(f.l) + '</label>' + hint + err + '</div>';
    if (f.t === 'textarea') return '<div class="fld' + full + '">' + lbl + '<textarea id="' + id + '" name="' + f.k + '" maxlength="' + (f.max || 5000) + '"' + (f.tall ? ' class="tall"' : '') + (f.ltr ? ' dir="ltr"' : '') + '>' + esc(v) + '</textarea>' + hint + err + '</div>';
    if (f.t === 'select' || f.t === 'category') {
      var opts = f.t === 'category' ? [['', 'بدون تصنيف']].concat(CATS.map(function (c) { return [String(c.id), c.name]; })) : f.opts;
      return '<div class="fld' + full + '">' + lbl + '<select id="' + id + '" name="' + f.k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + hint + err + '</div>';
    }
    if (f.t === 'image') {
      return '<div class="fld full" data-img-field="' + f.k + '"><label>' + esc(f.l) + '</label><div class="img-field"><div class="pv" data-pv' + (v ? ' style="background-image:url(\'' + esc(v) + '-sm.webp\')"' : '') + '>' + (v ? '' : 'لا توجد صورة') + '</div>' +
        '<div class="btns"><label class="btn btn-sm">رفع صورة<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-file></label>' +
        '<button type="button" class="btn btn-sm btn-danger" data-clear' + (v ? '' : ' hidden') + '>إزالة الصورة</button></div><input type="hidden" name="' + f.k + '" value="' + esc(v) + '"></div><span class="hint">JPG أو PNG أو WebP حتى 10 ميجابايت. تُضغط تلقائيًا وتُحوَّل إلى WebP.</span>' + err + '</div>';
    }
    if (f.t === 'list') return '<div class="fld' + full + ' full">' + lbl + '<textarea id="' + id + '" name="' + f.k + '" rows="5">' + esc((v || []).join('\n')) + '</textarea><span class="hint">عنصر واحد في كل سطر.</span>' + hint + err + '</div>';
    return '<div class="fld' + full + '">' + lbl + '<input type="' + (f.t || 'text') + '" id="' + id + '" name="' + f.k + '" value="' + esc(v) + '"' + (f.max ? ' maxlength="' + f.max + '"' : '') + (f.ltr ? ' class="ltr" dir="ltr"' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>' + hint + err + '</div>';
  }
  function bindImageFields(root) {
    $$('[data-img-field]', root).forEach(function (w) {
      var hidden = $('input[type=hidden]', w), pv = $('[data-pv]', w), clr = $('[data-clear]', w), file = $('[data-file]', w);
      file.addEventListener('change', function () {
        if (!file.files[0]) return;
        var fd = new FormData(); fd.append('file', file.files[0]);
        pv.textContent = 'جارٍ الرفع…'; pv.style.backgroundImage = '';
        api('POST', '/uploads', fd, true).then(function (r) {
          hidden.value = r.image; pv.textContent = ''; pv.style.backgroundImage = "url('" + r.image + "-sm.webp')"; clr.hidden = false;
        }).catch(function (e) { pv.textContent = hidden.value ? '' : 'لا توجد صورة'; if (hidden.value) pv.style.backgroundImage = "url('" + hidden.value + "-sm.webp')"; fail(e); })
          .then(function () { file.value = ''; });
      });
      clr.addEventListener('click', function () { hidden.value = ''; pv.style.backgroundImage = ''; pv.textContent = 'لا توجد صورة'; clr.hidden = true; });
    });
  }
  function readForm(form, fields) {
    var out = {};
    fields.forEach(function (f) {
      var el = form.elements[f.k]; if (!el) return;
      if (f.t === 'bool') out[f.k] = el.checked;
      else if (f.t === 'list') out[f.k] = el.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      else out[f.k] = el.value;
    });
    return out;
  }
  function showFieldErrors(form, fields) {
    $$('.fld.err', form).forEach(function (x) { x.classList.remove('err'); });
    $$('[data-e]', form).forEach(function (x) { x.textContent = ''; });
    Object.keys(fields || {}).forEach(function (k) {
      var e = $('[data-e="' + k + '"]', form); if (!e) return;
      e.textContent = fields[k]; e.closest('.fld').classList.add('err');
    });
    var first = $('.fld.err input, .fld.err select, .fld.err textarea', form); if (first) first.focus();
  }

  function openEditor(name, id) {
    var R = RES[name];
    var row = id ? R.rows.filter(function (r) { return r.id === id; })[0] : null;
    var body = '<form id="ed-form" novalidate><div class="form-grid">' + R.fields.map(function (f) { return fieldHtml(f, row ? row[f.k] : undefined); }).join('') + '</div>' +
      (R.gallery && row ? '<div class="sec" style="margin-top:8px"><h3>معرض صور المشروع</h3><div class="gallery" id="gal"></div><label class="btn btn-sm" style="margin-top:10px">إضافة صورة للمعرض<input type="file" accept="image/jpeg,image/png,image/webp" hidden id="gal-file" multiple></label></div>' : '') +
      (R.gallery && !row ? '<p class="notice">احفظ المشروع أولًا، ثم أضف صور المعرض.</p>' : '') +
      '<div class="form-foot"><button class="btn btn-primary" type="submit">' + (row ? 'حفظ التعديلات' : 'إضافة') + '</button><button class="btn" type="button" data-cancel>إلغاء</button><span class="msg muted" data-msg></span></div></form>';
    var m = openModal((row ? 'تعديل ' : 'إضافة ') + R.single, body);
    var form = $('#ed-form', m);
    bindImageFields(form);
    $('[data-cancel]', form).addEventListener('click', closeOverlay);
    if (R.gallery && row) renderGallery(row);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = readForm(form, R.fields), btn = $('button[type=submit]', form);
      btn.disabled = true;
      (row ? api('PUT', '/' + name + '/' + row.id, data) : api('POST', '/' + name, data)).then(function (res) {
        toast(row ? 'تم حفظ التعديلات.' : 'تمت الإضافة.');
        closeOverlay(); loadResource(name); refreshBadges();
        if (!row && R.gallery) setTimeout(function () { api('GET', '/' + name).then(function (d) { R.rows = d.rows; openEditor(name, res.id); }); }, 150);
      }).catch(function (err) { btn.disabled = false; if (err.fields) showFieldErrors(form, err.fields); fail(err); });
    });
  }
  function renderGallery(project) {
    var gal = $('#gal'); if (!gal) return;
    var imgs = project.images || [];
    gal.innerHTML = imgs.length ? imgs.map(function (g) {
      return '<div class="g"><img src="' + esc(g.image) + '-sm.webp" alt=""><button type="button" class="btn btn-icon btn-sm btn-danger del" data-gdel="' + g.id + '" aria-label="حذف الصورة">' + ic('close') + '</button><input data-galt="' + g.id + '" value="' + esc(g.alt) + '" placeholder="وصف الصورة (لمحركات البحث)" maxlength="150"></div>';
    }).join('') : '<p class="muted small">لا توجد صور في المعرض بعد.</p>';
    var reload = function () { api('GET', '/projects').then(function (d) { RES.projects.rows = d.rows; var p = d.rows.filter(function (x) { return x.id === project.id; })[0]; if (p) renderGallery(p); }); };
    $$('[data-gdel]', gal).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('حذف الصورة من المعرض؟')) return; api('DELETE', '/projects/' + project.id + '/images/' + b.getAttribute('data-gdel')).then(reload).catch(fail); }); });
    $$('[data-galt]', gal).forEach(function (inp) { inp.addEventListener('change', function () { api('PUT', '/projects/' + project.id + '/images/' + inp.getAttribute('data-galt'), { alt: inp.value }).then(function () { toast('تم حفظ وصف الصورة.'); }).catch(fail); }); });
    var file = $('#gal-file');
    if (file && !file._bound) {
      file._bound = true;
      file.addEventListener('change', function () {
        var files = Array.prototype.slice.call(file.files); file.value = '';
        var chain = Promise.resolve();
        files.forEach(function (fl) {
          chain = chain.then(function () {
            var fd = new FormData(); fd.append('file', fl);
            return api('POST', '/uploads', fd, true).then(function (r) { return api('POST', '/projects/' + project.id + '/images', { image: r.image, alt: project.title }); });
          });
        });
        toast('جارٍ رفع ' + files.length + ' صورة…');
        chain.then(function () { toast('تمت إضافة الصور.'); reload(); }).catch(function (e) { fail(e); reload(); });
      });
    }
  }

  /* ---------------- الإعدادات ---------------- */
  var SETTINGS_TABS = [
    { id: 'company', t: 'بيانات الشركة', fields: [
      { k: 'name', l: 'اسم الشركة', max: 80 }, { k: 'shortName', l: 'الاسم المختصر (يظهر في الشعار النصي)', max: 30 }, { k: 'tagline', l: 'الوصف المختصر تحت الاسم', max: 80 },
      { k: 'serviceArea', l: 'نطاق الخدمة', max: 120, ph: 'مثال: الرياض وما حولها' },
      { k: 'whatsapp', l: 'رقم واتساب (دولي بدون +)', ltr: 1, ph: '9665XXXXXXXX', hint: 'يُستخدم في كل أزرار واتساب بالموقع.' }, { k: 'phone', l: 'رقم الاتصال الظاهر', ltr: 1, max: 30 },
      { k: 'whatsappMessage', l: 'رسالة واتساب الافتراضية', t: 'textarea', max: 400 },
      { k: 'email', l: 'البريد الإلكتروني', t: 'email', ltr: 1 }, { k: 'workingHours', l: 'مواعيد العمل', max: 120 }, { k: 'address', l: 'العنوان', max: 200, full: 1 },
      { k: 'logoImage', l: 'الشعار (اختياري — بدونه يظهر الشعار النصي)', t: 'image' },
      { k: 'socials.instagram', l: 'إنستغرام', ltr: 1, ph: 'https://' }, { k: 'socials.tiktok', l: 'تيك توك', ltr: 1, ph: 'https://' }, { k: 'socials.snapchat', l: 'سناب شات', ltr: 1, ph: 'https://' },
      { k: 'socials.x', l: 'إكس', ltr: 1, ph: 'https://' }, { k: 'socials.facebook', l: 'فيسبوك', ltr: 1, ph: 'https://' }, { k: 'socials.youtube', l: 'يوتيوب', ltr: 1, ph: 'https://' }, { k: 'socials.linkedin', l: 'لينكدإن', ltr: 1, ph: 'https://' },
      { k: 'demoMode', l: 'إظهار شريط «نسخة تجريبية» أعلى الموقع', t: 'bool', hint: 'أوقفه بعد استبدال البيانات والصور التجريبية.' }] },
    { id: 'hero', t: 'القسم الرئيسي', fields: [
      { k: 'title', l: 'العنوان الرئيسي (H1)', max: 140, full: 1 }, { k: 'subtitle', l: 'الوصف', t: 'textarea', max: 400 },
      { k: 'primaryCta', l: 'نص زر المعاينة', max: 40 }, { k: 'secondaryCta', l: 'نص زر واتساب', max: 40 },
      { k: 'image', l: 'صورة القسم الرئيسي', t: 'image' }, { k: 'imageAlt', l: 'وصف الصورة (Alt)', max: 150 }, { k: 'dimensionLabel', l: 'نص خط القياس فوق الصورة', max: 60, ph: 'مثال: صالة معيشة · 6.40 × 4.20 م' }] },
    { id: 'trust', t: 'نقاط الثقة', fields: [{ k: 'items', l: 'النقاط تحت أزرار القسم الرئيسي (حتى 4 تظهر)', t: 'list', hint: 'تجنب الأرقام والإحصاءات غير الموثقة.' }] },
    { id: 'sections', t: 'عناوين الأقسام', fields: [
      ['servicesTitle', 'عنوان الخدمات'], ['servicesSubtitle', 'وصف الخدمات'], ['projectsTitle', 'عنوان المشاريع'], ['projectsSubtitle', 'وصف المشاريع'],
      ['featuresTitle', 'عنوان لماذا نحن'], ['featuresSubtitle', 'وصف لماذا نحن'], ['stepsTitle', 'عنوان مراحل العمل'], ['stepsSubtitle', 'وصف مراحل العمل'],
      ['testimonialsTitle', 'عنوان آراء العملاء'], ['faqTitle', 'عنوان الأسئلة الشائعة'], ['formTitle', 'عنوان النموذج'], ['formSubtitle', 'وصف النموذج'],
      ['ctaTitle', 'عنوان الدعوة الختامية'], ['ctaSubtitle', 'وصف الدعوة الختامية']].map(function (x) { return { k: x[0], l: x[1], max: 200 }; }) },
    { id: 'form', t: 'نموذج المعاينة', fields: [
      { k: 'market', l: 'دولة التحقق من رقم الجوال', t: 'market' },
      { k: 'privacyRequired', l: 'إلزام العميل بالموافقة على سياسة الخصوصية', t: 'bool' },
      { k: 'propertyTypes', l: 'أنواع العقار', t: 'list' }, { k: 'budgets', l: 'نطاقات الميزانية (اختياري للعميل — اترك القائمة فارغة لإخفاء الحقل)', t: 'list' },
      { k: 'contactTimes', l: 'أوقات التواصل', t: 'list' }, { k: 'cities', l: 'اقتراحات المدن (يمكن للعميل كتابة غيرها)', t: 'list' },
      { k: 'successMessage', l: 'رسالة النجاح بعد حفظ الطلب', t: 'textarea', max: 300 }] },
    { id: 'seo', t: 'محركات البحث', fields: [
      { k: 'title', l: 'عنوان الصفحة (Title) — حتى 60 حرفًا', max: 70, full: 1 }, { k: 'description', l: 'الوصف (Meta Description) — حتى 160 حرفًا', t: 'textarea', max: 170 },
      { k: 'siteUrl', l: 'رابط الموقع الأساسي', ltr: 1, ph: 'https://example.com', hint: 'يُستخدم في الرابط القانوني (canonical) وخريطة الموقع.' },
      { k: 'ogImage', l: 'صورة المشاركة (رابط)', ltr: 1, ph: '/img/demo/living-luxe.webp' },
      { k: 'indexable', l: 'السماح لمحركات البحث بأرشفة الموقع', t: 'bool', hint: 'فعّله فقط بعد استبدال البيانات التجريبية ونشر الموقع على نطاقه النهائي.' }] },
    { id: 'tracking', t: 'التتبع والحماية', fields: [
      { k: 'gtmId', l: 'Google Tag Manager', ltr: 1, ph: 'GTM-XXXXXXX', hint: 'عند ضبطه يُحمَّل GTM فقط وتُدار الوسوم من داخله.' },
      { k: 'ga4Id', l: 'Google Analytics 4 (بدون GTM)', ltr: 1, ph: 'G-XXXXXXXXXX' },
      { k: 'adsConversionId', l: 'معرف Google Ads (بدون GTM)', ltr: 1, ph: 'AW-XXXXXXXXX' },
      { k: 'adsLeadLabel', l: 'تسمية تحويل «طلب معاينة»', ltr: 1 }, { k: 'adsWhatsappLabel', l: 'تسمية تحويل «نقرة واتساب»', ltr: 1 },
      { k: 'turnstileSiteKey', l: 'Cloudflare Turnstile — Site Key', ltr: 1 }, { k: 'turnstileSecret', l: 'Cloudflare Turnstile — Secret Key', ltr: 1, t: 'password', hint: 'اتركه فارغًا للإبقاء على المفتاح الحالي. اكتب __clear__ لحذفه.' }] },
    { id: 'privacy', t: 'سياسة الخصوصية', fields: [{ k: 'body', l: 'نص سياسة الخصوصية', t: 'textarea', tall: 1, max: 20000, hint: 'افصل بين الفقرات بسطر فارغ. السطر القصير في بداية الفقرة يظهر كعنوان.' }] },
  ];
  var MARKETS = {};
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a ? a[k] : undefined; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.reduce(function (a, k) { return (a[k] = a[k] || {}); }, o)[last] = v; }

  function viewSettings(tab) {
    setTitle('الإعدادات');
    tab = SETTINGS_TABS.filter(function (t) { return t.id === tab; })[0] || SETTINGS_TABS[0];
    view().innerHTML = '<div class="page-head"><div><h1>الإعدادات</h1><p class="muted">التغييرات تظهر في الموقع فور الحفظ.</p></div></div>' +
      '<nav class="tabs">' + SETTINGS_TABS.map(function (t) { return '<a href="#/settings/' + t.id + '" class="' + (t.id === tab.id ? 'on' : '') + '">' + t.t + '</a>'; }).join('') + '</nav><div id="set-box"><p class="muted">جارٍ التحميل…</p></div>';
    api('GET', '/settings').then(function (d) {
      SETTINGS_CACHE = d.settings; MARKETS = d.markets;
      var vals = d.settings[tab.id] || {};
      var fields = tab.fields.map(function (f) {
        if (f.t === 'market') return Object.assign({}, f, { t: 'select', opts: Object.keys(MARKETS).map(function (k) { return [k, MARKETS[k]]; }) });
        return f;
      });
      var note = tab.id === 'tracking' ? '<p class="notice">أحداث dataLayer المرسلة: <b dir="ltr">generate_lead</b> (بعد حفظ الطلب فعليًا فقط، مع lead_id)، <b dir="ltr">whatsapp_click</b>، <b dir="ltr">phone_click</b>، <b dir="ltr">cta_click</b>، <b dir="ltr">form_start</b>، <b dir="ltr">form_error</b>، <b dir="ltr">project_view</b>. نقرة واتساب تعني فتح المحادثة فقط وليست رسالة مُرسلة.</p>' : '';
      if (tab.id === 'company' && vals.demoMode) note = '<p class="notice warn">الموقع في وضع البيانات التجريبية. استبدل الاسم والأرقام والصور، ثم أوقف خيار «نسخة تجريبية».</p>';
      $('#set-box').innerHTML = note + '<form class="card-form" id="set-form" novalidate><div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, getPath(vals, f.k)); }).join('') + '</div>' +
        '<div class="form-foot"><button class="btn btn-primary" type="submit">حفظ</button><span class="msg muted" data-msg></span></div></form>';
      var form = $('#set-form'); bindImageFields(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var flat = readForm(form, fields), data = {};
        Object.keys(flat).forEach(function (k) { setPath(data, k, flat[k]); });
        if (tab.id === 'tracking' && data.turnstileSecret === '••••••••') data.turnstileSecret = '';
        var b = $('button[type=submit]', form); b.disabled = true;
        api('PUT', '/settings/' + tab.id, data).then(function () { toast('تم حفظ الإعدادات.'); viewSettings(tab.id); })
          .catch(function (err) { b.disabled = false; if (err.fields) showFieldErrors(form, err.fields); fail(err); });
      });
    }).catch(fail);
  }

  /* ---------------- المستخدمون ---------------- */
  var ROLE_HELP = { admin: 'كل الصلاحيات بما فيها الإعدادات والمستخدمون وتصدير البيانات', sales: 'عرض الطلبات وتحديث حالاتها وإضافة الملاحظات فقط', editor: 'إدارة محتوى الموقع وآراء العملاء دون الوصول لبيانات العملاء' };
  function viewUsers() {
    setTitle('المستخدمون');
    view().innerHTML = '<div class="page-head"><div><h1>المستخدمون والصلاحيات</h1><p class="muted">' + Object.keys(ROLE_HELP).map(function (k) { return '<b>' + ROLE_NAMES[k] + ':</b> ' + ROLE_HELP[k]; }).join('<br>') + '</p></div><button class="btn btn-primary" id="add-user">إضافة مستخدم</button></div><div id="u-list"></div>';
    $('#add-user').addEventListener('click', function () { userForm(null); });
    loadUsers();
  }
  var USERS = [];
  function loadUsers() {
    api('GET', '/users').then(function (d) {
      USERS = d.rows;
      $('#u-list').innerHTML = '<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody>' +
        d.rows.map(function (u) {
          return '<tr><td><b>' + esc(u.name) + '</b>' + (u.id === ME.id ? ' <span class="muted small">(أنت)</span>' : '') + '</td><td class="num">' + esc(u.email) + '</td><td>' + ROLE_NAMES[u.role] + '</td><td>' + (u.active ? '<span class="st st-on">نشط</span>' : '<span class="st st-off">موقوف</span>') + '</td><td class="small">' + (fmtDate(u.last_login_at, true) || '—') + '</td><td><button class="btn btn-sm" data-u="' + u.id + '">تعديل</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      $$('[data-u]').forEach(function (b) { b.addEventListener('click', function () { userForm(USERS.filter(function (u) { return u.id === +b.getAttribute('data-u'); })[0]); }); });
    }).catch(fail);
  }
  function userForm(u) {
    var roleOpts = Object.keys(ROLE_NAMES).map(function (k) { return [k, ROLE_NAMES[k]]; });
    var fields = [{ k: 'name', l: 'الاسم', req: 1, max: 60 }];
    if (!u) fields.push({ k: 'email', l: 'البريد الإلكتروني', t: 'email', req: 1, ltr: 1 });
    fields.push({ k: 'role', l: 'الدور', t: 'select', opts: roleOpts, def: 'sales' });
    fields.push({ k: 'password', l: u ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', t: 'password', ltr: 1, req: !u, hint: '10 أحرف على الأقل وتحتوي على حروف وأرقام.' });
    if (u) fields.push({ k: 'active', l: 'الحساب نشط', t: 'bool' });
    var m = openModal(u ? 'تعديل المستخدم' : 'إضافة مستخدم', '<form id="u-form" novalidate><div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, u ? u[f.k] : undefined); }).join('') +
      '</div><div class="form-foot"><button class="btn btn-primary" type="submit">حفظ</button><button class="btn" type="button" data-cancel>إلغاء</button></div></form>');
    var form = $('#u-form', m);
    $('[data-cancel]', form).addEventListener('click', closeOverlay);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = readForm(form, fields);
      if (u && !data.password) delete data.password;
      (u ? api('PUT', '/users/' + u.id, data) : api('POST', '/users', data)).then(function () { toast('تم الحفظ.'); closeOverlay(); loadUsers(); })
        .catch(function (err) { if (err.fields) showFieldErrors(form, err.fields); fail(err); });
    });
  }

  /* ---------------- حسابي ---------------- */
  function viewAccount() {
    setTitle('حسابي');
    var fields = [{ k: 'current', l: 'كلمة المرور الحالية', t: 'password', ltr: 1, full: 1 }, { k: 'next', l: 'كلمة المرور الجديدة', t: 'password', ltr: 1, hint: '10 أحرف على الأقل وتحتوي على حروف وأرقام.' }, { k: 'confirm', l: 'تأكيد كلمة المرور الجديدة', t: 'password', ltr: 1 }];
    view().innerHTML = '<div class="page-head"><div><h1>حسابي</h1><p class="muted">' + esc(ME.name) + ' — <span dir="ltr">' + esc(ME.email) + '</span> — ' + ROLE_NAMES[ME.role] + '</p></div></div>' +
      '<form class="card-form" id="pw-form" novalidate><h2>تغيير كلمة المرور</h2><div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, ''); }).join('') + '</div><div class="form-foot"><button class="btn btn-primary" type="submit">تغيير كلمة المرور</button></div></form>';
    var form = $('#pw-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = readForm(form, fields);
      if (d.next !== d.confirm) { showFieldErrors(form, { confirm: 'كلمتا المرور غير متطابقتين.' }); return; }
      api('POST', '/auth/password', { current: d.current, next: d.next }).then(function () { toast('تم تغيير كلمة المرور.'); form.reset(); }).catch(fail);
    });
  }

  /* ---------------- التشغيل ---------------- */
  function boot() {
    return api('GET', '/auth/me').then(function (d) {
      ME = d.user; STATUSES = d.statuses; SETTINGS_CACHE = { company: { name: d.company } };
      renderShell();
      if (can('settings')) api('GET', '/settings').then(function (s) { SETTINGS_CACHE = s.settings; }).catch(function () {});
      route();
    }).catch(function (e) { if (e.message !== 'unauth') renderLogin(); });
  }
  // 401 من /auth/me يعرض شاشة الدخول
  fetch('/api/admin/auth/me', { credentials: 'same-origin' }).then(function (r) { if (r.status === 401) renderLogin(); else boot(); }).catch(function () { renderLogin('تعذر الاتصال بالخادم.'); });
})();
