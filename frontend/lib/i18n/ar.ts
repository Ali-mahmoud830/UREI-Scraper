export const ar = {
  translation: {
    common: {
      loading: "جاري التحميل...",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      edit: "تعديل",
      submit: "تأكيد",
      all: "الكل",
      none: "لا شيء"
    },
    nav: {
      dashboard: "لوحة التحكم",
      leads: "العقارات الحية",
      admin: "إدارة النظام",
      upload: "إضافة عقار",
      lang: "عربي",
      switchLang: "EN"
    },
    scraper: {
      title: "نظام سحب البيانات (Scraper)",
      start: "تشغيل نظام السحب",
      stop: "إيقاف السحب",
      isScraping: "نظام السحب يعمل الآن...",
      aiPrompt: "بحث بالذكاء الاصطناعي",
      aiPromptPlaceholder: "مثال: أريد مخازن في المقطم للبيع بأسعار بين مليون و ٥ مليون",
      manualMode: "البحث اليدوي",
      city: "المدينة",
      cityPlaceholder: "اختر المدن...",
      category: "نوع العقار",
      allCategories: "كل الأنواع",
      categories: {
        apartment: "شقة",
        villa: "فيلا",
        commercial: "تجاري",
        warehouse: "مخزن",
        hotel: "فندق",
        land: "أرض"
      },
      intent: "نوع المعاملة",
      intents: {
        both: "بيع وإيجار",
        sale: "للبيع",
        rent: "للإيجار"
      },
      target: "الجمهور المستهدف",
      targets: {
        buyers: "مشتري / مستأجر",
        sellers: "بائع / مالك"
      },
      priceMin: "الحد الأدنى للسعر",
      priceMax: "الحد الأقصى للسعر",
      timeFilter: "وقت النشر",
      timeFilters: {
        "24h": "آخر ٢٤ ساعة",
        "7d": "آخر ٧ أيام",
        "1m": "آخر ٣٠ يوم",
        "all": "كل الأوقات"
      },
      sources: "مصادر البيانات",
      toast: {
        starting: "جاري تهيئة نظام السحب...",
        started: "تم تشغيل نظام السحب بنجاح.",
        stopped: "تم إيقاف نظام السحب."
      }
    },
    dashboard: {
      welcome: "مرحباً بك",
      totalLeads: "إجمالي الفرص العقارية",
      avgPrice: "متوسط الأسعار",
      successRate: "نسبة النجاح",
      activeSessions: "الجلسات النشطة",
      recentActivity: "النشاط الأخير",
      sessionComplete: "اكتملت الجلسة",
      sessionDesc: "انتهت جلسة السحب. تم العثور على {{count}} فرصة.",
      noSessions: "لا توجد جلسات نشطة حالياً.",
      charts: {
        leadsByDay: "الفرص حسب الأيام",
        leadsBySource: "الفرص حسب المصدر"
      }
    },
    feed: {
      title: "قائمة الفرص المباشرة",
      empty: "لم يتم العثور على عقارات مطابقة",
      waiting: "في انتظار نتائج السحب...",
      price: "السعر",
      area: "المساحة",
      rooms: "الغرف",
      floor: "الدور",
      seller: "بائع",
      buyer: "مشتري",
      contact: "تواصل",
      viewSource: "عرض المصدر",
      whatsapp: "واتساب",
      details: "تفاصيل العقار"
    },
    admin: {
      title: "مركز إدارة النظام",
      users: "إدارة المستخدمين",
      system: "إعدادات النظام",
      proxy: "إعدادات البروكسي",
      logs: "سجلات النظام",
      addUser: "إضافة مستخدم جديد",
      email: "البريد الإلكتروني",
      role: "الصلاحية",
      roles: {
        admin: "مسؤول النظام",
        agent: "وكيل عقاري",
        viewer: "مراقب"
      },
      status: "الحالة",
      actions: "الإجراءات",
      saveConfig: "حفظ الإعدادات",
      toast: {
        saved: "تم تحديث الإعدادات بنجاح",
        error: "فشل في تحديث الإعدادات"
      }
    },
    upload: {
      title: "إضافة أصل عقاري",
      propertyType: "نوع العقار",
      location: "الموقع",
      description: "الوصف",
      multiFloor: "إعدادات الأدوار المتعددة / البنتهاوس",
      addFloor: "إضافة دور",
      floorName: "اسم الدور",
      floorArea: "المساحة",
      floorFeatures: "مميزات الدور",
      uploadImages: "إضافة صور",
      submit: "نشر العقار",
      toast: {
        success: "تم نشر العقار بنجاح",
        error: "فشل في نشر العقار"
      }
    }
  }
};
