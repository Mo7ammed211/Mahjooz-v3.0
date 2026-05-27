'use strict';
/* ══════════════════════════════════════════════════════════════════════
   قاعدة بيانات مندوبين التوصيل — Phase 47
   بنية هرمية: تصنيفات → فئات فرعية → مندوبون
   مرئية فقط للإدارة
   ══════════════════════════════════════════════════════════════════════ */

const DDB_CATS_COL    = 'ddb_cats';
const DDB_SUBCATS_COL = 'ddb_subcats';
const DDB_ENTRIES_COL = 'ddb_entries';

// ── تهيئة الحالة ─────────────────────────────────────────────────────
function _ddbState() {
  if (!State._ddb) {
    State._ddb = { view:'cats', catId:null, subcatId:null, entryId:null, search:'' };
  }
  return State._ddb;
}

// ── تحميل البيانات ───────────────────────────────────────────────────
window.ddb_reload = async function () {
  try {
    const [cats, subcats, entries] = await Promise.all([
      db.collection(DDB_CATS_COL).orderBy('order','asc').get().catch(() => db.collection(DDB_CATS_COL).get()),
      db.collection(DDB_SUBCATS_COL).orderBy('order','asc').get().catch(() => db.collection(DDB_SUBCATS_COL).get()),
      db.collection(DDB_ENTRIES_COL).orderBy('createdAt','desc').get().catch(() => db.collection(DDB_ENTRIES_COL).get()),
    ]);
    AppData.ddbCats    = cats.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.ddbSubcats = subcats.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.ddbEntries = entries.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('ddb_reload error', e);
    AppData.ddbCats    = AppData.ddbCats    || [];
    AppData.ddbSubcats = AppData.ddbSubcats || [];
    AppData.ddbEntries = AppData.ddbEntries || [];
  }
};

// ══════════════════════════════════════════════════════════════════════
//  المدخل الرئيسي
// ══════════════════════════════════════════════════════════════════════
window.renderAdminDriversDatabase = function () {
  const st = _ddbState();
  try {
    if (st.view === 'entry')   return _ddb_renderEntryDetail();
    if (st.view === 'entries') return _ddb_renderEntriesList();
    if (st.view === 'subcats') return _ddb_renderSubcatsList();
    return _ddb_renderCatsList();
  } catch (err) {
    console.error('renderAdminDriversDatabase error', err);
    return `<div style="padding:30px;color:#ef4444;font-family:monospace;white-space:pre-wrap;">${err.message}</div>`;
  }
};

// ══════════════════════════════════════════════════════════════════════
//  ① التصنيفات
// ══════════════════════════════════════════════════════════════════════
function _ddb_renderCatsList() {
  const cats    = AppData.ddbCats    || [];
  const subcats = AppData.ddbSubcats || [];
  const entries = AppData.ddbEntries || [];

  return `
  ${_ddb_styles()}
  <div class="ddb-wrap">
    <div class="ddb-page-header">
      <div>
        <h2 class="ddb-page-title">🚗 قاعدة بيانات مندوبين التوصيل</h2>
        <p class="ddb-page-sub">إدارة هرمية: تصنيفات ← فئات فرعية ← مندوبون</p>
      </div>
      <button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddCatModal()">＋ تصنيف جديد</button>
    </div>

    <!-- KPIs -->
    <div class="ddb-kpi-row">
      <div class="ddb-kpi">
        <div class="ddb-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">🏢</div>
        <div><div class="ddb-kpi-val">${cats.length}</div><div class="ddb-kpi-lbl">تصنيف</div></div>
      </div>
      <div class="ddb-kpi">
        <div class="ddb-kpi-icon" style="background:rgba(16,185,129,0.12);color:#10b981">📂</div>
        <div><div class="ddb-kpi-val">${subcats.length}</div><div class="ddb-kpi-lbl">فئة فرعية</div></div>
      </div>
      <div class="ddb-kpi">
        <div class="ddb-kpi-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">🚗</div>
        <div><div class="ddb-kpi-val">${entries.length}</div><div class="ddb-kpi-lbl">مندوب</div></div>
      </div>
      <div class="ddb-kpi">
        <div class="ddb-kpi-icon" style="background:rgba(239,68,68,0.12);color:#ef4444">✅</div>
        <div><div class="ddb-kpi-val">${entries.filter(e=>e.active!==false).length}</div><div class="ddb-kpi-lbl">نشط</div></div>
      </div>
    </div>

    ${cats.length === 0 ? `
    <div class="ddb-empty">
      <div class="ddb-empty-icon">🚗</div>
      <h3>لا توجد تصنيفات بعد</h3>
      <p>أنشئ تصنيفاً لتنظيم مندوبي التوصيل</p>
      <button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddCatModal()">＋ إضافة أول تصنيف</button>
    </div>` : `
    <div class="ddb-cats-grid">
      ${cats.map(c => {
        const cSubs    = subcats.filter(s => s.catId === c.id);
        const cEntries = entries.filter(e => e.catId === c.id);
        return `
        <div class="ddb-card" onclick="ddb_goSubcats('${c.id}')" style="opacity:${c.active!==false?1:0.6}">
          <div class="ddb-cat-header">
            <div class="ddb-cat-icon-wrap">${escHtml(c.icon||'🚗')}</div>
            <div class="ddb-cat-info">
              <div class="ddb-cat-title">${escHtml(c.name)}</div>
              ${c.desc ? `<div class="ddb-cat-desc">${escHtml(c.desc)}</div>` : ''}
            </div>
            <div class="ddb-cat-arrow">›</div>
          </div>
          <div class="ddb-cat-footer">
            <span class="ddb-chip">📂 ${cSubs.length} فئة</span>
            <span class="ddb-chip">🚗 ${cEntries.length} مندوب</span>
          </div>
          <div class="ddb-cat-actions" onclick="event.stopPropagation()">
            <button class="ddb-icon-btn" onclick="ddb_openEditCatModal('${c.id}')" title="تعديل">✏️</button>
            <button class="ddb-icon-btn danger" onclick="ddb_confirmDeleteCat('${c.id}','${escAttr(c.name)}')" title="حذف">🗑️</button>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ② الفئات الفرعية
// ══════════════════════════════════════════════════════════════════════
function _ddb_renderSubcatsList() {
  const st      = _ddbState();
  const cats    = AppData.ddbCats    || [];
  const subcats = AppData.ddbSubcats || [];
  const entries = AppData.ddbEntries || [];
  const cat     = cats.find(c => c.id === st.catId);
  const my      = subcats.filter(s => s.catId === st.catId);
  const sq      = (st.search||'').toLowerCase().trim();
  const filtered = sq ? my.filter(s => (s.name||'').toLowerCase().includes(sq)) : my;

  return `
  ${_ddb_styles()}
  <div class="ddb-wrap">
    ${_ddb_breadcrumb([
      { label: '🚗 قاعدة المندوبين', onclick: "ddb_goHome()" },
      { label: escHtml(cat?.name||'—') }
    ])}
    <div class="ddb-page-header">
      <div>
        <h2 class="ddb-page-title">${escHtml(cat?.icon||'🚗')} ${escHtml(cat?.name||'—')}</h2>
        <p class="ddb-page-sub">${escHtml(cat?.desc||'')}</p>
      </div>
      <button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddSubcatModal('${st.catId}')">＋ فئة فرعية</button>
    </div>
    <div class="ddb-search-row">
      <div class="ddb-search-wrap">
        <span class="ddb-search-icon">🔍</span>
        <input class="ddb-search-input" placeholder="بحث في الفئات الفرعية..."
               value="${escAttr(st.search||'')}" oninput="State._ddb.search=this.value; render()">
      </div>
    </div>
    ${filtered.length === 0 ? `
    <div class="ddb-empty">
      <div class="ddb-empty-icon">📂</div>
      <h3>${sq ? 'لا توجد نتائج' : 'لا توجد فئات فرعية'}</h3>
      ${!sq ? `<button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddSubcatModal('${st.catId}')">＋ إضافة فئة فرعية</button>` : ''}
    </div>` : `
    <div class="ddb-subcats-list">
      ${filtered.map(s => {
        const cnt = entries.filter(e => e.subcatId === s.id).length;
        return `
        <div class="ddb-subcat-row" onclick="ddb_goEntries('${s.id}')">
          <div class="ddb-subcat-icon">${escHtml(s.icon||'📂')}</div>
          <div class="ddb-subcat-body">
            <div class="ddb-subcat-name">${escHtml(s.name)}</div>
            ${s.desc ? `<div class="ddb-subcat-desc">${escHtml(s.desc)}</div>` : ''}
          </div>
          <div class="ddb-subcat-meta"><span class="ddb-chip">🚗 ${cnt} مندوب</span></div>
          <div class="ddb-subcat-actions" onclick="event.stopPropagation()">
            <button class="ddb-icon-btn" onclick="ddb_openEditSubcatModal('${s.id}')" title="تعديل">✏️</button>
            <button class="ddb-icon-btn danger" onclick="ddb_confirmDeleteSubcat('${s.id}','${escAttr(s.name)}')" title="حذف">🗑️</button>
          </div>
          <div class="ddb-subcat-arrow">›</div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ③ قائمة المندوبين
// ══════════════════════════════════════════════════════════════════════
const DDB_VEHICLE_TYPES = ['دراجة نارية','سيارة صغيرة','سيارة متوسطة','سيارة كبيرة (فان)','شاحنة صغيرة','دراجة هوائية'];

function _ddb_renderEntriesList() {
  const st      = _ddbState();
  const cats    = AppData.ddbCats    || [];
  const subcats = AppData.ddbSubcats || [];
  const entries = AppData.ddbEntries || [];
  const cat     = cats.find(c => c.id === st.catId);
  const subcat  = subcats.find(s => s.id === st.subcatId);
  const my      = entries.filter(e => e.subcatId === st.subcatId);
  const sq      = (st.search||'').toLowerCase().trim();
  const filtered = sq ? my.filter(e => (e.name||'').toLowerCase().includes(sq)||(e.phone||'').includes(sq)||(e.vehicleNumber||'').toLowerCase().includes(sq)) : my;

  return `
  ${_ddb_styles()}
  <div class="ddb-wrap">
    ${_ddb_breadcrumb([
      { label: '🚗 قاعدة المندوبين', onclick: "ddb_goHome()" },
      { label: escHtml(cat?.name||'—'), onclick: `ddb_goSubcats('${st.catId}')` },
      { label: escHtml(subcat?.name||'—') }
    ])}
    <div class="ddb-page-header">
      <div>
        <h2 class="ddb-page-title">${escHtml(subcat?.icon||'📂')} ${escHtml(subcat?.name||'—')}</h2>
        <p class="ddb-page-sub">${my.length} مندوب في هذه الفئة</p>
      </div>
      <button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddEntryModal('${st.catId}','${st.subcatId}')">＋ مندوب جديد</button>
    </div>
    <div class="ddb-search-row">
      <div class="ddb-search-wrap">
        <span class="ddb-search-icon">🔍</span>
        <input class="ddb-search-input" placeholder="بحث بالاسم أو الهاتف أو رقم المركبة..."
               value="${escAttr(st.search||'')}" oninput="State._ddb.search=this.value; render()">
      </div>
    </div>
    ${filtered.length === 0 ? `
    <div class="ddb-empty">
      <div class="ddb-empty-icon">🚗</div>
      <h3>${sq ? 'لا توجد نتائج' : 'لا يوجد مندوبون بعد'}</h3>
      ${!sq ? `<button class="ddb-btn ddb-btn-primary" onclick="ddb_openAddEntryModal('${st.catId}','${st.subcatId}')">＋ إضافة مندوب</button>` : ''}
    </div>` : `
    <div class="ddb-entries-list">
      ${filtered.map(e => `
      <div class="ddb-entry-row">
        <div class="ddb-entry-avatar-sm">${(e.name||'م').charAt(0).toUpperCase()}</div>
        <div class="ddb-entry-body">
          <div class="ddb-entry-name">${escHtml(e.name||'—')}</div>
          <div class="ddb-entry-sub">
            ${e.phone ? `📞 ${escHtml(e.phone)}` : ''}
            ${e.vehicleType ? ` · 🚗 ${escHtml(e.vehicleType)}` : ''}
            ${e.vehicleNumber ? ` · 🔢 ${escHtml(e.vehicleNumber)}` : ''}
          </div>
          ${e.coverageAreas ? `<div class="ddb-entry-coverage">📍 ${escHtml(e.coverageAreas)}</div>` : ''}
        </div>
        <div class="ddb-entry-status">
          ${e.active!==false
            ? `<span class="ddb-chip" style="background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:#10b981">✅ نشط</span>`
            : `<span class="ddb-chip" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#ef4444">⛔ معطّل</span>`}
        </div>
        <div class="ddb-entry-actions">
          ${e.linkedUserId ? `<button class="ddb-icon-btn" onclick="adminSendDriverMessage('${e.linkedUserId}','${escAttr(e.name||'')}')" title="مراسلة المندوب" style="color:#7c3aed">📨</button>` : ''}
          <button class="ddb-icon-btn" onclick="ddb_openEditEntryModal('${e.id}')" title="تعديل">✏️</button>
          <button class="ddb-icon-btn danger" onclick="ddb_confirmDeleteEntry('${e.id}','${escAttr(e.name||'')}')" title="حذف">🗑️</button>
        </div>
      </div>`).join('')}
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  ④ تفاصيل المندوب
// ══════════════════════════════════════════════════════════════════════
function _ddb_renderEntryDetail() {
  const st      = _ddbState();
  const cats    = AppData.ddbCats    || [];
  const subcats = AppData.ddbSubcats || [];
  const entries = AppData.ddbEntries || [];
  const entry   = entries.find(e => e.id === st.entryId);
  if (!entry) return `<div class="ddb-wrap" style="padding:40px;text-align:center;color:var(--text-muted)">المندوب غير موجود <button class="ddb-btn ddb-btn-secondary" style="margin-top:12px" onclick="ddb_goHome()">رجوع</button></div>`;
  const cat    = cats.find(c => c.id === entry.catId);
  const subcat = subcats.find(s => s.id === entry.subcatId);
  const linkedUser = entry.linkedUserId ? (AppData.users||[]).find(u=>u.id===entry.linkedUserId) : null;

  return `
  ${_ddb_styles()}
  <div class="ddb-wrap">
    ${_ddb_breadcrumb([
      { label: '🚗 قاعدة المندوبين', onclick: "ddb_goHome()" },
      { label: escHtml(cat?.name||'—'), onclick: `ddb_goSubcats('${entry.catId}')` },
      { label: escHtml(subcat?.name||'—'), onclick: `ddb_goEntries('${entry.subcatId}')` },
      { label: escHtml(entry.name||'—') }
    ])}

    <div class="ddb-driver-hero">
      <div class="ddb-driver-avatar-lg">🚗</div>
      <div class="ddb-driver-hero-info">
        <h2 class="ddb-driver-name">${escHtml(entry.name||'—')}</h2>
        <div class="ddb-driver-meta-row">
          ${entry.phone ? `<span class="ddb-meta-badge">📞 ${escHtml(entry.phone)}</span>` : ''}
          ${entry.vehicleType ? `<span class="ddb-meta-badge">🚗 ${escHtml(entry.vehicleType)}</span>` : ''}
          ${entry.vehicleNumber ? `<span class="ddb-meta-badge">🔢 ${escHtml(entry.vehicleNumber)}</span>` : ''}
          ${entry.active===false
            ? `<span class="ddb-meta-badge" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#ef4444">⛔ معطّل</span>`
            : `<span class="ddb-meta-badge" style="background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:#10b981">✅ نشط</span>`}
        </div>
        ${entry.coverageAreas ? `<div style="font-size:13px;color:var(--text-muted);margin-top:8px">📍 مناطق التغطية: ${escHtml(entry.coverageAreas)}</div>` : ''}
        ${entry.notes ? `<div style="font-size:13px;color:var(--text-muted);margin-top:6px;line-height:1.6">${escHtml(entry.notes)}</div>` : ''}
        ${linkedUser ? `<div style="font-size:12px;color:var(--primary);margin-top:8px">🔗 مرتبط بحساب: ${escHtml(linkedUser.name||linkedUser.email||'—')}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${entry.linkedUserId ? `
        <button class="ddb-btn" style="background:linear-gradient(135deg,rgba(124,58,237,0.12),rgba(13,148,136,0.12));border:1.5px solid rgba(124,58,237,0.3);color:#7c3aed;font-weight:800"
                onclick="adminSendDriverMessage('${entry.linkedUserId}','${escAttr(entry.name||'')}')">
          📨 مراسلة المندوب
        </button>
        <button class="ddb-btn ddb-btn-secondary" style="font-size:12px"
                onclick="adminViewDriverMessages('${entry.linkedUserId}','${escAttr(entry.name||'')}')">
          📜 سجل الرسائل
        </button>` : `
        <div style="font-size:12px;color:var(--text-muted);padding:6px 0">⚠️ لا يمكن المراسلة — المندوب غير مرتبط بحساب مستخدم</div>`}
        <button class="ddb-btn ddb-btn-secondary" onclick="ddb_openEditEntryModal('${entry.id}')">✏️ تعديل</button>
      </div>
    </div>

    <!-- الأرشيف الإضافي -->
    ${entry.notes ? '' : `
    <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:16px;margin-top:20px;text-align:center;color:var(--text-muted);font-size:13px">
      💡 يمكن إضافة ملاحظات أو بيانات تشغيلية من زر التعديل
    </div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
//  التنقل
// ══════════════════════════════════════════════════════════════════════
window.ddb_goHome    = function() { Object.assign(_ddbState(),{view:'cats',catId:null,subcatId:null,entryId:null,search:''}); render(); };
window.ddb_goSubcats = function(catId) { Object.assign(_ddbState(),{view:'subcats',catId,subcatId:null,entryId:null,search:''}); render(); };
window.ddb_goEntries = function(subcatId) {
  const s = (AppData.ddbSubcats||[]).find(s=>s.id===subcatId);
  Object.assign(_ddbState(),{view:'entries',subcatId,catId:s?.catId||_ddbState().catId,entryId:null,search:''});
  render();
};
window.ddb_goEntry = function(entryId) { Object.assign(_ddbState(),{view:'entry',entryId,search:''}); render(); };

// ══════════════════════════════════════════════════════════════════════
//  CRUD — التصنيفات
// ══════════════════════════════════════════════════════════════════════
const _DDB_ICONS = ['🚗','🏍️','🚐','🚚','🚴','📦','🏢','🌍','🏙️','🏘️','🛵','🚕','🚛','🔵','🟡','🔴','⭐','🌟','✅','🔧'];

function _ddb_catModalHTML(cat=null) {
  const selIcon = cat?.icon||'🚗';
  return `
  <div class="modal-header">
    <h2 class="modal-title">${cat?'✏️ تعديل التصنيف':'🚗 تصنيف جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="form-group">
      <label class="form-label">اسم التصنيف <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="ddb-cat-name" value="${escHtml(cat?.name||'')}" placeholder="مثال: مندوبو المكلا، مندوبو عدن..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الوصف (اختياري)</label>
      <input class="form-control" id="ddb-cat-desc" value="${escHtml(cat?.desc||'')}" placeholder="وصف مختصر">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px" id="ddb-cat-icon-grid">
        ${_DDB_ICONS.map(ic=>`
        <div onclick="ddb_selectCatIcon(this,'${ic}')"
             style="padding:10px;font-size:20px;border:2px solid ${ic===selIcon?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;background:${ic===selIcon?'rgba(59,130,246,0.1)':'rgba(255,255,255,0.02)'}">
          ${ic}
        </div>`).join('')}
      </div>
      <input type="hidden" id="ddb-cat-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" type="number" min="1" id="ddb-cat-order" value="${cat?.order||''}" placeholder="1, 2, 3...">
    </div>
    ${cat?`
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="ddb-cat-active" ${cat.active!==false?'checked':''} style="width:16px;height:16px;accent-color:#3b82f6">
      <span>تصنيف مفعّل</span>
    </label>`:''}
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="ddb_submitCat(${cat?`'${cat.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.ddb_selectCatIcon = function(el,icon) {
  document.querySelectorAll('#ddb-cat-icon-grid>div').forEach(d=>{d.style.borderColor='var(--border)';d.style.background='rgba(255,255,255,0.02)';});
  el.style.borderColor='var(--primary)'; el.style.background='rgba(59,130,246,0.1)';
  document.getElementById('ddb-cat-icon').value=icon;
};

window.ddb_openAddCatModal  = function() { openModal(_ddb_catModalHTML()); };
window.ddb_openEditCatModal = function(id) {
  const c=(AppData.ddbCats||[]).find(c=>c.id===id);
  if(c) openModal(_ddb_catModalHTML(c));
};

window.ddb_submitCat = async function(id=null) {
  const name  = document.getElementById('ddb-cat-name')?.value?.trim();
  const desc  = document.getElementById('ddb-cat-desc')?.value?.trim();
  const icon  = document.getElementById('ddb-cat-icon')?.value||'🚗';
  const order = parseInt(document.getElementById('ddb-cat-order')?.value)||(AppData.ddbCats||[]).length+1;
  const active= id?(document.getElementById('ddb-cat-active')?.checked!==false):true;
  if(!name){toast('اسم التصنيف مطلوب','error');return;}
  showLoader('جاري الحفظ...');
  try{
    const payload={name,desc:desc||'',icon,order,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(id){ await db.collection(DDB_CATS_COL).doc(id).update(payload); }
    else  { payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(DDB_CATS_COL).add(payload); }
    await ddb_reload(); hideLoader(); closeModal();
    toast(`✅ تم ${id?'تحديث':'إضافة'} التصنيف`,'success'); render();
  }catch(e){hideLoader();toast('خطأ: '+(e.message||e),'error');}
};

window.ddb_confirmDeleteCat = function(id,name) {
  const cnt=(AppData.ddbEntries||[]).filter(e=>e.catId===id).length;
  if(!confirm(`حذف تصنيف "${name}"؟${cnt>0?`\nسيُحذف معه ${cnt} مندوب.`:''} لا يمكن التراجع.`)) return;
  showLoader('جاري الحذف...');
  (async()=>{
    try{
      const subIds=(AppData.ddbSubcats||[]).filter(s=>s.catId===id).map(s=>s.id);
      await Promise.all(subIds.map(sid=>db.collection(DDB_SUBCATS_COL).doc(sid).delete()));
      const eIds=(AppData.ddbEntries||[]).filter(e=>e.catId===id).map(e=>e.id);
      await Promise.all(eIds.map(eid=>db.collection(DDB_ENTRIES_COL).doc(eid).delete()));
      await db.collection(DDB_CATS_COL).doc(id).delete();
      await ddb_reload(); hideLoader(); toast('✅ تم الحذف','success'); ddb_goHome();
    }catch(e){hideLoader();toast('خطأ: '+(e.message||e),'error');}
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — الفئات الفرعية
// ══════════════════════════════════════════════════════════════════════
function _ddb_subcatModalHTML(catId,sub=null) {
  const icons=['📂','🚗','🏍️','📦','🌍','🏙️','🏘️','🏢','🔵','🟡'];
  const selIcon=sub?.icon||'📂';
  return `
  <div class="modal-header">
    <h2 class="modal-title">${sub?'✏️ تعديل الفئة الفرعية':'📂 فئة فرعية جديدة'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="form-group">
      <label class="form-label">اسم الفئة الفرعية <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="ddb-sub-name" value="${escHtml(sub?.name||'')}" placeholder="مثال: مندوبو الصيدليات، مندوبو المتاجر..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الوصف (اختياري)</label>
      <input class="form-control" id="ddb-sub-desc" value="${escHtml(sub?.desc||'')}" placeholder="وصف مختصر">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px" id="ddb-sub-icon-grid">
        ${icons.map(ic=>`
        <div onclick="ddb_selectSubIcon(this,'${ic}')"
             style="padding:10px;font-size:20px;border:2px solid ${ic===selIcon?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;background:${ic===selIcon?'rgba(59,130,246,0.1)':'rgba(255,255,255,0.02)'}">
          ${ic}
        </div>`).join('')}
      </div>
      <input type="hidden" id="ddb-sub-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" type="number" min="1" id="ddb-sub-order" value="${sub?.order||''}" placeholder="1, 2, 3...">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="ddb_submitSubcat('${catId}',${sub?`'${sub.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.ddb_selectSubIcon = function(el,icon) {
  document.querySelectorAll('#ddb-sub-icon-grid>div').forEach(d=>{d.style.borderColor='var(--border)';d.style.background='rgba(255,255,255,0.02)';});
  el.style.borderColor='var(--primary)'; el.style.background='rgba(59,130,246,0.1)';
  document.getElementById('ddb-sub-icon').value=icon;
};

window.ddb_openAddSubcatModal  = function(catId) { openModal(_ddb_subcatModalHTML(catId)); };
window.ddb_openEditSubcatModal = function(id) {
  const s=(AppData.ddbSubcats||[]).find(s=>s.id===id);
  if(s) openModal(_ddb_subcatModalHTML(s.catId,s));
};

window.ddb_submitSubcat = async function(catId,id=null) {
  const name  = document.getElementById('ddb-sub-name')?.value?.trim();
  const desc  = document.getElementById('ddb-sub-desc')?.value?.trim();
  const icon  = document.getElementById('ddb-sub-icon')?.value||'📂';
  const order = parseInt(document.getElementById('ddb-sub-order')?.value)||((AppData.ddbSubcats||[]).filter(s=>s.catId===catId).length+1);
  if(!name){toast('اسم الفئة الفرعية مطلوب','error');return;}
  showLoader('جاري الحفظ...');
  try{
    const payload={name,desc:desc||'',icon,order,catId,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(id){ await db.collection(DDB_SUBCATS_COL).doc(id).update(payload); }
    else  { payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(DDB_SUBCATS_COL).add(payload); }
    await ddb_reload(); hideLoader(); closeModal();
    toast(`✅ تم ${id?'تحديث':'إضافة'} الفئة الفرعية`,'success'); render();
  }catch(e){hideLoader();toast('خطأ: '+(e.message||e),'error');}
};

window.ddb_confirmDeleteSubcat = function(id,name) {
  const cnt=(AppData.ddbEntries||[]).filter(e=>e.subcatId===id).length;
  if(!confirm(`حذف فئة "${name}"؟${cnt>0?`\nسيُحذف معها ${cnt} مندوب.`:''} لا يمكن التراجع.`)) return;
  showLoader('جاري الحذف...');
  (async()=>{
    try{
      const eIds=(AppData.ddbEntries||[]).filter(e=>e.subcatId===id).map(e=>e.id);
      await Promise.all(eIds.map(eid=>db.collection(DDB_ENTRIES_COL).doc(eid).delete()));
      await db.collection(DDB_SUBCATS_COL).doc(id).delete();
      await ddb_reload(); hideLoader(); toast('✅ تم الحذف','success'); render();
    }catch(e){hideLoader();toast('خطأ: '+(e.message||e),'error');}
  })();
};

// ══════════════════════════════════════════════════════════════════════
//  CRUD — المندوبون
// ══════════════════════════════════════════════════════════════════════
function _ddb_entryModalHTML(catId,subcatId,entry=null) {
  const users=(AppData.users||[]).filter(u=>u.role==='driver');
  return `
  <div class="modal-header">
    <h2 class="modal-title">${entry?'✏️ تعديل بيانات المندوب':'🚗 مندوب جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:14px;max-height:75vh;overflow-y:auto">
    <div class="form-group">
      <label class="form-label">اسم المندوب <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="ddb-entry-name" value="${escHtml(entry?.name||'')}" placeholder="الاسم الكامل" autofocus>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">رقم الهاتف</label>
        <input class="form-control" id="ddb-entry-phone" value="${escHtml(entry?.phone||'')}" placeholder="+967...">
      </div>
      <div class="form-group">
        <label class="form-label">نوع المركبة</label>
        <select class="form-control" id="ddb-entry-vehicle-type">
          <option value="">— اختر النوع —</option>
          ${DDB_VEHICLE_TYPES.map(v=>`<option value="${v}" ${entry?.vehicleType===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">رقم لوحة المركبة</label>
        <input class="form-control" id="ddb-entry-vehicle-num" value="${escHtml(entry?.vehicleNumber||'')}" placeholder="مثال: YM 12345">
      </div>
      <div class="form-group">
        <label class="form-label">مناطق التغطية</label>
        <input class="form-control" id="ddb-entry-coverage" value="${escHtml(entry?.coverageAreas||'')}" placeholder="المكلا، الشحر...">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">ملاحظات (اختياري)</label>
      <textarea class="form-control" id="ddb-entry-notes" rows="2" placeholder="أي ملاحظات إضافية...">${escHtml(entry?.notes||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">ربط بحساب مندوب على المنصة (اختياري)</label>
      <select class="form-control" id="ddb-entry-uid">
        <option value="">— لا يوجد حساب مرتبط —</option>
        ${users.map(u=>`<option value="${u.id}" ${entry?.linkedUserId===u.id?'selected':''}>${escHtml(u.name||u.email||u.id)}</option>`).join('')}
      </select>
    </div>
    ${entry?`
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="ddb-entry-active" ${entry.active!==false?'checked':''} style="width:16px;height:16px;accent-color:#3b82f6">
      <span>مندوب نشط</span>
    </label>`:''}
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="ddb_submitEntry('${catId}','${subcatId}',${entry?`'${entry.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.ddb_openAddEntryModal  = function(catId,subcatId) { openModal(_ddb_entryModalHTML(catId,subcatId)); };
window.ddb_openEditEntryModal = function(id) {
  const e=(AppData.ddbEntries||[]).find(e=>e.id===id);
  if(e) openModal(_ddb_entryModalHTML(e.catId,e.subcatId,e));
};

window.ddb_submitEntry = async function(catId,subcatId,id=null) {
  const name        = document.getElementById('ddb-entry-name')?.value?.trim();
  const phone       = document.getElementById('ddb-entry-phone')?.value?.trim();
  const vehicleType = document.getElementById('ddb-entry-vehicle-type')?.value;
  const vehicleNum  = document.getElementById('ddb-entry-vehicle-num')?.value?.trim();
  const coverage    = document.getElementById('ddb-entry-coverage')?.value?.trim();
  const notes       = document.getElementById('ddb-entry-notes')?.value?.trim();
  const uid         = document.getElementById('ddb-entry-uid')?.value;
  const active      = id?(document.getElementById('ddb-entry-active')?.checked!==false):true;
  if(!name){toast('اسم المندوب مطلوب','error');return;}
  showLoader('جاري الحفظ...');
  try{
    const payload={name,phone:phone||'',vehicleType:vehicleType||'',vehicleNumber:vehicleNum||'',coverageAreas:coverage||'',notes:notes||'',catId,subcatId,linkedUserId:uid||null,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    let newId=id;
    if(id){ await db.collection(DDB_ENTRIES_COL).doc(id).update(payload); }
    else  { payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); const ref=await db.collection(DDB_ENTRIES_COL).add(payload); newId=ref.id; }
    await ddb_reload(); hideLoader(); closeModal();
    toast(`✅ تم ${id?'تحديث':'إضافة'} المندوب`,'success');
    ddb_goEntry(newId);
  }catch(e){hideLoader();toast('خطأ: '+(e.message||e),'error');}
};

window.ddb_confirmDeleteEntry = function(id,name) {
  if(!confirm(`حذف المندوب "${name}"؟ لا يمكن التراجع.`)) return;
  showLoader('جاري الحذف...');
  db.collection(DDB_ENTRIES_COL).doc(id).delete()
    .then(()=>ddb_reload())
    .then(()=>{ hideLoader(); toast('✅ تم الحذف','success'); Object.assign(_ddbState(),{view:'entries',entryId:null}); render(); })
    .catch(e=>{hideLoader();toast('خطأ: '+(e.message||e),'error');});
};

// ══════════════════════════════════════════════════════════════════════
//  مساعدات
// ══════════════════════════════════════════════════════════════════════
function _ddb_breadcrumb(items) {
  return `<nav class="ddb-breadcrumb">
    ${items.map((item,idx)=>`
    ${idx>0?'<span class="ddb-bc-sep">›</span>':''}
    ${item.onclick
      ?`<button class="ddb-bc-btn" onclick="${item.onclick}">${item.label}</button>`
      :`<span class="ddb-bc-current">${item.label}</span>`}
    `).join('')}
  </nav>`;
}

function _ddb_styles() {
  if (document.getElementById('ddb-styles')) return '';
  return `
  <style id="ddb-styles">
    .ddb-wrap { padding:20px; max-width:1100px; margin:0 auto; font-family:'Cairo',sans-serif; }
    .ddb-page-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:24px; }
    .ddb-page-title  { font-size:22px; font-weight:900; margin:0; color:var(--text-main); }
    .ddb-page-sub    { color:var(--text-muted); font-size:13px; margin:4px 0 0; }
    .ddb-kpi-row     { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:28px; }
    .ddb-kpi         { display:flex; align-items:center; gap:12px; padding:14px 20px; background:var(--glass-bg); border:1px solid var(--border); border-radius:14px; flex:1; min-width:120px; }
    .ddb-kpi-icon    { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
    .ddb-kpi-val     { font-size:24px; font-weight:900; line-height:1; }
    .ddb-kpi-lbl     { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .ddb-cats-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
    .ddb-card        { background:var(--glass-bg); border:1.5px solid var(--border); border-radius:18px; overflow:hidden; cursor:pointer; transition:all 0.2s; position:relative; }
    .ddb-card:hover  { border-color:#3b82f6; box-shadow:0 4px 24px rgba(59,130,246,0.14); transform:translateY(-2px); }
    .ddb-cat-header  { display:flex; align-items:center; gap:14px; padding:18px 16px 12px; }
    .ddb-cat-icon-wrap { width:52px; height:52px; border-radius:14px; background:rgba(59,130,246,0.1); display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }
    .ddb-cat-info    { flex:1; min-width:0; }
    .ddb-cat-title   { font-size:15px; font-weight:800; color:var(--text-main); }
    .ddb-cat-desc    { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .ddb-cat-arrow   { color:var(--text-muted); font-size:20px; }
    .ddb-cat-footer  { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px; border-top:1px solid var(--border); background:rgba(255,255,255,0.01); }
    .ddb-cat-actions { position:absolute; top:10px; left:10px; display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
    .ddb-card:hover .ddb-cat-actions { opacity:1; }
    .ddb-chip        { font-size:11.5px; background:var(--bg-card); border:1px solid var(--border); border-radius:20px; padding:3px 9px; color:var(--text-secondary); white-space:nowrap; }
    .ddb-breadcrumb  { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:18px; }
    .ddb-bc-btn      { background:none; border:none; cursor:pointer; color:#3b82f6; font-size:14px; font-weight:600; font-family:'Cairo',sans-serif; padding:3px 6px; border-radius:6px; transition:background 0.15s; }
    .ddb-bc-btn:hover{ background:rgba(59,130,246,0.1); }
    .ddb-bc-sep      { color:var(--text-muted); font-size:16px; }
    .ddb-bc-current  { font-size:14px; color:var(--text-muted); padding:3px 6px; }
    .ddb-search-row  { margin-bottom:18px; }
    .ddb-search-wrap { position:relative; }
    .ddb-search-icon { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:15px; color:var(--text-muted); pointer-events:none; }
    .ddb-search-input{ width:100%; padding:10px 38px 10px 14px; border:1.5px solid var(--border); border-radius:10px; background:var(--glass-bg); color:var(--text-main); font-family:'Cairo',sans-serif; font-size:14px; transition:border-color 0.2s; box-sizing:border-box; }
    .ddb-search-input:focus { outline:none; border-color:#3b82f6; }
    .ddb-subcats-list { display:flex; flex-direction:column; gap:10px; }
    .ddb-subcat-row  { display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--glass-bg); border:1.5px solid var(--border); border-radius:14px; cursor:pointer; transition:all 0.2s; }
    .ddb-subcat-row:hover { border-color:#3b82f6; background:rgba(59,130,246,0.04); }
    .ddb-subcat-icon { font-size:26px; flex-shrink:0; }
    .ddb-subcat-body { flex:1; min-width:0; }
    .ddb-subcat-name { font-size:15px; font-weight:700; color:var(--text-main); }
    .ddb-subcat-desc { font-size:12px; color:var(--text-muted); }
    .ddb-subcat-meta { display:flex; gap:6px; flex-shrink:0; }
    .ddb-subcat-actions { display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
    .ddb-subcat-row:hover .ddb-subcat-actions { opacity:1; }
    .ddb-subcat-arrow { color:var(--text-muted); font-size:18px; }
    .ddb-entries-list{ display:flex; flex-direction:column; gap:10px; }
    .ddb-entry-row   { display:flex; align-items:center; gap:14px; padding:14px 18px; background:var(--glass-bg); border:1.5px solid var(--border); border-radius:14px; transition:border-color 0.2s; }
    .ddb-entry-row:hover { border-color:#3b82f6; }
    .ddb-entry-avatar-sm { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; font-weight:900; flex-shrink:0; }
    .ddb-entry-body  { flex:1; min-width:0; }
    .ddb-entry-name  { font-size:15px; font-weight:800; color:var(--text-main); }
    .ddb-entry-sub   { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .ddb-entry-coverage { font-size:11.5px; color:var(--text-muted); margin-top:3px; }
    .ddb-entry-status{ flex-shrink:0; }
    .ddb-entry-actions { display:flex; gap:4px; flex-shrink:0; }
    .ddb-driver-hero { display:flex; align-items:flex-start; gap:20px; background:var(--glass-bg); border:1.5px solid var(--border); border-radius:18px; padding:24px; margin-bottom:28px; flex-wrap:wrap; }
    .ddb-driver-avatar-lg { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center; font-size:32px; flex-shrink:0; }
    .ddb-driver-hero-info { flex:1; min-width:0; }
    .ddb-driver-name { font-size:20px; font-weight:900; margin:0 0 8px; }
    .ddb-driver-meta-row { display:flex; flex-wrap:wrap; gap:6px; }
    .ddb-meta-badge  { font-size:12px; padding:4px 10px; border-radius:20px; background:var(--bg-card); border:1px solid var(--border); }
    .ddb-btn         { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px 18px; border:none; border-radius:10px; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; }
    .ddb-btn-primary { background:#3b82f6; color:#fff; box-shadow:0 2px 10px rgba(59,130,246,0.3); }
    .ddb-btn-primary:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .ddb-btn-secondary { background:var(--glass-bg); color:var(--text-main); border:1.5px solid var(--border); }
    .ddb-btn-secondary:hover { border-color:#3b82f6; color:#3b82f6; }
    .ddb-icon-btn    { background:var(--glass-bg); border:1px solid var(--border); border-radius:8px; padding:5px 8px; cursor:pointer; font-size:14px; transition:all 0.15s; }
    .ddb-icon-btn:hover { border-color:#3b82f6; background:rgba(59,130,246,0.08); }
    .ddb-icon-btn.danger:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
    .ddb-empty       { text-align:center; padding:50px 20px; background:rgba(59,130,246,0.02); border:2px dashed rgba(59,130,246,0.15); border-radius:20px; }
    .ddb-empty-icon  { font-size:48px; margin-bottom:14px; }
    .ddb-empty h3    { color:var(--text-secondary); font-family:'Cairo',sans-serif; margin-bottom:8px; }
    .ddb-empty p     { color:var(--text-muted); margin-bottom:18px; font-size:13px; }
    @media (max-width:600px) {
      .ddb-cats-grid  { grid-template-columns:1fr; }
      .ddb-driver-hero{ flex-direction:column; align-items:center; text-align:center; }
    }
  </style>`;
}
