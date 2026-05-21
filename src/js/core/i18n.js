// ═══════════════════════════════════════════
//  محجوز v2.0 — Internationalization (i18n)
// ═══════════════════════════════════════════
'use strict';

const I18N = {
  ar: {
    // App
    app_name: 'محجوز',
    app_tagline: 'منصة الحجوزات والخدمات الشاملة',
    loading: 'جاري التحميل...',
    setting_up: 'جاري إعداد المنصة...',
    save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', add: 'إضافة',
    search: 'بحث', close: 'إغلاق', back: 'رجوع', next: 'التالي',
    yes: 'نعم', no: 'لا', confirm: 'تأكيد', optional: 'اختياري',
    name: 'الاسم', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    phone: 'رقم الجوال', age: 'العمر', region: 'المنطقة',
    address: 'العنوان', location: 'الموقع', actions: 'الإجراءات', status: 'الحالة',
    active: 'نشط', inactive: 'معطل',

    // Login landing
    login_choose_method: 'كيف تريد الدخول؟',
    login_existing: 'تسجيل الدخول',
    login_existing_desc: 'لدي حساب — أدخل بريدي وكلمة سري',
    signup_new: 'إنشاء حساب جديد',
    signup_new_desc: 'سجّل الآن واستفد من جميع المزايا',
    enter_guest: 'الدخول كزائر',
    enter_guest_desc: 'تصفح المنصة بدون حساب',
    quick_demo_login: 'دخول تجريبي سريع',
    quick_demo_hint: 'للاختبار فقط — اضغط أحد الأزرار',

    // Login form
    login_title: 'تسجيل الدخول',
    login_email_placeholder: 'البريد الإلكتروني',
    login_pass_placeholder: 'كلمة المرور',
    login_btn: 'تسجيل الدخول',
    no_account_yet: 'لا تملك حساباً؟',
    create_one: 'أنشئ حساباً',

    // Signup form
    signup_title: 'إنشاء حساب جديد',
    full_name: 'الاسم الرباعي',
    full_name_placeholder: 'مثال: محمد أحمد علي السالم',
    age_placeholder: 'مثال: 28',
    region_select: '— اختر المنطقة —',
    region_no_options: 'لا توجد مناطق متاحة (يضيفها المدير)',
    location_detail: 'موقعك داخل المنطقة',
    location_detail_placeholder: 'مثال: المكلا — الديس بجانب مستشفى البرج',
    location_detail_help: 'اكتب وصفاً واضحاً ليصل إليك المندوب بسهولة',
    pick_on_map: '📍 تحديد الموقع على الخريطة',
    map_picked: '✅ تم تحديد الموقع',
    phone_with_code: 'رقم الجوال مع رمز الدولة',
    phone_placeholder: '+967 7XX XXX XXX',
    send_otp: 'إرسال رمز التحقق',
    otp_sent: 'تم إرسال رمز التحقق إلى جوالك',
    otp_code: 'رمز التحقق (6 أرقام)',
    otp_verify: 'تأكيد الرمز',
    otp_verified: '✅ تم التحقق من الجوال',
    pass_min: '6 أحرف على الأقل',
    pass_confirm: 'تأكيد كلمة المرور',
    create_account: 'إنشاء الحساب',
    have_account: 'لديك حساب بالفعل؟',
    login_now: 'سجّل الدخول',
    must_verify_phone: 'يجب التحقق من رقم الجوال أولاً',
    pass_mismatch: 'كلمتا المرور غير متطابقتين',
    pass_too_short: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)',
    fill_all_required: 'يرجى تعبئة جميع الحقول المطلوبة',
    account_created: 'تم إنشاء حسابك بنجاح ✅',

    // Language
    language: 'اللغة',
    arabic: 'العربية',
    english: 'English',
    choose_language: 'اختر اللغة',

    // Admin sidebar additions
    regions_admin: 'المناطق',
    bank_accounts_admin: 'الحسابات البنكية',
    admin_tab_dashboard: 'الإحصائيات',
    admin_tab_users: 'المستخدمين',
    admin_tab_permissions: 'الصلاحيات',
    admin_tab_categories: 'التصنيفات',
    admin_tab_services: 'الخدمات',
    admin_tab_orders: 'الطلبات',
    admin_tab_ads: 'الإعلانات',
    admin_tab_wallet: 'المحفظة',
    admin_tab_reports: 'التقارير',
    admin_tab_payment_methods: 'طرق الدفع',
    admin_tab_deposits: 'الإيداعات',
    admin_tab_settings: 'الإعدادات العامة',

    // Regions admin
    regions_title: 'إدارة المناطق',
    region_name: 'اسم المنطقة',
    region_name_placeholder: 'مثال: المكلا',
    add_region: 'إضافة منطقة',
    edit_region: 'تعديل المنطقة',
    delete_region_confirm: 'هل تريد حذف هذه المنطقة؟ سيتم تحييدها من التسجيلات الجديدة فقط.',
    region_added: 'تم إضافة المنطقة ✅',
    region_updated: 'تم تحديث المنطقة ✅',
    region_deleted: 'تم حذف المنطقة',
    no_regions_yet: 'لا توجد مناطق بعد. أضف أولى المناطق.',

    // Bank accounts admin
    banks_title: 'الحسابات البنكية للإيداع',
    banks_help: 'هذه الحسابات تظهر للعميل عند طلب شحن المحفظة. يستطيع المدير الإضافة والتعديل والحذف.',
    bank_name: 'اسم البنك',
    bank_name_placeholder: 'مثال: البنك الأهلي',
    account_holder: 'اسم صاحب الحساب',
    account_number: 'رقم الحساب',
    iban: 'رقم الآيبان (IBAN)',
    bank_notes: 'ملاحظات إضافية',
    add_bank: 'إضافة حساب',
    edit_bank: 'تعديل الحساب',
    delete_bank_confirm: 'حذف هذا الحساب البنكي؟',
    bank_added: 'تم إضافة الحساب ✅',
    bank_updated: 'تم تحديث الحساب ✅',
    bank_deleted: 'تم حذف الحساب',
    no_banks_yet: 'لا توجد حسابات بنكية مضافة بعد.',
    copy: 'نسخ',
    copied: 'تم النسخ ✅',
  },
  en: {
    app_name: 'Mahjooz',
    app_tagline: 'Comprehensive bookings & services platform',
    loading: 'Loading...',
    setting_up: 'Setting up the platform...',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    search: 'Search', close: 'Close', back: 'Back', next: 'Next',
    yes: 'Yes', no: 'No', confirm: 'Confirm', optional: 'optional',
    name: 'Name', email: 'Email', password: 'Password',
    phone: 'Phone', age: 'Age', region: 'Region',
    address: 'Address', location: 'Location', actions: 'Actions', status: 'Status',
    active: 'Active', inactive: 'Inactive',

    login_choose_method: 'How would you like to enter?',
    login_existing: 'Log in',
    login_existing_desc: 'I have an account — enter my email & password',
    signup_new: 'Create new account',
    signup_new_desc: 'Sign up now and unlock all features',
    enter_guest: 'Continue as guest',
    enter_guest_desc: 'Browse without an account',
    quick_demo_login: 'Quick demo login',
    quick_demo_hint: 'For testing only — pick a role',

    login_title: 'Log in',
    login_email_placeholder: 'Email',
    login_pass_placeholder: 'Password',
    login_btn: 'Log in',
    no_account_yet: 'No account yet?',
    create_one: 'Create one',

    signup_title: 'Create new account',
    full_name: 'Full name (4 parts)',
    full_name_placeholder: 'e.g. Mohammed Ahmed Ali Al-Salem',
    age_placeholder: 'e.g. 28',
    region_select: '— Select region —',
    region_no_options: 'No regions available (admin must add them)',
    location_detail: 'Your location inside the region',
    location_detail_placeholder: 'e.g. Mukalla — Al-Dis next to Al-Burj hospital',
    location_detail_help: 'Write a clear description so the courier can find you',
    pick_on_map: '📍 Pick location on map',
    map_picked: '✅ Location picked',
    phone_with_code: 'Phone with country code',
    phone_placeholder: '+967 7XX XXX XXX',
    send_otp: 'Send OTP code',
    otp_sent: 'OTP code sent to your phone',
    otp_code: 'OTP code (6 digits)',
    otp_verify: 'Verify code',
    otp_verified: '✅ Phone verified',
    pass_min: 'At least 6 characters',
    pass_confirm: 'Confirm password',
    create_account: 'Create account',
    have_account: 'Already have an account?',
    login_now: 'Log in now',
    must_verify_phone: 'You must verify your phone first',
    pass_mismatch: 'Passwords do not match',
    pass_too_short: 'Password is too short (min 6 characters)',
    fill_all_required: 'Please fill in all required fields',
    account_created: 'Account created successfully ✅',

    language: 'Language',
    arabic: 'العربية',
    english: 'English',
    choose_language: 'Choose language',

    regions_admin: 'Regions',
    bank_accounts_admin: 'Bank Accounts',
    admin_tab_dashboard: 'Dashboard',
    admin_tab_users: 'Users',
    admin_tab_permissions: 'Permissions',
    admin_tab_categories: 'Categories',
    admin_tab_services: 'Services',
    admin_tab_orders: 'Orders',
    admin_tab_ads: 'Ads',
    admin_tab_wallet: 'Wallet',
    admin_tab_reports: 'Reports',
    admin_tab_payment_methods: 'Payment Methods',
    admin_tab_deposits: 'Deposits',
    admin_tab_settings: 'General Settings',

    regions_title: 'Manage regions',
    region_name: 'Region name',
    region_name_placeholder: 'e.g. Mukalla',
    add_region: 'Add region',
    edit_region: 'Edit region',
    delete_region_confirm: 'Delete this region? It will only stop appearing for new sign-ups.',
    region_added: 'Region added ✅',
    region_updated: 'Region updated ✅',
    region_deleted: 'Region deleted',
    no_regions_yet: 'No regions yet. Add the first one.',

    banks_title: 'Bank accounts for deposits',
    banks_help: 'These accounts are shown to customers when they request a wallet recharge. Admin can add, edit, or remove them.',
    bank_name: 'Bank name',
    bank_name_placeholder: 'e.g. National Bank',
    account_holder: 'Account holder name',
    account_number: 'Account number',
    iban: 'IBAN',
    bank_notes: 'Additional notes',
    add_bank: 'Add account',
    edit_bank: 'Edit account',
    delete_bank_confirm: 'Delete this bank account?',
    bank_added: 'Account added ✅',
    bank_updated: 'Account updated ✅',
    bank_deleted: 'Account deleted',
    no_banks_yet: 'No bank accounts added yet.',
    copy: 'Copy',
    copied: 'Copied ✅',
  },
};

let _lang = localStorage.getItem('mahjooz_lang') || 'ar';

function getLang() { return _lang; }
function isRTL() { return _lang === 'ar'; }

// Dynamic Text Translation (checks AppData.dictionary first, then I18N, then fallback)
function t(key) {
  // Check dynamic dictionary
  if (typeof AppData !== 'undefined' && AppData.dictionary && AppData.dictionary[_lang] && AppData.dictionary[_lang][key]) {
    return AppData.dictionary[_lang][key];
  }
  // Fallback to English dictionary if not found in Arabic (if current is not English)
  if (_lang !== 'en' && typeof AppData !== 'undefined' && AppData.dictionary && AppData.dictionary.en && AppData.dictionary.en[key]) {
    return AppData.dictionary.en[key];
  }
  return (I18N[_lang] && I18N[_lang][key]) || (I18N.ar && I18N.ar[key]) || key;
}

// Dynamic Icon Rendering (supports Emojis or Image Links)
function tIcon(key, defaultEmoji = '') {
  let val = t(key);
  if (val === key) val = defaultEmoji; // If no translation exists, use default
  
  if (!val) return '';
  
  // If the value is a URL, render an image tag, otherwise render the emoji/text
  if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/')) {
    return `<img src="${val}" alt="icon" style="width:1.2em; height:1.2em; vertical-align:middle; object-fit:contain;">`;
  }
  return val;
}
function setLang(lang) {
  if (!I18N[lang]) return;
  _lang = lang;
  localStorage.setItem('mahjooz_lang', lang);
  applyLang();
  if (typeof render === 'function' && State?.currentUser !== undefined) {
    try { render(); } catch(e) {}
  }
}
function applyLang() {
  const html = document.documentElement;
  html.lang = _lang;
  html.dir = isRTL() ? 'rtl' : 'ltr';
  document.title = `${t('app_name')} | ${t('app_tagline')}`;
}
function languageToggleHTML() {
  return `
    <div class="lang-toggle" title="${t('choose_language')}">
      <button class="lang-btn ${_lang==='ar'?'active':''}" onclick="setLang('ar')">عربي</button>
      <button class="lang-btn ${_lang==='en'?'active':''}" onclick="setLang('en')">EN</button>
    </div>`;
}

// Apply language immediately on load (before DOMContentLoaded)
applyLang();
