// Phase 22 - Dynamic CMS System (Texts, Icons, Banners, Static Pages)
(function () {
  if (typeof I18N !== 'undefined') {
    I18N.ar.cms_texts   = 'النصوص والأيقونات';
    I18N.ar.cms_banners = 'الرسائل والإشعارات';
    I18N.ar.cms_pages   = 'الصفحات الإضافية';
    I18N.en.cms_texts   = 'Texts & Icons';
    I18N.en.cms_banners = 'Banners & Alerts';
    I18N.en.cms_pages   = 'Static Pages';
  }
})();

// ─── CMS Texts & Icons ─────────────────────────────────────
window.renderAdminCmsTexts = function() {
  const dict = AppData.dictionary || { ar: {}, en: {} };
  const allKeys = Object.keys(I18N.ar).sort(); // We use ar as the base schema
  
  let rows = '';
  for (const k of allKeys) {
    const origAr = I18N.ar[k] || '';
    const origEn = I18N.en[k] || '';
    const custAr = dict.ar[k] || '';
    const custEn = dict.en[k] || '';
    
    // Check if the original value looks like an emoji icon to suggest image URL usage
    const isIcon = [...origAr].length === 1 && origAr.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji}/u);
    
    rows += `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="font-family:monospace;color:var(--primary);margin-bottom:8px;font-size:12px;font-weight:700">🔑 ${k}</div>
        
        ${isIcon ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">💡 هذه أيقونة. يمكنك إدخال إيموجي (مثال: 🏠) أو رابط لصورة (مثال: https://.../icon.png) لتغييرها بالكامل.</div>` : ''}
        
        <div class="form-grid-2">
          <div>
            <label class="form-label" style="font-size:12px">العربية (الافتراضي: ${escHtml(origAr)})</label>
            <input class="form-control" type="text" id="dict-ar-${k}" value="${escAttr(custAr)}" placeholder="${escAttr(origAr)}">
          </div>
          <div>
            <label class="form-label" style="font-size:12px">English (Default: ${escHtml(origEn)})</label>
            <input class="form-control" type="text" dir="ltr" id="dict-en-${k}" value="${escAttr(custEn)}" placeholder="${escAttr(origEn)}">
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 style="margin:0;font-size:20px;color:var(--text-primary)">📝 تعديل النصوص والأيقونات</h2>
        <button class="btn btn-primary" onclick="saveDictionary()">💾 حفظ التغييرات</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px">يمكنك هنا تغيير أي نص أو اسم أو أيقونة في المنصة. اترك الحقل فارغاً لاستخدام النص الافتراضي.</p>
      
      <div class="search-hero" style="margin-bottom:20px">
        <input class="form-control search-input-big" id="cms-dict-search" placeholder="ابحث عن نص (مثال: الرئيسية)..." oninput="filterDictionary()">
      </div>
      
      <div id="dict-list" style="max-height:60vh;overflow-y:auto;padding-right:8px">
        ${rows}
      </div>
    </div>
  `;
};

window.filterDictionary = function() {
  const q = document.getElementById('cms-dict-search').value.toLowerCase();
  const rows = document.getElementById('dict-list').children;
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].textContent.toLowerCase();
    rows[i].style.display = text.includes(q) ? 'block' : 'none';
  }
};

window.saveDictionary = async function() {
  const allKeys = Object.keys(I18N.ar);
  const dict = { ar: {}, en: {} };
  
  for (const k of allKeys) {
    const arVal = document.getElementById(`dict-ar-${k}`).value.trim();
    const enVal = document.getElementById(`dict-en-${k}`).value.trim();
    if (arVal) dict.ar[k] = arVal;
    if (enVal) dict.en[k] = enVal;
  }
  
  showLoader('جاري الحفظ...');
  try {
    await fsSet('settings', 'dictionary', dict);
    AppData.dictionary = dict;
    toast('✅ تم تحديث النصوص والأيقونات بنجاح', 'success');
    await render(); // Re-render to show changes immediately
  } catch(e) {
    toast(e.message, 'error');
    await renderAdminDash();
  }
};


// ─── CMS Banners ──────────────────────────────────────────
window.renderAdminCmsBanners = function() {
  const banners = AppData.banners || [];
  
  const locations = {
    'home_top': 'أعلى الصفحة الرئيسية',
    'login': 'صفحة تسجيل الدخول',
    'admin': 'أعلى لوحة التحكم',
  };
  const types = {
    'info': 'معلومة ℹ️',
    'warning': 'تحذير ⚠️',
    'success': 'نجاح ✅',
    'danger': 'خطأ ❌',
  };

  const rows = banners.map(b => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;margin-bottom:4px;color:var(--text-primary)">
          ${types[b.type]} | ${locations[b.location]}
        </div>
        <div style="font-size:14px;color:var(--text-secondary);max-width:500px">${escHtml(b.content)}</div>
        <div style="margin-top:8px">
          <span class="badge ${b.active !== false ? 'badge-teal' : 'badge-rose'}">${b.active !== false ? 'نشط' : 'معطل'}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="toggleBanner('${b.id}', ${b.active !== false})">${b.active !== false ? 'تعطيل' : 'تفعيل'}</button>
        <button class="btn btn-danger" onclick="deleteBanner('${b.id}')">حذف</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 style="margin:0;font-size:20px;color:var(--text-primary)">📣 إدارة الرسائل والإشعارات (Banners)</h2>
        <button class="btn btn-primary" onclick="showAddBannerModal()">➕ إضافة رسالة جديدة</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px">هنا يمكنك إضافة رسائل وإشعارات تظهر للعملاء في أماكن مختلفة من المنصة لتبليغهم بتحديثات أو تعليمات هامة.</p>
      
      ${rows || '<div style="text-align:center;color:var(--text-muted);padding:40px">لا توجد رسائل حالياً</div>'}
    </div>
  `;
};

window.showAddBannerModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">إضافة رسالة جديدة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">موقع ظهور الرسالة</label>
      <select class="form-control" id="bn-loc">
        <option value="home_top">أعلى الصفحة الرئيسية</option>
        <option value="login">صفحة تسجيل الدخول</option>
        <option value="admin">أعلى لوحة التحكم</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">نوع الرسالة</label>
      <select class="form-control" id="bn-type">
        <option value="info">معلومة (أزرق)</option>
        <option value="warning">تحذير (أصفر)</option>
        <option value="success">نجاح (أخضر)</option>
        <option value="danger">خطأ (أحمر)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">محتوى الرسالة (يدعم HTML)</label>
      <textarea class="form-control" id="bn-content" rows="4" placeholder="اكتب نص الرسالة هنا... يمكن استخدام <b>bold</b> أو <a href='...'>link</a>"></textarea>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="saveNewBanner()">حفظ ونشر</button>
  `);
};

window.saveNewBanner = async function() {
  const location = document.getElementById('bn-loc').value;
  const type = document.getElementById('bn-type').value;
  const content = document.getElementById('bn-content').value.trim();
  
  if (!content) { toast('يرجى كتابة محتوى الرسالة', 'error'); return; }
  
  closeModal();
  showLoader('جاري الحفظ...');
  try {
    const id = await fsAdd('banners', { location, type, content, active: true });
    AppData.banners.push({ id, location, type, content, active: true });
    toast('تمت إضافة الرسالة بنجاح ✅', 'success');
    await render();
  } catch(e) {
    toast(e.message, 'error');
    await render();
  }
};

window.toggleBanner = async function(id, currentState) {
  try {
    await fsUpdate('banners', id, { active: !currentState });
    const b = AppData.banners.find(x => x.id === id);
    if (b) b.active = !currentState;
    await render();
  } catch(e) { toast(e.message, 'error'); }
};

window.deleteBanner = async function(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الرسالة نهائياً؟')) return;
  try {
    await fsDelete('banners', id);
    AppData.banners = AppData.banners.filter(x => x.id !== id);
    toast('تم الحذف', 'success');
    await render();
  } catch(e) { toast(e.message, 'error'); }
};


// ─── CMS Static Pages ─────────────────────────────────────
window.renderAdminCmsPages = function() {
  const pages = AppData.pages || [];
  
  const rows = pages.map(p => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;margin-bottom:4px;color:var(--text-primary);font-size:18px">${escHtml(p.title)}</div>
        <div style="font-size:12px;color:var(--text-secondary);font-family:monospace">ID: ${p.id}</div>
        <div style="margin-top:8px">
          <span class="badge ${p.active !== false ? 'badge-teal' : 'badge-rose'}">${p.active !== false ? 'منشورة وتظهر في القائمة' : 'مسودة'}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="navigate('page', {id: '${p.id}'})">معاينة 👁️</button>
        <button class="btn btn-secondary" onclick="togglePageStatus('${p.id}', ${p.active !== false})">${p.active !== false ? 'إخفاء' : 'نشر'}</button>
        <button class="btn btn-danger" onclick="deletePage('${p.id}')">حذف</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 style="margin:0;font-size:20px;color:var(--text-primary)">📄 إدارة الصفحات الثابتة</h2>
        <button class="btn btn-primary" onclick="showAddPageModal()">➕ إنشاء صفحة جديدة</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px">يمكنك إنشاء صفحات إضافية (مثل: من نحن، الشروط والأحكام، الأسئلة الشائعة). ستظهر هذه الصفحات تلقائياً في القائمة الجانبية (الهامبورغر) للعملاء.</p>
      
      ${rows || '<div style="text-align:center;color:var(--text-muted);padding:40px">لا توجد صفحات حالياً</div>'}
    </div>
  `;
};

window.showAddPageModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">إنشاء صفحة جديدة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">معرف الصفحة بالإنجليزية (ID)</label>
      <input class="form-control" id="pg-id" type="text" dir="ltr" placeholder="مثال: about_us, terms, faq">
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">لا تستخدم مسافات، استخدم أحرف إنجليزية فقط.</div>
    </div>
    <div class="form-group">
      <label class="form-label">عنوان الصفحة</label>
      <input class="form-control" id="pg-title" type="text" placeholder="مثال: من نحن، سياسة الخصوصية">
    </div>
    <div class="form-group">
      <label class="form-label">محتوى الصفحة (يدعم HTML)</label>
      <textarea class="form-control" id="pg-content" rows="10" placeholder="اكتب محتوى الصفحة هنا..."></textarea>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="saveNewPage()">حفظ ونشر الصفحة</button>
  `);
};

window.saveNewPage = async function() {
  const id = document.getElementById('pg-id').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const title = document.getElementById('pg-title').value.trim();
  const content = document.getElementById('pg-content').value.trim();
  
  if (!id || !title || !content) { toast('يرجى ملء جميع الحقول', 'error'); return; }
  
  const exists = (AppData.pages||[]).find(p => p.id === id);
  if (exists) { toast('معرف الصفحة (ID) مستخدم بالفعل', 'error'); return; }
  
  closeModal();
  showLoader('جاري الحفظ...');
  try {
    await fsSet('pages', id, { id, title, content, active: true });
    AppData.pages.push({ id, title, content, active: true });
    toast('تم إنشاء الصفحة بنجاح ✅', 'success');
    await render();
  } catch(e) {
    toast(e.message, 'error');
    await render();
  }
};

window.togglePageStatus = async function(id, currentState) {
  try {
    await fsUpdate('pages', id, { active: !currentState });
    const p = AppData.pages.find(x => x.id === id);
    if (p) p.active = !currentState;
    await render();
  } catch(e) { toast(e.message, 'error'); }
};

window.deletePage = async function(id) {
  if (!confirm('هل أنت متأكد من حذف الصفحة؟')) return;
  try {
    await fsDelete('pages', id);
    AppData.pages = AppData.pages.filter(x => x.id !== id);
    toast('تم الحذف', 'success');
    await render();
  } catch(e) { toast(e.message, 'error'); }
};
