/* =========================================================
   ملف الإعدادات — عدّل هذا الملف فقط لتغيير البيانات الأساسية
   ========================================================= */

window.SITE_CONFIG = {

  businessName: "إتقان",

  // رقم واتساب بالصيغة الدولية: أرقام فقط بدون + أو 00
  whatsappNumber: "201068792327",

  // رقم الاتصال
  phoneNumber: "+201068792327",

  whatsappDefaultMessage: "مرحبًا، أريد حجز معاينة مجانية والاستفسار عن خدمات التشطيب.",

  /* ---------- نموذج الطلب ----------
     endpoint فارغ  ← يجهّز رسالة واتساب بالبيانات، والعميل يضغط «إرسال» بنفسه
     endpoint موجود ← يرسل البيانات فعليًا (Formspree / Google Apps Script) — راجع README */
  form: {
    endpoint: "",
    offerWhatsappAfterSubmit: true
  },

  /* ---------- المعرض ----------
     الصور الحالية صور توضيحية من Unsplash (مسموح استخدامها تجاريًا وفق ترخيص Unsplash).
     عند توفر صور مشاريع الشركة الحقيقية:
       1) ضعها في images/projects/ واستبدل src
       2) احذف السطر note
       3) يمكنك حينها تغيير عنوان القسم في index.html إلى «مشاريع نفّذناها» */
  gallery: {
    showPlaceholders: false,
    note: 'صور توضيحية لأنماط التشطيب من <a href="https://unsplash.com/license" target="_blank" rel="noopener">Unsplash</a>.',
    items: [
      { src: "https://images.unsplash.com/photo-1616137422495-1e9e46e2aa77?auto=format&fit=crop&q=70&w=900", alt: "ريسبشن بكنبة رمادية وحوائط فاتحة وإضاءة طبيعية", category: "ريسبشن", title: "ريسبشن مودرن بألوان محايدة" },
      { src: "https://images.unsplash.com/photo-1671197244266-73129c97c096?auto=format&fit=crop&q=70&w=900", alt: "مطبخ مودرن برخامة وكراسي بار", category: "مطابخ", title: "مطبخ مفتوح برخام وجزيرة" },
      { src: "https://images.unsplash.com/photo-1756079664354-34944e001f6d?auto=format&fit=crop&q=70&w=900", alt: "حمام مودرن بوحدة رخام وحوضين", category: "حمامات", title: "حمام رخام بوحدة مزدوجة" },
      { src: "https://images.unsplash.com/photo-1750420556288-d0e32a6f517b?auto=format&fit=crop&q=70&w=900", alt: "غرفة نوم بطابع هادئ وألوان محايدة", category: "غرف نوم", title: "غرفة نوم بألوان هادئة" },
      { src: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=70&w=900", alt: "صالة بمدفأة رخام وأرفف خشب داكن", category: "ريسبشن", title: "تجليد رخام وأرفف خشب" },
      { src: "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?auto=format&fit=crop&q=70&w=900", alt: "مطبخ بوحدات بيضاء وخشب طبيعي", category: "مطابخ", title: "مطبخ أبيض مع خشب طبيعي" },
      { src: "https://images.unsplash.com/photo-1744025098626-66c0b9cb1ba8?auto=format&fit=crop&q=70&w=900", alt: "حمام بحوائط رخام وأدوات صحية حديثة", category: "حمامات", title: "تكسيات رخام كاملة" },
      { src: "https://images.unsplash.com/photo-1757344454333-cc666252e596?auto=format&fit=crop&q=70&w=900", alt: "غرفة نوم بتجاليد خشبية وإضاءة دافئة", category: "غرف نوم", title: "تجاليد خشب وإضاءة مخفية" },
      { src: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&q=70&w=900", alt: "أرضية باركيه خشبي في صالة", category: "أرضيات", title: "أرضيات باركيه" }
    ]
  },

  /* ---------- آراء العملاء ----------
     ⚠ التقييمات التالية نماذج توضيحية للشكل فقط (demo: true) وتظهر عليها شارة «نموذج توضيحي».
     استبدلها بتقييمات حقيقية من عملاء الشركة (بإذنهم) واحذف demo: true، أو احذف القائمة كلها.
     لا تنشر تقييمات مختلقة على أنها حقيقية — هذا تضليل للعملاء ويخالف سياسات Google وMeta الإعلانية. */
  testimonials: [
    { demo: true, name: "اسم العميل", project: "تشطيب شقة كاملة", text: "مثال لشكل التقييم: يُكتب هنا رأي العميل كما كتبه بالضبط، مثل تجربته مع الالتزام بالمواعيد وجودة التشطيب.", rating: 5, source: "تقييم على Google" },
    { demo: true, name: "اسم العميل", project: "تجديد مطبخ وحمام", text: "مثال لشكل التقييم: يُفضّل نقل التقييمات من صفحة الشركة على Google أو فيسبوك مع ذكر المصدر.", rating: 5, source: "تقييم على فيسبوك" },
    { demo: true, name: "اسم العميل", project: "أسقف جبس بورد ودهانات", text: "مثال لشكل التقييم: اطلب من العميل بعد التسليم تقييمًا مكتوبًا وإذنًا بنشره مع اسمه الأول.", rating: 5, source: "رسالة واتساب" }
  ]
};
