/* =========================================================
   منطق الصفحة — لا يحتاج تعديلًا عادةً.
   البيانات كلها في js/config.js
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var doc = document;
  doc.documentElement.classList.add("js");

  /* ---------- أدوات مساعدة ---------- */
  var $ = function (sel, root) { return (root || doc).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  // تحويل الأرقام العربية والفارسية إلى إنجليزية (مهم لأرقام الهواتف)
  function normalizeDigits(str) {
    return String(str || "")
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
  }

  function escapeHTML(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // تتبع الأحداث لـ Google Tag Manager / GA4 / تحويلات Google Ads (يعمل فقط إن كان الكود مضافًا)
  function track(eventName, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
  }

  var waNumber = String(CONFIG.whatsappNumber || "").replace(/\D/g, "");
  var waReady = waNumber.length >= 10;

  function waLink(message) {
    var text = encodeURIComponent(message || CONFIG.whatsappDefaultMessage || "");
    return "https://wa.me/" + waNumber + (text ? "?text=" + text : "");
  }

  /* ---------- بيانات من الإعدادات ---------- */
  if (CONFIG.businessName) {
    $$("[data-config='businessName']").forEach(function (el) { el.textContent = CONFIG.businessName; });
  }

  $$("[data-wa]").forEach(function (el) {
    el.href = waLink(el.getAttribute("data-wa-msg"));
    el.addEventListener("click", function () {
      track("whatsapp_click", { location: el.getAttribute("data-wa-source") || "unknown" });
    });
  });

  $$("[data-tel]").forEach(function (el) {
    if (CONFIG.phoneNumber) el.href = "tel:" + String(CONFIG.phoneNumber).replace(/[^\d+]/g, "");
    el.addEventListener("click", function () { track("phone_click"); });
  });

  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- الهيدر والقائمة ---------- */
  var header = $(".site-header");
  var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var toggle = $(".nav-toggle");
  var nav = $("#site-nav");
  function setNav(open) {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    $(".sr-only", toggle).textContent = open ? "إغلاق القائمة" : "فتح القائمة";
  }
  toggle.addEventListener("click", function () { setNav(toggle.getAttribute("aria-expanded") !== "true"); });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setNav(false); toggle.focus(); }
  });

  /* ---------- معرض المشاريع ---------- */
  var gallery = CONFIG.gallery || {};
  var items = (gallery.items || []).filter(function (it) { return it && it.src; });
  var grid = $("#gallery-grid");
  var filtersEl = $(".gallery-filters");
  var lightbox = $("#lightbox");

  if (items.length) {
    grid.innerHTML = items.map(function (it, i) {
      var title = it.title || "";
      return '<li class="gallery-item reveal" data-category="' + escapeHTML(it.category || "") + '">' +
        '<button type="button" class="gallery-btn" data-index="' + i + '" aria-label="عرض الصورة: ' + escapeHTML(it.alt || title) + '">' +
          '<img src="' + escapeHTML(it.src) + '" alt="' + escapeHTML(it.alt || "") + '" loading="lazy" decoding="async">' +
          (title || it.category ? '<span class="gallery-caption">' +
            (it.category ? "<small>" + escapeHTML(it.category) + "</small>" : "") + escapeHTML(title) + "</span>" : "") +
        "</button></li>";
    }).join("");

    // فلاتر التصنيفات (تظهر فقط إذا وُجد تصنيفان أو أكثر)
    var cats = items.map(function (it) { return it.category; })
      .filter(function (c, i, arr) { return c && arr.indexOf(c) === i; });
    if (cats.length > 1) {
      filtersEl.innerHTML = ["الكل"].concat(cats).map(function (c, i) {
        return '<button type="button" class="filter-btn" data-filter="' + (i === 0 ? "*" : escapeHTML(c)) +
          '" aria-pressed="' + (i === 0) + '">' + escapeHTML(c) + "</button>";
      }).join("");
      filtersEl.hidden = false;
      filtersEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-btn");
        if (!btn) return;
        var f = btn.getAttribute("data-filter");
        $$(".filter-btn", filtersEl).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        $$(".gallery-item", grid).forEach(function (li) {
          li.hidden = !(f === "*" || li.getAttribute("data-category") === f);
        });
      });
    }

    // تكبير الصورة
    if (lightbox && typeof lightbox.showModal === "function") {
      var lbImg = $("img", lightbox);
      var lbCap = $("figcaption", lightbox);
      grid.addEventListener("click", function (e) {
        var btn = e.target.closest(".gallery-btn");
        if (!btn) return;
        var it = items[+btn.getAttribute("data-index")];
        lbImg.src = it.src;
        lbImg.alt = it.alt || "";
        lbCap.textContent = [it.category, it.title].filter(Boolean).join(" — ");
        lbCap.hidden = !lbCap.textContent;
        lightbox.showModal();
      });
      $(".lightbox-close", lightbox).addEventListener("click", function () { lightbox.close(); });
      lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lightbox.close(); });
    }
  } else if (gallery.showPlaceholders !== false) {
    var labels = ["ريسبشن", "مطبخ", "حمام", "غرفة نوم", "سقف وإضاءة", "واجهة أو مدخل"];
    grid.innerHTML = labels.map(function (l) {
      return '<li class="gallery-item"><div class="gallery-placeholder">' +
        "<strong>ضع صورة مشروعك هنا</strong><span>" + l + " — أضف الصورة في js/config.js</span></div></li>";
    }).join("");
  } else {
    var projects = $("#projects");
    if (projects) projects.hidden = true;
    $$('a[href="#projects"]').forEach(function (a) { var li = a.closest("li"); if (li) li.hidden = true; });
  }

  /* ---------- آراء العملاء (تظهر فقط إن وُجدت تقييمات حقيقية) ---------- */
  var reviews = (CONFIG.testimonials || []).filter(function (t) { return t && t.text && t.name; });
  if (reviews.length) {
    $("#testimonials-grid").innerHTML = reviews.map(function (t) {
      var r = Math.max(0, Math.min(5, Math.round(+t.rating || 0)));
      var stars = r ? '<div class="testimonial-stars" role="img" aria-label="التقييم ' + r + ' من 5">' +
        "★".repeat(r) + "☆".repeat(5 - r) + "</div>" : "";
      return '<li class="card reveal"><figure class="testimonial">' + stars +
        "<blockquote><p>" + escapeHTML(t.text) + "</p></blockquote>" +
        "<figcaption><strong>" + escapeHTML(t.name) + "</strong>" +
        "<span>" + escapeHTML([t.project, t.source].filter(Boolean).join(" · ")) + "</span></figcaption>" +
        "</figure></li>";
    }).join("");
    $("#testimonials").hidden = false;
  }

  /* ---------- نموذج الطلب ---------- */
  var form = $("#request-form");
  var statusEl = $("#form-status");
  var submitBtn = $("#form-submit");
  var hintEl = $("#form-hint");
  var endpoint = ((CONFIG.form || {}).endpoint || "").trim();

  // نص الزر والتوضيح يعكسان طريقة العمل الفعلية — لا ادعاء بإرسال لم يحدث
  if (endpoint) {
    submitBtn.textContent = "إرسال الطلب";
    hintEl.textContent = "سيصلنا طلبك مباشرة وسنتواصل معك على رقمك.";
  } else {
    submitBtn.textContent = "متابعة الطلب عبر واتساب";
    hintEl.textContent = "سيفتح واتساب برسالة جاهزة تحتوي بياناتك، اضغط «إرسال» داخل واتساب لإتمام الطلب.";
  }

  var phoneInput = $("#f-phone");
  phoneInput.addEventListener("input", function () {
    var n = normalizeDigits(phoneInput.value);
    if (n !== phoneInput.value) phoneInput.value = n;
  });

  function setError(input, msg) {
    var err = $("#" + input.id + "-error");
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) {
      err.textContent = msg || "";
      if (msg) input.setAttribute("aria-describedby", err.id); else input.removeAttribute("aria-describedby");
    }
    return !msg;
  }

  function validate() {
    var name = $("#f-name"), service = $("#f-service");
    var phoneDigits = normalizeDigits(phoneInput.value).replace(/[^\d]/g, "");
    var ok = true;
    ok = setError(name, name.value.trim().length < 2 ? "من فضلك اكتب اسمك." : "") && ok;
    ok = setError(phoneInput, phoneDigits.length < 8 || phoneDigits.length > 15 ? "من فضلك اكتب رقم هاتف صحيح." : "") && ok;
    ok = setError(service, !service.value ? "من فضلك اختر نوع الخدمة." : "") && ok;
    return ok;
  }

  ["#f-name", "#f-service"].forEach(function (s) {
    $(s).addEventListener("change", function () { if ($(s).getAttribute("aria-invalid") === "true") validate(); });
  });
  phoneInput.addEventListener("blur", function () { if (phoneInput.getAttribute("aria-invalid") === "true") validate(); });

  function formData() {
    return {
      name: $("#f-name").value.trim(),
      phone: normalizeDigits(phoneInput.value).trim(),
      service: $("#f-service").value,
      area: $("#f-area").value.trim(),
      size: $("#f-size").value.trim(),
      notes: $("#f-notes").value.trim()
    };
  }

  function buildWaMessage(d) {
    var lines = [
      "طلب معاينة جديد" + (CONFIG.businessName ? " — " + CONFIG.businessName : ""),
      "",
      "الاسم: " + d.name,
      "الهاتف: " + d.phone,
      "الخدمة: " + d.service
    ];
    if (d.area) lines.push("المنطقة: " + d.area);
    if (d.size) lines.push("المساحة: " + d.size);
    if (d.notes) lines.push("ملاحظات: " + d.notes);
    return lines.join("\n");
  }

  function showStatus(type, html) {
    statusEl.className = "form-status " + (type === "ok" ? "is-success" : "is-error");
    statusEl.innerHTML = html;
  }

  function openWhatsApp(url) {
    var w = window.open(url, "_blank");
    if (!w) window.location.href = url; // عند حظر النوافذ المنبثقة
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";

    // بوت؟ تجاهل بصمت
    if ($("#f-company").value) return;

    if (!validate()) {
      var firstInvalid = $('[aria-invalid="true"]', form);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var d = formData();
    var waUrl = waLink(buildWaMessage(d));

    /* الوضع 1: بدون خدمة ربط — تجهيز رسالة واتساب */
    if (!endpoint) {
      if (!waReady) {
        showStatus("err", "لم يُضبط رقم واتساب بعد في ملف الإعدادات. تواصل معنا هاتفيًا من فضلك.");
        return;
      }
      track("generate_lead", { method: "whatsapp_form", service: d.service });
      openWhatsApp(waUrl);
      showStatus("ok",
        "تم تجهيز رسالتك في واتساب. <strong>اضغط «إرسال» داخل واتساب</strong> حتى يصلنا طلبك. " +
        'لم يفتح واتساب؟ <a href="' + waUrl + '" target="_blank" rel="noopener">اضغط هنا</a>.');
      return;
    }

    /* الوضع 2: إرسال فعلي إلى خدمة خارجية */
    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = "جارٍ الإرسال…";

    var body = new FormData(form);
    body.set("phone", d.phone);
    body.delete("company");
    body.append("page", window.location.href);

    fetch(endpoint, { method: "POST", body: body, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        track("generate_lead", { method: "form", service: d.service });
        form.reset();
        var extra = (CONFIG.form.offerWhatsappAfterSubmit && waReady)
          ? ' للتواصل الأسرع <a href="' + waUrl + '" target="_blank" rel="noopener">تابع معنا على واتساب</a>.' : "";
        showStatus("ok", "وصلنا طلبك، شكرًا لك. سنتواصل معك على رقمك قريبًا." + extra);
      })
      .catch(function () {
        var fallback = waReady
          ? ' يمكنك <a href="' + waUrl + '" target="_blank" rel="noopener">إرسال الطلب عبر واتساب</a> بدلًا من ذلك.' : "";
        showStatus("err", "تعذّر إرسال الطلب الآن، ولم يُحفظ." + fallback);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });

  /* ---------- حركة الظهور عند التمرير ---------- */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- تنبيه المطوّر: يظهر فقط إذا كانت الإعدادات ناقصة ---------- */
  var missing = [];
  if (!waReady || /X/i.test(CONFIG.whatsappNumber || "")) missing.push("رقم واتساب <code>whatsappNumber</code>");
  if (!CONFIG.businessName || /^\[/.test(CONFIG.businessName)) missing.push("اسم الشركة <code>businessName</code>");
  if (!items.length && gallery.showPlaceholders !== false) missing.push("صور المعرض <code>gallery.items</code>");
  if (missing.length) {
    console.warn("[إعدادات ناقصة] عدّل js/config.js:", missing.join(" / ").replace(/<[^>]+>/g, ""));
    var banner = doc.createElement("div");
    banner.className = "dev-banner";
    banner.setAttribute("role", "note");
    banner.innerHTML = "<strong>تنبيه قبل النشر:</strong> أكمل في <code>js/config.js</code>: " + missing.join("، ") +
      '<button type="button">إخفاء</button>';
    $("button", banner).addEventListener("click", function () { banner.remove(); });
    doc.body.appendChild(banner);
  }
})();
