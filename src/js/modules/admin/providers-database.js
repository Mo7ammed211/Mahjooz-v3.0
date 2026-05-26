'use strict';
/* ══════════════════════════════════════════════════════════════════════
   قاعدة بيانات مزودين الخدمات — Phase 47
   بنية هرمية: تصنيفات → فئات فرعية → مزودون → عناوين + صور
   مرئية فقط للإدارة ومندوبي التوصيل
   ══════════════════════════════════════════════════════════════════════ */

// ── ثوابت Firestore ──────────────────────────────────────────────────
const PDB_CATS_COL    = 'pdb_cats';
const PDB_SUBCATS_COL = 'pdb_subcats';
const PDB_ENTRIES_COL = 'pdb_entries';

// ── تهيئة الحالة ─────────────────────────────────────────────────────
function _pdbState() {
  if (!State._pdb) {
    State._pdb = {
      view:     'cats',   // 'cats' | 'subcats' | 'entries' | 'entry'
      catId:    null,
      subcatId: null,
      entryId:  null,
      search:   '',
    };
  }
  return State._pdb;
}

// ── تحميل البيانات ───────────────────────────────────────────────────
window.pdb_reload = async function () {
  try {
    const [cats, subcats, entries] = await Promise.all([
      db.collection(PDB_CATS_COL).orderBy('order','asc').get().catch(() => db.collection(PDB_CATS_COL).get()),
      db.collection(PDB_SUBCATS_COL).orderBy('order','asc').get().catch(() => db.collection(PDB_SUBCATS_COL).get()),
      db.collection(PDB_ENTRIES_COL).orderBy('createdAt','desc').get().catch(() => db.collection(PDB_ENTRIES_COL).get()),
    ]);
    AppData.pdbCats    = cats.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.pdbSubcats = subcats.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.pdbEntries = entries.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('pdb_reload error', e);
    AppData.pdbCats    = AppData.pdbCats    || [];
    AppData.pdbSubcats = AppData.pdbSubcats || [];
    AppData.pdbEntries = AppData.pdbEntries || [];
  }
};

// ══════════════════════════════════════════════════════════════════════
//  المدخل الرئيسي للعرض
// ══════════════════════════════════════════════════════════════════════
window.renderAdminProvidersDatabase = function () {
  const st = _pdbState();
  try {
    if (st.view === 'entry')    return _pdb_renderEntryDetail();
    if (st.view === 'entries')  return _pdb_renderEntriesList();
    if (st.view === 'subcats')  return _pdb_renderSubcatsList();
    return _pdb_renderCatsList();
  } catch (err) {
    console.error('renderAdminProvidersDatabase error', err);
    return `<div style="padding:30px;color:#ef4444;font-family:monospace;white-space:pre-wrap;">${err.message}\n${err.stack}</div>`;
  }
};

// ══════════════════════════════════════════════════════════════════════
//  ① صفحة التصنيفات الرئيسية
// ══════════════════════════════════════════════════════════════════════
function _pdb_renderCatsList() {
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const entries = AppData.pdbEntries || [];

  const totalEntries = entries.length;
  const totalSubcats = subcats.length;

  const catCards = cats.map(c => {
    const cSubs    = subcats.filter(s => s.catId === c.id);
    const cEntries = entries.filter(e => e.catId === c.id);
    const isActive = c.active !== false;
    return `
    <div class="pdb-card pdb-cat-card" onclick="pdb_goSubcats('${c.id}')" style="opacity:${isActive ? 1 : 0.6}">
      <div class="pdb-cat-header">
        <div class="pdb-cat-icon-wrap">${escHtml(c.icon || '🏢')}</div>
        <div class="pdb-cat-info">
          <div class="pdb-cat-title">${escHtml(c.name)}</div>
          ${c.desc ? `<div class="pdb-cat-desc">${escHtml(c.desc)}</div>` : ''}
        </div>
        <div class="pdb-cat-arrow">›</div>
      </div>
      <div class="pdb-cat-footer">
        <span class="pdb-stat-chip">📂 ${cSubs.length} فئة فرعية</span>
        <span class="pdb-stat-chip">👤 ${cEntries.length} مزود</span>
        ${!isActive ? `<span class="pdb-stat-chip pdb-chip-warn">⚠️ معطّل</span>` : ''}
      </div>
      <div class="pdb-cat-actions" onclick="event.stopPropagation()">
        <button class="pdb-icon-btn" onclick="pdb_openEditCatModal('${c.id}')" title="تعديل">✏️</button>
        <button class="pdb-icon-btn danger" onclick="pdb_confirmDeleteCat('${c.id}','${escAttr(c.name)}')" title="حذف">🗑️</button>
      </div>
    </div>`;
  }).join('');

  return `
  ${_pdb_styles()}
  <div class="pdb-wrap">

    <!-- الترويسة -->
    <div class="pdb-page-header">
      <div>
        <h2 class="pdb-page-title">🏢 قاعدة بيانات مزودين الخدمات</h2>
        <p class="pdb-page-sub">إدارة هرمية: تصنيفات ← فئات فرعية ← مزودون ← عناوين وصور</p>
      </div>
      <button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddCatModal()">＋ تصنيف جديد</button>
    </div>

    <!-- KPIs -->
    <div class="pdb-kpi-row">
      <div class="pdb-kpi">
        <div class="pdb-kpi-icon" style="background:rgba(139,92,246,0.12);color:#8b5cf6">🏢</div>
        <div><div class="pdb-kpi-val">${cats.length}</div><div class="pdb-kpi-lbl">تصنيف</div></div>
      </div>
      <div class="pdb-kpi">
        <div class="pdb-kpi-icon" style="background:rgba(16,185,129,0.12);color:#10b981">📂</div>
        <div><div class="pdb-kpi-val">${totalSubcats}</div><div class="pdb-kpi-lbl">فئة فرعية</div></div>
      </div>
      <div class="pdb-kpi">
        <div class="pdb-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">👤</div>
        <div><div class="pdb-kpi-val">${totalEntries}</div><div class="pdb-kpi-lbl">مزود خدمة</div></div>
      </div>
      <div class="pdb-kpi">
        <div class="pdb-kpi-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">📍</div>
        <div><div class="pdb-kpi-val">${entries.reduce((acc,e) => acc + (e.addresses||[]).length, 0)}</div><div class="pdb-kpi-lbl">عنوان مسجّل</div></div>
      </div>
    </div>

    <!-- قائمة التصنيفات -->
    ${cats.length === 0 ? `
    <div class="pdb-empty">
      <div class="pdb-empty-icon">🏢</div>
      <h3>لا توجد تصنيفات بعد</h3>
      <p>أنشئ تصنيفاً لتبدأ بتنظيم مزودي الخدمات</p>
      <button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddCatModal()">＋ إضافة أول تصنيف</button>
    </div>` : `
    <div class="pdb-cats-grid">
      ${catCards}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ② صفحة الفئات الفرعية
// ══════════════════════════════════════════════════════════════════════
function _pdb_renderSubcatsList() {
  const st      = _pdbState();
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const entries = AppData.pdbEntries || [];

  const cat     = cats.find(c => c.id === st.catId);
  const mySubcats = subcats.filter(s => s.catId === st.catId);
  const sq = (st.search || '').toLowerCase().trim();
  const filtered = sq ? mySubcats.filter(s => (s.name||'').toLowerCase().includes(sq)) : mySubcats;

  return `
  ${_pdb_styles()}
  <div class="pdb-wrap">

    <!-- شريط التنقل -->
    ${_pdb_breadcrumb([
      { label: '🏢 قاعدة المزودين', onclick: "pdb_goHome()" },
      { label: escHtml(cat?.name || '—') }
    ])}

    <!-- الترويسة -->
    <div class="pdb-page-header">
      <div>
        <h2 class="pdb-page-title">${escHtml(cat?.icon || '🏢')} ${escHtml(cat?.name || '—')}</h2>
        <p class="pdb-page-sub">${escHtml(cat?.desc || 'الفئات الفرعية لهذا التصنيف')}</p>
      </div>
      <button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddSubcatModal('${st.catId}')">＋ فئة فرعية</button>
    </div>

    <!-- بحث -->
    <div class="pdb-search-row">
      <div class="pdb-search-wrap">
        <span class="pdb-search-icon">🔍</span>
        <input class="pdb-search-input" placeholder="ابحث في الفئات الفرعية..."
               value="${escAttr(st.search || '')}"
               oninput="State._pdb.search=this.value; render()">
      </div>
    </div>

    <!-- قائمة الفئات الفرعية -->
    ${filtered.length === 0 ? `
    <div class="pdb-empty">
      <div class="pdb-empty-icon">📂</div>
      <h3>${sq ? 'لا توجد نتائج' : 'لا توجد فئات فرعية بعد'}</h3>
      <p>${sq ? 'جرّب كلمة بحث مختلفة' : 'أضف فئات فرعية لتنظيم المزودين داخل هذا التصنيف'}</p>
      ${!sq ? `<button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddSubcatModal('${st.catId}')">＋ إضافة فئة فرعية</button>` : ''}
    </div>` : `
    <div class="pdb-subcats-list">
      ${filtered.map(s => {
        const sEntries = entries.filter(e => e.subcatId === s.id);
        return `
        <div class="pdb-subcat-row" onclick="pdb_goEntries('${s.id}')">
          <div class="pdb-subcat-icon">${escHtml(s.icon || '📂')}</div>
          <div class="pdb-subcat-body">
            <div class="pdb-subcat-name">${escHtml(s.name)}</div>
            ${s.desc ? `<div class="pdb-subcat-desc">${escHtml(s.desc)}</div>` : ''}
          </div>
          <div class="pdb-subcat-meta">
            <span class="pdb-stat-chip">👤 ${sEntries.length} مزود</span>
          </div>
          <div class="pdb-subcat-actions" onclick="event.stopPropagation()">
            <button class="pdb-icon-btn" onclick="pdb_openEditSubcatModal('${s.id}')" title="تعديل">✏️</button>
            <button class="pdb-icon-btn danger" onclick="pdb_confirmDeleteSubcat('${s.id}','${escAttr(s.name)}')" title="حذف">🗑️</button>
          </div>
          <div class="pdb-subcat-arrow">›</div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ③ صفحة قائمة المزودين
// ══════════════════════════════════════════════════════════════════════
function _pdb_renderEntriesList() {
  const st      = _pdbState();
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const entries = AppData.pdbEntries || [];

  const cat    = cats.find(c => c.id === st.catId);
  const subcat = subcats.find(s => s.id === st.subcatId);
  const myEntries = entries.filter(e => e.subcatId === st.subcatId);
  const sq = (st.search || '').toLowerCase().trim();
  const filtered = sq
    ? myEntries.filter(e => (e.name||'').toLowerCase().includes(sq) || (e.phone||'').includes(sq))
    : myEntries;

  return `
  ${_pdb_styles()}
  <div class="pdb-wrap">

    ${_pdb_breadcrumb([
      { label: '🏢 قاعدة المزودين', onclick: "pdb_goHome()" },
      { label: escHtml(cat?.name || '—'), onclick: `pdb_goSubcats('${st.catId}')` },
      { label: escHtml(subcat?.name || '—') }
    ])}

    <div class="pdb-page-header">
      <div>
        <h2 class="pdb-page-title">${escHtml(subcat?.icon || '📂')} ${escHtml(subcat?.name || '—')}</h2>
        <p class="pdb-page-sub">${escHtml(subcat?.desc || '')} • ${myEntries.length} مزود خدمة</p>
      </div>
      <button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddEntryModal('${st.catId}','${st.subcatId}')">＋ مزود جديد</button>
    </div>

    <div class="pdb-search-row">
      <div class="pdb-search-wrap">
        <span class="pdb-search-icon">🔍</span>
        <input class="pdb-search-input" placeholder="ابحث بالاسم أو الهاتف..."
               value="${escAttr(st.search || '')}"
               oninput="State._pdb.search=this.value; render()">
      </div>
    </div>

    ${filtered.length === 0 ? `
    <div class="pdb-empty">
      <div class="pdb-empty-icon">👤</div>
      <h3>${sq ? 'لا توجد نتائج' : 'لا يوجد مزودون بعد'}</h3>
      <p>${sq ? 'جرّب كلمة بحث مختلفة' : 'أضف مزودي الخدمات في هذه الفئة الفرعية'}</p>
      ${!sq ? `<button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddEntryModal('${st.catId}','${st.subcatId}')">＋ إضافة مزود</button>` : ''}
    </div>` : `
    <div class="pdb-entries-grid">
      ${filtered.map(e => {
        const addrCount = (e.addresses || []).length;
        const mainImg   = (e.addresses || []).find(a => a.images && a.images[0])?.images[0] || '';
        return `
        <div class="pdb-entry-card" onclick="pdb_goEntry('${e.id}')">
          <div class="pdb-entry-avatar">
            ${mainImg
              ? `<img src="${escAttr(mainImg)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
              : `<span style="font-size:24px">${(e.name||'م').charAt(0)}</span>`}
          </div>
          <div class="pdb-entry-body">
            <div class="pdb-entry-name">${escHtml(e.name || '—')}</div>
            <div class="pdb-entry-phone">📞 ${escHtml(e.phone || '—')}</div>
            ${e.notes ? `<div class="pdb-entry-notes">${escHtml(e.notes.substring(0,60))}${e.notes.length>60?'…':''}</div>` : ''}
            <div class="pdb-entry-chips">
              <span class="pdb-stat-chip">📍 ${addrCount} عنوان</span>
              ${e.active === false ? `<span class="pdb-stat-chip pdb-chip-warn">⚠️ معطّل</span>` : `<span class="pdb-stat-chip pdb-chip-ok">✅ نشط</span>`}
            </div>
          </div>
          <div class="pdb-entry-actions" onclick="event.stopPropagation()">
            <button class="pdb-icon-btn" onclick="pdb_openEditEntryModal('${e.id}')" title="تعديل">✏️</button>
            <button class="pdb-icon-btn danger" onclick="pdb_confirmDeleteEntry('${e.id}','${escAttr(e.name||'')}')" title="حذف">🗑️</button>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ④ صفحة تفاصيل المزود (عناوينه + صوره)
// ══════════════════════════════════════════════════════════════════════
function _pdb_renderEntryDetail() {
  const st      = _pdbState();
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const entries = AppData.pdbEntries || [];

  const entry  = entries.find(e => e.id === st.entryId);
  if (!entry) return `<div class="pdb-wrap" style="padding:40px;text-align:center;color:var(--text-muted)">المزود غير موجود <button class="pdb-btn pdb-btn-secondary" style="margin-top:12px" onclick="pdb_goHome()">رجوع</button></div>`;

  const cat    = cats.find(c => c.id === entry.catId);
  const subcat = subcats.find(s => s.id === entry.subcatId);
  const addresses = entry.addresses || [];

  return `
  ${_pdb_styles()}
  <div class="pdb-wrap">

    ${_pdb_breadcrumb([
      { label: '🏢 قاعدة المزودين', onclick: "pdb_goHome()" },
      { label: escHtml(cat?.name || '—'), onclick: `pdb_goSubcats('${entry.catId}')` },
      { label: escHtml(subcat?.name || '—'), onclick: `pdb_goEntries('${entry.subcatId}')` },
      { label: escHtml(entry.name || '—') }
    ])}

    <!-- بطاقة المزود -->
    <div class="pdb-provider-hero">
      <div class="pdb-provider-avatar-lg">
        ${entry.name ? entry.name.charAt(0).toUpperCase() : 'م'}
      </div>
      <div class="pdb-provider-hero-info">
        <h2 class="pdb-provider-name">${escHtml(entry.name || '—')}</h2>
        <div class="pdb-provider-meta-row">
          ${entry.phone ? `<span class="pdb-meta-badge">📞 ${escHtml(entry.phone)}</span>` : ''}
          ${entry.email ? `<span class="pdb-meta-badge">📧 ${escHtml(entry.email)}</span>` : ''}
          ${entry.active === false ? `<span class="pdb-meta-badge pdb-badge-warn">⚠️ معطّل</span>` : `<span class="pdb-meta-badge pdb-badge-ok">✅ نشط</span>`}
        </div>
        ${entry.notes ? `<div class="pdb-provider-notes">${escHtml(entry.notes)}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="pdb-btn pdb-btn-secondary" onclick="pdb_openEditEntryModal('${entry.id}')">✏️ تعديل البيانات</button>
      </div>
    </div>

    <!-- عناوين المزود -->
    <div class="pdb-addresses-section">
      <div class="pdb-section-header">
        <h3 class="pdb-section-title">📍 عناوين المزود ومواقعه</h3>
        <button class="pdb-btn pdb-btn-primary pdb-btn-sm" onclick="pdb_openAddAddressModal('${entry.id}')">＋ إضافة عنوان</button>
      </div>

      ${addresses.length === 0 ? `
      <div class="pdb-empty" style="padding:32px">
        <div class="pdb-empty-icon" style="font-size:32px">📍</div>
        <h4 style="margin:8px 0">لا توجد عناوين مسجّلة بعد</h4>
        <p style="color:var(--text-muted);font-size:13px">أضف عنواناً أو أكثر لهذا المزود</p>
        <button class="pdb-btn pdb-btn-primary" onclick="pdb_openAddAddressModal('${entry.id}')">＋ إضافة عنوان</button>
      </div>` : `
      <div class="pdb-addresses-list">
        ${addresses.map((addr, idx) => `
        <div class="pdb-address-card">
          <div class="pdb-address-header">
            <div class="pdb-address-label-row">
              <span class="pdb-address-label">📍 ${escHtml(addr.label || `عنوان ${idx+1}`)}</span>
              ${addr.lat && addr.lng ? `
              <a class="pdb-map-link" href="https://www.google.com/maps?q=${addr.lat},${addr.lng}" target="_blank" rel="noopener">
                🗺️ فتح في الخريطة
              </a>` : ''}
            </div>
            <div class="pdb-address-actions">
              <button class="pdb-icon-btn" onclick="pdb_openEditAddressModal('${entry.id}', ${idx})" title="تعديل العنوان">✏️</button>
              <button class="pdb-icon-btn danger" onclick="pdb_confirmDeleteAddress('${entry.id}', ${idx})" title="حذف العنوان">🗑️</button>
            </div>
          </div>

          ${addr.text ? `<div class="pdb-address-text">🏠 ${escHtml(addr.text)}</div>` : ''}

          ${addr.lat && addr.lng ? `
          <div class="pdb-coords-row">
            <span class="pdb-coord-chip">Lat: ${addr.lat}</span>
            <span class="pdb-coord-chip">Lng: ${addr.lng}</span>
          </div>` : ''}

          <!-- صور المحل -->
          ${(addr.images && addr.images.length > 0) ? `
          <div class="pdb-images-strip">
            ${addr.images.map((img, iIdx) => `
            <div class="pdb-img-wrap">
              <img src="${escAttr(img)}" alt="صورة ${iIdx+1}" loading="lazy">
              <button class="pdb-img-del" onclick="pdb_deleteAddressImage('${entry.id}', ${idx}, ${iIdx})" title="حذف الصورة">✕</button>
            </div>`).join('')}
            <button class="pdb-add-img-btn" onclick="pdb_openAddImageModal('${entry.id}', ${idx})">＋ صورة</button>
          </div>` : `
          <div style="margin-top:10px">
            <button class="pdb-add-img-btn" onclick="pdb_openAddImageModal('${entry.id}', ${idx})">📷 إضافة صورة للمحل</button>
          </div>`}
        </div>`).join('')}
      </div>`}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  التنقل
// ══════════════════════════════════════════════════════════════════════
window.pdb_goHome = function() {
  Object.assign(_pdbState(), { view:'cats', catId:null, subcatId:null, entryId:null, search:'' });
  render();
};
window.pdb_goSubcats = function(catId) {
  Object.assign(_pdbState(), { view:'subcats', catId, subcatId:null, entryId:null, search:'' });
  render();
};
window.pdb_goEntries = function(subcatId) {
  const subcat = (AppData.pdbSubcats||[]).find(s => s.id === subcatId);
  Object.assign(_pdbState(), { view:'entries', subcatId, catId: subcat?.catId || _pdbState().catId, entryId:null, search:'' });
  render();
};
window.pdb_goEntry = function(entryId) {
  Object.assign(_pdbState(), { view:'entry', entryId, search:'' });
  render();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — التصنيفات
// ══════════════════════════════════════════════════════════════════════
const _PDB_CAT_ICONS = ['🏢','🏨','🏥','🔧','🛠️','💼','🏪','🎓','🚗','✈️','🍽️','💊','🏋️','📦','🧹','💇','🌿','🔑','🧰','🎨','🏗️','⚡','🔌','🛁','🪟'];

function _pdb_catModalHTML(cat = null) {
  const selIcon = cat?.icon || '🏢';
  return `
  <div class="modal-header">
    <h2 class="modal-title">${cat ? '✏️ تعديل التصنيف' : '🏢 تصنيف جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="form-group">
      <label class="form-label">اسم التصنيف <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="pdb-cat-name" value="${escHtml(cat?.name||'')}" placeholder="مثال: مزودو المكلا، مزودو حضرموت..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الوصف (اختياري)</label>
      <input class="form-control" id="pdb-cat-desc" value="${escHtml(cat?.desc||'')}" placeholder="وصف مختصر للتصنيف">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px" id="pdb-cat-icon-grid">
        ${_PDB_CAT_ICONS.map(ic => `
        <div onclick="pdb_selectCatIcon(this,'${ic}')"
             style="padding:10px;font-size:20px;border:2px solid ${ic===selIcon?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;background:${ic===selIcon?'rgba(139,92,246,0.1)':'rgba(255,255,255,0.02)'}">
          ${ic}
        </div>`).join('')}
      </div>
      <input type="hidden" id="pdb-cat-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" type="number" min="1" id="pdb-cat-order" value="${cat?.order||''}" placeholder="1, 2, 3...">
    </div>
    ${cat ? `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="pdb-cat-active" ${cat.active!==false?'checked':''} style="width:16px;height:16px;accent-color:var(--primary)">
      <span>تصنيف مفعّل</span>
    </label>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pdb_submitCat(${cat?`'${cat.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.pdb_selectCatIcon = function(el, icon) {
  document.querySelectorAll('#pdb-cat-icon-grid > div').forEach(d => {
    d.style.borderColor = 'var(--border)';
    d.style.background  = 'rgba(255,255,255,0.02)';
  });
  el.style.borderColor = 'var(--primary)';
  el.style.background  = 'rgba(139,92,246,0.1)';
  document.getElementById('pdb-cat-icon').value = icon;
};

window.pdb_openAddCatModal  = function() { openModal(_pdb_catModalHTML()); };
window.pdb_openEditCatModal = function(id) {
  const c = (AppData.pdbCats||[]).find(c => c.id === id);
  if (c) openModal(_pdb_catModalHTML(c));
};

window.pdb_submitCat = async function(id = null) {
  const name   = document.getElementById('pdb-cat-name')?.value?.trim();
  const desc   = document.getElementById('pdb-cat-desc')?.value?.trim();
  const icon   = document.getElementById('pdb-cat-icon')?.value || '🏢';
  const order  = parseInt(document.getElementById('pdb-cat-order')?.value) || (AppData.pdbCats||[]).length + 1;
  const active = id ? (document.getElementById('pdb-cat-active')?.checked !== false) : true;
  if (!name) { toast('اسم التصنيف مطلوب', 'error'); return; }
  showLoader('جاري الحفظ...');
  try {
    const payload = { name, desc:desc||'', icon, order, active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (id) {
      await db.collection(PDB_CATS_COL).doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(PDB_CATS_COL).add(payload);
    }
    await pdb_reload();
    hideLoader(); closeModal();
    toast(`✅ تم ${id ? 'تحديث' : 'إضافة'} التصنيف`, 'success');
    render();
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); }
};

window.pdb_confirmDeleteCat = function(id, name) {
  const subs = (AppData.pdbSubcats||[]).filter(s => s.catId === id).length;
  const msg  = subs > 0 ? `حذف تصنيف "${name}"؟\nسيُحذف معه ${subs} فئة فرعية وجميع مزوديها. هذا لا يمكن التراجع عنه.`
                        : `حذف تصنيف "${name}"؟ لا يمكن التراجع.`;
  if (!confirm(msg)) return;
  showLoader('جاري الحذف...');
  (async () => {
    try {
      const subIds = (AppData.pdbSubcats||[]).filter(s => s.catId === id).map(s => s.id);
      await Promise.all(subIds.map(sid => db.collection(PDB_SUBCATS_COL).doc(sid).delete()));
      const entryIds = (AppData.pdbEntries||[]).filter(e => e.catId === id).map(e => e.id);
      await Promise.all(entryIds.map(eid => db.collection(PDB_ENTRIES_COL).doc(eid).delete()));
      await db.collection(PDB_CATS_COL).doc(id).delete();
      await pdb_reload();
      hideLoader(); toast('✅ تم حذف التصنيف وكل محتوياته', 'success');
      pdb_goHome();
    } catch (e) { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); }
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — الفئات الفرعية
// ══════════════════════════════════════════════════════════════════════
function _pdb_subcatModalHTML(catId, sub = null) {
  const selIcon = sub?.icon || '📂';
  const icons   = ['📂','🏪','🔧','🏨','🏥','💊','🎓','🚗','🍽️','💼','🌿','🔑','🏋️','📦','🧹','💇','🛁','⚡','🔌','🪟','🏗️','🎨','🧰','🛠️','🏢'];
  return `
  <div class="modal-header">
    <h2 class="modal-title">${sub ? '✏️ تعديل الفئة الفرعية' : '📂 فئة فرعية جديدة'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="form-group">
      <label class="form-label">اسم الفئة الفرعية <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="pdb-sub-name" value="${escHtml(sub?.name||'')}" placeholder="مثال: مزودو الحجوزات، مزودو الصيدليات..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الوصف (اختياري)</label>
      <input class="form-control" id="pdb-sub-desc" value="${escHtml(sub?.desc||'')}" placeholder="وصف مختصر">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px" id="pdb-sub-icon-grid">
        ${icons.map(ic => `
        <div onclick="pdb_selectSubIcon(this,'${ic}')"
             style="padding:10px;font-size:20px;border:2px solid ${ic===selIcon?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;background:${ic===selIcon?'rgba(139,92,246,0.1)':'rgba(255,255,255,0.02)'}">
          ${ic}
        </div>`).join('')}
      </div>
      <input type="hidden" id="pdb-sub-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" type="number" min="1" id="pdb-sub-order" value="${sub?.order||''}" placeholder="1, 2, 3...">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pdb_submitSubcat('${catId}',${sub?`'${sub.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.pdb_selectSubIcon = function(el, icon) {
  document.querySelectorAll('#pdb-sub-icon-grid > div').forEach(d => {
    d.style.borderColor = 'var(--border)';
    d.style.background  = 'rgba(255,255,255,0.02)';
  });
  el.style.borderColor = 'var(--primary)';
  el.style.background  = 'rgba(139,92,246,0.1)';
  document.getElementById('pdb-sub-icon').value = icon;
};

window.pdb_openAddSubcatModal  = function(catId) { openModal(_pdb_subcatModalHTML(catId)); };
window.pdb_openEditSubcatModal = function(id) {
  const s = (AppData.pdbSubcats||[]).find(s => s.id === id);
  if (s) openModal(_pdb_subcatModalHTML(s.catId, s));
};

window.pdb_submitSubcat = async function(catId, id = null) {
  const name  = document.getElementById('pdb-sub-name')?.value?.trim();
  const desc  = document.getElementById('pdb-sub-desc')?.value?.trim();
  const icon  = document.getElementById('pdb-sub-icon')?.value || '📂';
  const order = parseInt(document.getElementById('pdb-sub-order')?.value) || (AppData.pdbSubcats||[]).filter(s=>s.catId===catId).length + 1;
  if (!name) { toast('اسم الفئة الفرعية مطلوب', 'error'); return; }
  showLoader('جاري الحفظ...');
  try {
    const payload = { name, desc:desc||'', icon, order, catId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (id) {
      await db.collection(PDB_SUBCATS_COL).doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(PDB_SUBCATS_COL).add(payload);
    }
    await pdb_reload();
    hideLoader(); closeModal();
    toast(`✅ تم ${id ? 'تحديث' : 'إضافة'} الفئة الفرعية`, 'success');
    render();
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); }
};

window.pdb_confirmDeleteSubcat = function(id, name) {
  const entries = (AppData.pdbEntries||[]).filter(e => e.subcatId === id).length;
  const msg = entries > 0
    ? `حذف فئة "${name}"؟\nسيُحذف معها ${entries} مزود. هذا لا يمكن التراجع عنه.`
    : `حذف فئة "${name}"؟ لا يمكن التراجع.`;
  if (!confirm(msg)) return;
  showLoader('جاري الحذف...');
  (async () => {
    try {
      const eIds = (AppData.pdbEntries||[]).filter(e => e.subcatId === id).map(e => e.id);
      await Promise.all(eIds.map(eid => db.collection(PDB_ENTRIES_COL).doc(eid).delete()));
      await db.collection(PDB_SUBCATS_COL).doc(id).delete();
      await pdb_reload();
      hideLoader(); toast('✅ تم الحذف', 'success');
      render();
    } catch (e) { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); }
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — المزودون (الإدخالات)
// ══════════════════════════════════════════════════════════════════════
function _pdb_entryModalHTML(catId, subcatId, entry = null) {
  const users = (AppData.users||[]).filter(u => ['vendor','provider','tech'].includes(u.role));
  return `
  <div class="modal-header">
    <h2 class="modal-title">${entry ? '✏️ تعديل بيانات المزود' : '👤 مزود خدمة جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow-y:auto">
    <div class="form-group">
      <label class="form-label">اسم المزود <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="pdb-entry-name" value="${escHtml(entry?.name||'')}" placeholder="الاسم الكامل أو اسم المتجر" autofocus>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">رقم الهاتف</label>
        <input class="form-control" id="pdb-entry-phone" value="${escHtml(entry?.phone||'')}" placeholder="+967...">
      </div>
      <div class="form-group">
        <label class="form-label">البريد الإلكتروني</label>
        <input class="form-control" id="pdb-entry-email" value="${escHtml(entry?.email||'')}" placeholder="example@mail.com">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">ملاحظات (اختياري)</label>
      <textarea class="form-control" id="pdb-entry-notes" rows="3" placeholder="أي ملاحظات إضافية...">${escHtml(entry?.notes||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">ربط بحساب مستخدم على المنصة (اختياري)</label>
      <select class="form-control" id="pdb-entry-uid">
        <option value="">— لا يوجد حساب مرتبط —</option>
        ${users.map(u => `<option value="${u.id}" ${entry?.linkedUserId===u.id?'selected':''}>${escHtml(u.name||u.email||u.id)} (${u.role})</option>`).join('')}
      </select>
    </div>
    ${entry ? `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="pdb-entry-active" ${entry.active!==false?'checked':''} style="width:16px;height:16px;accent-color:var(--primary)">
      <span>مزود نشط</span>
    </label>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pdb_submitEntry('${catId}','${subcatId}',${entry?`'${entry.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.pdb_openAddEntryModal = function(catId, subcatId) { openModal(_pdb_entryModalHTML(catId, subcatId)); };
window.pdb_openEditEntryModal = function(id) {
  const e = (AppData.pdbEntries||[]).find(e => e.id === id);
  if (e) openModal(_pdb_entryModalHTML(e.catId, e.subcatId, e));
};

window.pdb_submitEntry = async function(catId, subcatId, id = null) {
  const name   = document.getElementById('pdb-entry-name')?.value?.trim();
  const phone  = document.getElementById('pdb-entry-phone')?.value?.trim();
  const email  = document.getElementById('pdb-entry-email')?.value?.trim();
  const notes  = document.getElementById('pdb-entry-notes')?.value?.trim();
  const uid    = document.getElementById('pdb-entry-uid')?.value;
  const active = id ? (document.getElementById('pdb-entry-active')?.checked !== false) : true;
  if (!name) { toast('اسم المزود مطلوب', 'error'); return; }
  showLoader('جاري الحفظ...');
  try {
    const payload = { name, phone:phone||'', email:email||'', notes:notes||'', catId, subcatId,
      linkedUserId: uid||null, active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    let newId = id;
    if (id) {
      await db.collection(PDB_ENTRIES_COL).doc(id).update(payload);
    } else {
      payload.addresses = [];
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection(PDB_ENTRIES_COL).add(payload);
      newId = ref.id;
    }
    await pdb_reload();
    hideLoader(); closeModal();
    toast(`✅ تم ${id ? 'تحديث' : 'إضافة'} المزود`, 'success');
    pdb_goEntry(newId);
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); }
};

window.pdb_confirmDeleteEntry = function(id, name) {
  if (!confirm(`حذف المزود "${name}"؟ سيُحذف مع جميع عناوينه وصوره. لا يمكن التراجع.`)) return;
  showLoader('جاري الحذف...');
  db.collection(PDB_ENTRIES_COL).doc(id).delete()
    .then(() => pdb_reload())
    .then(() => { hideLoader(); toast('✅ تم حذف المزود', 'success');
      Object.assign(_pdbState(), { view:'entries', entryId:null });
      render();
    })
    .catch(e => { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); });
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — العناوين
// ══════════════════════════════════════════════════════════════════════
let _pdbPickerMap = null, _pdbPickerMarker = null, _pdbPickerEntryId = null, _pdbPickerAddrIdx = null;

function _pdb_addressModalHTML(entryId, addrIdx = null) {
  const entry = (AppData.pdbEntries||[]).find(e => e.id === entryId);
  const addr  = addrIdx !== null ? (entry?.addresses||[])[addrIdx] : null;
  return `
  <div class="modal-header">
    <h2 class="modal-title">${addr ? '✏️ تعديل العنوان' : '📍 عنوان جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px;max-height:80vh;overflow-y:auto">
    <div class="form-group">
      <label class="form-label">اسم/تسمية العنوان</label>
      <input class="form-control" id="pdb-addr-label" value="${escHtml(addr?.label||'')}" placeholder="مثال: الفرع الرئيسي، فرع المدينة..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">العنوان التفصيلي كتابياً</label>
      <textarea class="form-control" id="pdb-addr-text" rows="2" placeholder="الشارع، الحي، المدينة...">${escHtml(addr?.text||'')}</textarea>
    </div>

    <!-- خريطة الموقع -->
    <div class="form-group">
      <label class="form-label">📍 الموقع على الخريطة</label>
      <div id="pdb-map-canvas" style="height:280px;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:10px;background:var(--bg-card)"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label class="form-label" style="font-size:11px">خط العرض (Lat)</label>
          <input class="form-control" type="number" step="0.000001" id="pdb-addr-lat" value="${addr?.lat||''}" placeholder="مثال: 14.5439">
        </div>
        <div>
          <label class="form-label" style="font-size:11px">خط الطول (Lng)</label>
          <input class="form-control" type="number" step="0.000001" id="pdb-addr-lng" value="${addr?.lng||''}" placeholder="مثال: 49.1202">
        </div>
      </div>
      <button type="button" class="pdb-btn pdb-btn-secondary" style="margin-top:8px;width:100%" onclick="pdb_initMap('${entryId}',${addrIdx??'null'})">
        🗺️ اختر الموقع من الخريطة
      </button>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pdb_submitAddress('${entryId}',${addrIdx??'null'})">✅ حفظ العنوان</button>
    </div>
  </div>`;
}

window.pdb_openAddAddressModal  = function(entryId)           { openModal(_pdb_addressModalHTML(entryId),        'large'); };
window.pdb_openEditAddressModal = function(entryId, addrIdx)  { openModal(_pdb_addressModalHTML(entryId, addrIdx),'large'); };

window.pdb_initMap = function(entryId, addrIdx) {
  if (typeof mapboxgl === 'undefined') { toast('مكتبة الخرائط غير متوفرة', 'warning'); return; }
  const latEl = document.getElementById('pdb-addr-lat');
  const lngEl = document.getElementById('pdb-addr-lng');
  const lat = parseFloat(latEl?.value) || 14.5439;
  const lng = parseFloat(lngEl?.value) || 49.1202;

  if (_pdbPickerMap) { _pdbPickerMap.remove(); _pdbPickerMap = null; }
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  _pdbPickerMap = new mapboxgl.Map({
    container: 'pdb-map-canvas',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [lng, lat],
    zoom: 13
  });
  _pdbPickerMap.addControl(new mapboxgl.NavigationControl(), 'top-left');

  const el = document.createElement('div');
  el.style.cssText = 'width:32px;height:32px;background:url("https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/solid/location-dot.svg") center/contain no-repeat;filter:drop-shadow(0 2px 4px rgba(139,92,246,0.6));cursor:grab;';
  _pdbPickerMarker = new mapboxgl.Marker({ element: el, draggable: true })
    .setLngLat([lng, lat])
    .addTo(_pdbPickerMap);

  _pdbPickerMarker.on('dragend', () => {
    const pos = _pdbPickerMarker.getLngLat();
    if (latEl) latEl.value = pos.lat.toFixed(6);
    if (lngEl) lngEl.value = pos.lng.toFixed(6);
  });
  _pdbPickerMap.on('click', (ev) => {
    _pdbPickerMarker.setLngLat(ev.lngLat);
    if (latEl) latEl.value = ev.lngLat.lat.toFixed(6);
    if (lngEl) lngEl.value = ev.lngLat.lng.toFixed(6);
  });
};

window.pdb_submitAddress = async function(entryId, addrIdx) {
  const label = document.getElementById('pdb-addr-label')?.value?.trim();
  const text  = document.getElementById('pdb-addr-text')?.value?.trim();
  const lat   = parseFloat(document.getElementById('pdb-addr-lat')?.value) || null;
  const lng   = parseFloat(document.getElementById('pdb-addr-lng')?.value) || null;

  showLoader('جاري حفظ العنوان...');
  try {
    const entry = (AppData.pdbEntries||[]).find(e => e.id === entryId);
    if (!entry) throw new Error('المزود غير موجود');
    const addresses = [...(entry.addresses||[])];
    const addrObj = { label:label||'', text:text||'', lat, lng, images: addrIdx !== null ? (addresses[addrIdx]?.images||[]) : [] };
    if (addrIdx !== null) {
      addresses[addrIdx] = addrObj;
    } else {
      addresses.push(addrObj);
    }
    await db.collection(PDB_ENTRIES_COL).doc(entryId).update({ addresses, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await pdb_reload();
    hideLoader(); closeModal();
    toast('✅ تم حفظ العنوان', 'success');
    render();
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); }
};

window.pdb_confirmDeleteAddress = function(entryId, addrIdx) {
  if (!confirm('حذف هذا العنوان وصوره؟ لا يمكن التراجع.')) return;
  showLoader('جاري الحذف...');
  (async () => {
    try {
      const entry = (AppData.pdbEntries||[]).find(e => e.id === entryId);
      const addresses = (entry?.addresses||[]).filter((_, i) => i !== addrIdx);
      await db.collection(PDB_ENTRIES_COL).doc(entryId).update({ addresses, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      await pdb_reload();
      hideLoader(); toast('✅ تم حذف العنوان', 'success');
      render();
    } catch (e) { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); }
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — صور المحل
// ══════════════════════════════════════════════════════════════════════
window.pdb_openAddImageModal = function(entryId, addrIdx) {
  openModal(`
  <div class="modal-header">
    <h2 class="modal-title">📷 إضافة صورة للمحل</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="form-group">
      <label class="form-label">رابط الصورة (URL)</label>
      <input class="form-control" id="pdb-img-url" placeholder="https://..." autofocus>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">أدخل رابط صورة مباشر (HTTPS)</div>
    </div>
    <div id="pdb-img-preview" style="display:none;text-align:center">
      <img id="pdb-img-preview-el" style="max-width:100%;max-height:180px;border-radius:10px;border:1px solid var(--border)">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pdb_submitImage('${entryId}',${addrIdx})">✅ إضافة الصورة</button>
    </div>
  </div>`);

  setTimeout(() => {
    const inp = document.getElementById('pdb-img-url');
    if (inp) inp.addEventListener('input', function() {
      const url = this.value.trim();
      const prev = document.getElementById('pdb-img-preview');
      const img  = document.getElementById('pdb-img-preview-el');
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        img.src = url; prev.style.display = '';
      } else { prev.style.display = 'none'; }
    });
  }, 100);
};

window.pdb_submitImage = async function(entryId, addrIdx) {
  const url = document.getElementById('pdb-img-url')?.value?.trim();
  if (!url) { toast('أدخل رابط الصورة', 'warning'); return; }
  showLoader('جاري الإضافة...');
  try {
    const entry = (AppData.pdbEntries||[]).find(e => e.id === entryId);
    if (!entry) throw new Error('المزود غير موجود');
    const addresses = [...(entry.addresses||[])];
    if (!addresses[addrIdx]) throw new Error('العنوان غير موجود');
    addresses[addrIdx] = { ...addresses[addrIdx], images: [...(addresses[addrIdx].images||[]), url] };
    await db.collection(PDB_ENTRIES_COL).doc(entryId).update({ addresses, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await pdb_reload();
    hideLoader(); closeModal();
    toast('✅ تمت إضافة الصورة', 'success');
    render();
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); }
};

window.pdb_deleteAddressImage = function(entryId, addrIdx, imgIdx) {
  if (!confirm('حذف هذه الصورة؟')) return;
  showLoader();
  (async () => {
    try {
      const entry = (AppData.pdbEntries||[]).find(e => e.id === entryId);
      const addresses = [...(entry?.addresses||[])];
      addresses[addrIdx] = { ...addresses[addrIdx], images: (addresses[addrIdx].images||[]).filter((_,i)=>i!==imgIdx) };
      await db.collection(PDB_ENTRIES_COL).doc(entryId).update({ addresses, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      await pdb_reload();
      hideLoader(); toast('✅ تم حذف الصورة', 'success');
      render();
    } catch (e) { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); }
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  API عامة — للاستخدام في نظام ربط المنتجات
// ══════════════════════════════════════════════════════════════════════

/**
 * يعيد قائمة مزودين اختيار منسّقة للاستخدام في نافذة ربط المنتجات.
 * @returns {Array} [{ id, name, phone, catName, subcatName, addresses }]
 */
window.pdb_getAllProvidersList = function() {
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const entries = AppData.pdbEntries || [];
  return entries.filter(e => e.active !== false).map(e => {
    const cat    = cats.find(c => c.id === e.catId);
    const subcat = subcats.find(s => s.id === e.subcatId);
    return {
      id:          e.id,
      name:        e.name || '—',
      phone:       e.phone || '',
      catName:     cat?.name || '',
      subcatName:  subcat?.name || '',
      linkedUserId:e.linkedUserId || null,
      addresses:   e.addresses || [],
    };
  });
};

/**
 * يعيد بيانات مزود واحد بالكامل.
 */
window.pdb_getProvider = function(id) {
  return (AppData.pdbEntries||[]).find(e => e.id === id) || null;
};

// ══════════════════════════════════════════════════════════════════════
//  مساعدات
// ══════════════════════════════════════════════════════════════════════
function _pdb_breadcrumb(items) {
  return `
  <nav class="pdb-breadcrumb">
    ${items.map((item, idx) => `
    ${idx > 0 ? '<span class="pdb-bc-sep">›</span>' : ''}
    ${item.onclick
      ? `<button class="pdb-bc-btn" onclick="${item.onclick}">${item.label}</button>`
      : `<span class="pdb-bc-current">${item.label}</span>`}
    `).join('')}
  </nav>`;
}

function _pdb_styles() {
  if (document.getElementById('pdb-styles')) return '';
  return `
  <style id="pdb-styles">
    .pdb-wrap { padding: 20px; max-width: 1100px; margin: 0 auto; font-family: 'Cairo', sans-serif; }
    .pdb-page-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:24px; }
    .pdb-page-title  { font-size:22px; font-weight:900; margin:0; color:var(--text-main); }
    .pdb-page-sub    { color:var(--text-muted); font-size:13px; margin:4px 0 0; }
    .pdb-kpi-row     { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:28px; }
    .pdb-kpi         { display:flex; align-items:center; gap:12px; padding:14px 20px; background:var(--glass-bg); border:1px solid var(--border); border-radius:14px; flex:1; min-width:120px; }
    .pdb-kpi-icon    { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
    .pdb-kpi-val     { font-size:24px; font-weight:900; line-height:1; }
    .pdb-kpi-lbl     { font-size:12px; color:var(--text-muted); margin-top:2px; }

    .pdb-cats-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
    .pdb-card        { background:var(--glass-bg); border:1.5px solid var(--border); border-radius:18px; overflow:hidden; cursor:pointer; transition:border-color 0.2s,box-shadow 0.2s,transform 0.15s; position:relative; }
    .pdb-card:hover  { border-color:var(--primary); box-shadow:0 4px 24px rgba(139,92,246,0.14); transform:translateY(-2px); }
    .pdb-cat-card    {}
    .pdb-cat-header  { display:flex; align-items:center; gap:14px; padding:18px 16px 12px; }
    .pdb-cat-icon-wrap { width:52px; height:52px; border-radius:14px; background:rgba(139,92,246,0.1); display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }
    .pdb-cat-info    { flex:1; min-width:0; }
    .pdb-cat-title   { font-size:16px; font-weight:800; color:var(--text-main); }
    .pdb-cat-desc    { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .pdb-cat-arrow   { color:var(--text-muted); font-size:20px; padding-left:4px; }
    .pdb-cat-footer  { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px; border-top:1px solid var(--border); background:rgba(255,255,255,0.01); }
    .pdb-cat-actions { position:absolute; top:10px; left:10px; display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
    .pdb-card:hover .pdb-cat-actions { opacity:1; }
    .pdb-stat-chip   { font-size:11.5px; background:var(--bg-card); border:1px solid var(--border); border-radius:20px; padding:3px 9px; color:var(--text-secondary); white-space:nowrap; }
    .pdb-chip-warn   { background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.3); color:#f59e0b; }
    .pdb-chip-ok     { background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.3); color:#10b981; }

    .pdb-breadcrumb  { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:18px; }
    .pdb-bc-btn      { background:none; border:none; cursor:pointer; color:var(--primary); font-size:14px; font-weight:600; font-family:'Cairo',sans-serif; padding:3px 6px; border-radius:6px; transition:background 0.15s; }
    .pdb-bc-btn:hover{ background:rgba(139,92,246,0.1); }
    .pdb-bc-sep      { color:var(--text-muted); font-size:16px; }
    .pdb-bc-current  { font-size:14px; color:var(--text-muted); padding:3px 6px; }

    .pdb-search-row  { margin-bottom:18px; }
    .pdb-search-wrap { position:relative; }
    .pdb-search-icon { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:15px; color:var(--text-muted); pointer-events:none; }
    .pdb-search-input{ width:100%; padding:10px 38px 10px 14px; border:1.5px solid var(--border); border-radius:10px; background:var(--glass-bg); color:var(--text-main); font-family:'Cairo',sans-serif; font-size:14px; transition:border-color 0.2s; box-sizing:border-box; }
    .pdb-search-input:focus { outline:none; border-color:var(--primary); }

    .pdb-subcats-list { display:flex; flex-direction:column; gap:10px; }
    .pdb-subcat-row  { display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--glass-bg); border:1.5px solid var(--border); border-radius:14px; cursor:pointer; transition:all 0.2s; }
    .pdb-subcat-row:hover { border-color:var(--primary); background:rgba(139,92,246,0.04); }
    .pdb-subcat-icon { font-size:26px; flex-shrink:0; }
    .pdb-subcat-body { flex:1; min-width:0; }
    .pdb-subcat-name { font-size:15px; font-weight:700; color:var(--text-main); }
    .pdb-subcat-desc { font-size:12px; color:var(--text-muted); }
    .pdb-subcat-meta { display:flex; gap:6px; flex-shrink:0; }
    .pdb-subcat-actions { display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
    .pdb-subcat-row:hover .pdb-subcat-actions { opacity:1; }
    .pdb-subcat-arrow { color:var(--text-muted); font-size:18px; }

    .pdb-entries-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
    .pdb-entry-card  { background:var(--glass-bg); border:1.5px solid var(--border); border-radius:16px; padding:16px; cursor:pointer; transition:all 0.2s; position:relative; display:flex; flex-direction:column; gap:10px; }
    .pdb-entry-card:hover { border-color:var(--primary); box-shadow:0 4px 20px rgba(139,92,246,0.12); }
    .pdb-entry-avatar{ width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg,var(--primary),#7c3aed); display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:900; overflow:hidden; margin:0 auto; }
    .pdb-entry-body  { text-align:center; }
    .pdb-entry-name  { font-size:15px; font-weight:800; color:var(--text-main); }
    .pdb-entry-phone { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .pdb-entry-notes { font-size:11px; color:var(--text-muted); margin-top:4px; }
    .pdb-entry-chips { display:flex; justify-content:center; flex-wrap:wrap; gap:5px; margin-top:6px; }
    .pdb-entry-actions { position:absolute; top:8px; left:8px; display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
    .pdb-entry-card:hover .pdb-entry-actions { opacity:1; }

    .pdb-provider-hero { display:flex; align-items:flex-start; gap:20px; background:var(--glass-bg); border:1.5px solid var(--border); border-radius:18px; padding:24px; margin-bottom:28px; flex-wrap:wrap; }
    .pdb-provider-avatar-lg { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,var(--primary),#7c3aed); display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:900; flex-shrink:0; }
    .pdb-provider-hero-info { flex:1; min-width:0; }
    .pdb-provider-name { font-size:20px; font-weight:900; margin:0 0 8px; }
    .pdb-provider-meta-row { display:flex; flex-wrap:wrap; gap:6px; }
    .pdb-meta-badge  { font-size:12px; padding:4px 10px; border-radius:20px; background:var(--bg-card); border:1px solid var(--border); }
    .pdb-badge-warn  { background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.3); color:#f59e0b; }
    .pdb-badge-ok    { background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.3); color:#10b981; }
    .pdb-provider-notes { font-size:13px; color:var(--text-muted); margin-top:10px; line-height:1.6; }

    .pdb-addresses-section { }
    .pdb-section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .pdb-section-title { font-size:17px; font-weight:800; margin:0; }
    .pdb-addresses-list { display:flex; flex-direction:column; gap:14px; }
    .pdb-address-card { background:var(--glass-bg); border:1.5px solid var(--border); border-radius:16px; padding:18px; }
    .pdb-address-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px; }
    .pdb-address-label-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .pdb-address-label { font-size:14px; font-weight:800; color:var(--text-main); }
    .pdb-map-link    { font-size:12px; color:var(--primary); text-decoration:none; padding:3px 8px; border:1px solid rgba(139,92,246,0.3); border-radius:6px; transition:background 0.15s; }
    .pdb-map-link:hover { background:rgba(139,92,246,0.08); }
    .pdb-address-actions { display:flex; gap:4px; }
    .pdb-address-text { font-size:13px; color:var(--text-secondary); margin-bottom:8px; }
    .pdb-coords-row  { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
    .pdb-coord-chip  { font-size:11px; font-family:monospace; background:rgba(139,92,246,0.08); color:#8b5cf6; border:1px solid rgba(139,92,246,0.2); border-radius:6px; padding:2px 8px; }
    .pdb-images-strip{ display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; align-items:flex-end; }
    .pdb-img-wrap    { position:relative; width:80px; height:80px; border-radius:10px; overflow:hidden; border:1px solid var(--border); flex-shrink:0; }
    .pdb-img-wrap img{ width:100%;height:100%;object-fit:cover; }
    .pdb-img-del     { position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; line-height:1; }
    .pdb-add-img-btn { padding:6px 12px; border:1.5px dashed rgba(139,92,246,0.35); border-radius:10px; background:rgba(139,92,246,0.04); color:var(--primary); cursor:pointer; font-family:'Cairo',sans-serif; font-size:12px; font-weight:700; transition:all 0.15s; white-space:nowrap; }
    .pdb-add-img-btn:hover { background:rgba(139,92,246,0.1); border-color:var(--primary); }

    .pdb-btn         { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px 18px; border:none; border-radius:10px; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; }
    .pdb-btn-primary { background:var(--primary); color:#fff; box-shadow:0 2px 10px rgba(139,92,246,0.3); }
    .pdb-btn-primary:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .pdb-btn-secondary { background:var(--glass-bg); color:var(--text-main); border:1.5px solid var(--border); }
    .pdb-btn-secondary:hover { border-color:var(--primary); color:var(--primary); }
    .pdb-btn-sm      { padding:6px 12px; font-size:13px; border-radius:8px; }
    .pdb-icon-btn    { background:var(--glass-bg); border:1px solid var(--border); border-radius:8px; padding:5px 8px; cursor:pointer; font-size:14px; transition:all 0.15s; }
    .pdb-icon-btn:hover { border-color:var(--primary); background:rgba(139,92,246,0.08); }
    .pdb-icon-btn.danger:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
    .pdb-empty       { text-align:center; padding:50px 20px; background:rgba(139,92,246,0.02); border:2px dashed rgba(139,92,246,0.15); border-radius:20px; }
    .pdb-empty-icon  { font-size:48px; margin-bottom:14px; }
    .pdb-empty h3    { color:var(--text-secondary); font-family:'Cairo',sans-serif; margin-bottom:8px; }
    .pdb-empty p     { color:var(--text-muted); margin-bottom:18px; font-size:13px; }
    @media (max-width:600px) {
      .pdb-cats-grid   { grid-template-columns:1fr; }
      .pdb-entries-grid{ grid-template-columns:1fr; }
      .pdb-provider-hero { flex-direction:column; align-items:center; text-align:center; }
    }
  </style>`;
}
