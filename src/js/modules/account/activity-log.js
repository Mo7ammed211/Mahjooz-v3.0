// ═══════════════════════════════════════════════════════
//  محجوز v3.1 — Phase 11 (Account Activity Log)
//  - تتبع كل تغيير على الحساب (صورة، اسم، كلمة مرور، لغة، 2FA، ثيم)
//  - حفظ التاريخ + المتصفح + نوع الجهاز
//  - تبويب "📋 نشاط حسابي" داخل صفحة الإعدادات
// ═══════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('activity_section', '📋 نشاط حسابي',     '📋 Account activity');
  add('activity_empty',   'لا يوجد نشاط بعد', 'No activity yet');
  add('activity_show_all','عرض الكل',          'Show all');
  add('activity_hide',    'إخفاء',             'Hide');
})();

// ── Lightweight device info
function ph11_deviceInfo() {
  const ua = navigator.userAgent || '';
  let device = 'كمبيوتر';
  if (/iPhone|iPod/i.test(ua)) device = 'آيفون';
  else if (/iPad/i.test(ua)) device = 'آيباد';
  else if (/Android/i.test(ua)) device = 'أندرويد';
  else if (/Windows/i.test(ua)) device = 'ويندوز';
  else if (/Macintosh/i.test(ua)) device = 'ماك';
  else if (/Linux/i.test(ua)) device = 'لينكس';
  let browser = 'متصفح';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return `${device} • ${browser}`;
}

// ── Log an activity
window.ph11_logActivity = async function (kind, summary, extra = {}) {
  const u = State?.currentUser;
  if (!u || !u.uid) return;
  try {
    await db.collection('account_activity').add({
      uid: u.uid,
      kind, summary,
      device: ph11_deviceInfo(),
      ip: null, // browser cannot read its own public IP without external API
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra,
    });
  } catch (e) { console.warn('[Phase11] log failed', e); }
};

// ── Fetch latest activities for a user
window.ph11_fetchActivities = async function (uid, limit = 20) {
  try {
    const snap = await db.collection('account_activity')
      .where('uid', '==', uid)
      .limit(100)
      .get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limit);
  } catch (e) { return []; }
};

// ── Wrap account-mutating functions to auto-log
(function wrapAll() {
  function wrap(name, kindFn, summaryFn) {
    const orig = window[name];
    if (typeof orig !== 'function') return false;
    window[name] = async function (...args) {
      const r = await orig.apply(this, args);
      try { await ph11_logActivity(kindFn(args), summaryFn(args)); } catch (e) {}
      return r;
    };
    return true;
  }
  function tryWrap() {
    let pending = false;
    if (!window.__ph11_w_save)  pending |= !(window.__ph11_w_save  = wrap('ph9_saveProfile',  () => 'profile_update', () => 'تحديث بيانات الملف الشخصي'));
    if (!window.__ph11_w_photo) pending |= !(window.__ph11_w_photo = wrap('ph9_uploadPhoto',  () => 'photo_upload',   () => 'تغيير الصورة الشخصية'));
    if (!window.__ph11_w_rmph)  pending |= !(window.__ph11_w_rmph  = wrap('ph9_removePhoto', () => 'photo_remove',   () => 'إزالة الصورة الشخصية'));
    if (!window.__ph11_w_pwd)   pending |= !(window.__ph11_w_pwd   = wrap('changePassword',  () => 'password_change',() => 'تغيير كلمة المرور'));
    if (!window.__ph11_w_lang)  pending |= !(window.__ph11_w_lang  = wrap('ph9_setLang',     (a) => 'lang_change',   (a) => `تغيير اللغة إلى ${a[0] === 'ar' ? 'العربية' : 'English'}`));
    if (!window.__ph11_w_2fa)   pending |= !(window.__ph11_w_2fa   = wrap('toggle2FA',       () => '2fa_toggle',     () => 'تبديل المصادقة الثنائية'));
    if (!window.__ph11_w_theme) pending |= !(window.__ph11_w_theme = wrap('toggleTheme',     () => 'theme_toggle',   () => 'تبديل المظهر (ليلي/نهاري)'));
    if (pending) setTimeout(tryWrap, 700);
  }
  tryWrap();
})();

// ── Log login on session start (once per uid per page load)
(function logLoginOnce() {
  let logged = null;
  setInterval(() => {
    const u = State?.currentUser;
    if (!u || !u.uid || logged === u.uid) return;
    logged = u.uid;
    ph11_logActivity('login', 'تسجيل دخول جديد');
  }, 1500);
})();

// ── Inject "📋 نشاط حسابي" card into settings page
(function patchSettingsPage() {
  const __orig = window.renderSettingsPage;
  if (typeof __orig !== 'function') { setTimeout(patchSettingsPage, 600); return; }
  window.renderSettingsPage = function () {
    let html = __orig.apply(this, arguments);
    const card = `
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>${t('activity_section')}</h3></div>
        <div id="ph11-activity-host" class="ph11-act-host">
          <div class="ph9-hint">…</div>
        </div>
      </div>`;
    // Insert before the logout card (last ph9-card)
    const idx = html.lastIndexOf('<div class="ph9-card">');
    if (idx !== -1) html = html.slice(0, idx) + card + html.slice(idx);
    setTimeout(ph11_renderActivityHost, 80);
    return html;
  };
})();

window.ph11_renderActivityHost = async function () {
  const host = document.getElementById('ph11-activity-host');
  if (!host) return;
  const u = State.currentUser;
  if (!u) return;
  host.innerHTML = `<div class="ph9-hint">جاري التحميل…</div>`;
  const items = await ph11_fetchActivities(u.uid, 8);
  if (!items.length) {
    host.innerHTML = `<div class="ph9-hint">${t('activity_empty')}</div>`;
    return;
  }
  const ICONS = {
    profile_update:'✏️', photo_upload:'📷', photo_remove:'🗑️', password_change:'🔐',
    lang_change:'🌐', '2fa_toggle':'🛡️', theme_toggle:'🎨', login:'🔑',
  };
  host.innerHTML = items.map(it => {
    let when = '—';
    try {
      const dt = it.createdAt?.toDate ? it.createdAt.toDate() : (it.createdAt ? new Date(it.createdAt) : null);
      if (dt) {
        const diff = Math.round((Date.now() - dt.getTime()) / 1000);
        when = diff < 60 ? `قبل ${diff} ث` :
               diff < 3600 ? `قبل ${Math.round(diff/60)} د` :
               diff < 86400 ? `قبل ${Math.round(diff/3600)} س` :
               dt.toLocaleDateString('ar-EG');
      }
    } catch (e) {}
    return `
      <div class="ph11-act-row">
        <div class="ph11-act-ic">${ICONS[it.kind] || '•'}</div>
        <div class="ph11-act-meta">
          <div class="ph11-act-summary">${escHtml(it.summary || it.kind)}</div>
          <div class="ph11-act-sub">${escHtml(it.device || '')} • ${when}</div>
        </div>
      </div>`;
  }).join('');
};

console.log('[Phase 11] Account activity log loaded.');
