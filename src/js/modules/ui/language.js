/* ============================================================
   phase35.js — Language Switcher
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('language', 'اللغة', 'Language');
  add('arabic', 'العربية', 'Arabic');
  add('english', 'English', 'English');
  add('switch_language', 'تبديل اللغة', 'Switch Language');
  add('current_language', 'اللغة الحالية', 'Current Language');

})();

window.ph35_currentLang = window.ph35_currentLang || 'ar';
window.ph35_direction = window.ph35_direction || 'rtl';

window.ph35_setLanguage = function(lang) {
  if (!['ar', 'en'].includes(lang)) return;
  
  window.ph35_currentLang = lang;
  window.ph35_direction = lang === 'ar' ? 'rtl' : 'ltr';
  
  document.documentElement.lang = lang;
  document.documentElement.dir = window.ph35_direction;
  
  try { localStorage.setItem('app_lang', lang); } catch(e) {}
  
  document.body.classList.remove('rtl', 'ltr');
  document.body.classList.add(window.ph35_direction);
  
  if (typeof render === 'function') render();
  
  toast(lang === 'ar' ? 'تم التبديل للعربية' : 'Switched to English', 'success');
};

window.ph35_toggleLanguage = function() {
  const newLang = window.ph35_currentLang === 'ar' ? 'en' : 'ar';
  window.ph35_setLanguage(newLang);
};

window.ph35_renderSwitcher = function() {
  const current = window.ph35_currentLang;
  return `
    <button class="btn btn-sm" onclick="ph35_toggleLanguage()" style="background:var(--bg-card);border:none">
      ${current === 'ar' ? '🇸🇦 العربية' : '🇺🇸 English'}
    </button>
  `;
};

window.ph35_init = function() {
  try {
    const saved = localStorage.getItem('app_lang');
    if (saved && ['ar', 'en'].includes(saved)) {
      window.ph35_setLanguage(saved);
    }
  } catch(e) {}
};

window.addEventListener('DOMContentLoaded', window.ph35_init);

console.log('[Phase 35] Language Switcher loaded');