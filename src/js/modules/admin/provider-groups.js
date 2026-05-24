'use strict';
/* ══════════════════════════════════════════════════════════════
   نظام فروع وتصنيفات مزودي الخدمات
   - CRUD كامل للفروع (إضافة، تعديل، حذف)
   - ربط كل مزود بفرع معين
   - اختيار ذكي بخطوتين في نماذج الخدمات والمتاجر
   ══════════════════════════════════════════════════════════════ */

// ─── تحميل الفروع من Firestore ──────────────────────────────
window.pg_loadGroups = async function () {
  try {
    const snap = await db.collection('provider_groups')
      .orderBy('order', 'asc')
      .get();
    AppData.providerGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    try {
      const snap2 = await db.collection('provider_groups').get();
      AppData.providerGroups = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) {
      AppData.providerGroups = [];
    }
  }
  return AppData.providerGroups || [];
};

window.pg_init = function () {
  if (typeof AppData !== 'undefined') {
    AppData.providerGroups = AppData.providerGroups || [];
  }
};
pg_init();

// ─── حفظ فرع (إضافة أو تعديل) ──────────────────────────────
window.pg_saveGroup = async function (data, id = null) {
  const groups = AppData.providerGroups || [];
  const payload = {
    name:   (data.name || '').trim(),
    icon:   (data.icon || '🏢').trim(),
    desc:   (data.desc || '').trim(),
    active: data.active !== false,
    order:  Number(data.order) || (groups.length + 1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!payload.name) throw new Error('اسم الفرع مطلوب');
  if (id) {
    await db.collection('provider_groups').doc(id).update(payload);
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('provider_groups').add(payload);
  }
  await pg_loadGroups();
};

// ─── حذف فرع ────────────────────────────────────────────────
window.pg_deleteGroup = async function (id) {
  const vendors = (AppData.users || []).filter(u => u.providerGroupId === id);
  if (vendors.length > 0) {
    await Promise.all(vendors.map(v =>
      db.collection('users').doc(v.id).update({ providerGroupId: null })
    ));
  }
  await db.collection('provider_groups').doc(id).delete();
  await pg_loadGroups();
};

// ─── تحديث فرع مزود الخدمة ─────────────────────────────────
window.pg_setVendorGroup = async function (vendorId, groupId) {
  await db.collection('users').doc(vendorId).update({
    providerGroupId: groupId || null
  });
  const u = (AppData.users || []).find(u => u.id === vendorId);
  if (u) u.providerGroupId = groupId || null;
};

// ══════════════════════════════════════════════════════════════
//  واجهة الأدمن — صفحة إدارة الفروع
// ══════════════════════════════════════════════════════════════
window.renderAdminProviderGroups = function () {
  const groups  = AppData.providerGroups || [];
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));

  const activeGroups   = groups.filter(g => g.active !== false);
  const inactiveGroups = groups.filter(g => g.active === false);
  const ungrouped      = vendors.filter(v => !v.providerGroupId);

  return `
  <style>
    .pg-group-card {
      background: var(--glass-bg);
      border: 1.5px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 14px;
    }
    .pg-group-card:hover { border-color: var(--primary); box-shadow: 0 4px 20px rgba(139,92,246,0.1); }
    .pg-group-header {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px;
      cursor: pointer;
    }
    .pg-group-icon {
      width: 48px; height: 48px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
      background: rgba(139,92,246,0.12);
    }
    .pg-vendor-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 10px; font-size: 13px;
      font-weight: 600; border: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
      font-family: 'Cairo', sans-serif;
      transition: all 0.15s;
    }
    .pg-vendor-chip:hover { border-color: var(--primary); background: rgba(139,92,246,0.06); }
    .pg-add-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 10px; font-size: 13px;
      font-weight: 700; border: 1.5px dashed rgba(139,92,246,0.35);
      background: rgba(139,92,246,0.04); color: var(--primary);
      cursor: pointer; font-family: 'Cairo', sans-serif;
      transition: all 0.15s;
    }
    .pg-add-btn:hover { background: rgba(139,92,246,0.1); border-color: var(--primary); }
    .pg-empty { text-align:center; padding:70px 20px; background:rgba(139,92,246,0.02); border:2px dashed rgba(139,92,246,0.15); border-radius:20px; }
    .pg-stat { display:flex; align-items:center; gap:10px; padding:16px 20px; background:var(--glass-bg); border:1px solid var(--border); border-radius:14px; flex:1; min-width:130px; }
    .pg-stat-icon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
  </style>

  <!-- ─── الترويسة ─────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800;font-size:22px">🏢 فروع مزودي الخدمات</h2>
      <p style="color:var(--text-muted);font-size:13px;margin:5px 0 0">تصنيف مزودي الخدمات في فروع منظّمة لسهولة الاختيار عند إنشاء الخدمات والمتاجر</p>
    </div>
    <button class="btn btn-primary" onclick="pg_openAddGroupModal()">+ إضافة فرع جديد</button>
  </div>

  <!-- ─── إحصائيات ─────────────────────────────────────────── -->
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px">
    <div class="pg-stat">
      <div class="pg-stat-icon" style="background:rgba(139,92,246,0.12);color:#8b5cf6">🏢</div>
      <div>
        <div style="font-size:22px;font-weight:900;font-family:'Cairo',sans-serif">${groups.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">إجمالي الفروع</div>
      </div>
    </div>
    <div class="pg-stat">
      <div class="pg-stat-icon" style="background:rgba(16,185,129,0.12);color:#10b981">✅</div>
      <div>
        <div style="font-size:22px;font-weight:900;font-family:'Cairo',sans-serif">${activeGroups.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">فروع مفعّلة</div>
      </div>
    </div>
    <div class="pg-stat">
      <div class="pg-stat-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">👤</div>
      <div>
        <div style="font-size:22px;font-weight:900;font-family:'Cairo',sans-serif">${vendors.length - ungrouped.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">مزود مصنّف</div>
      </div>
    </div>
    <div class="pg-stat">
      <div class="pg-stat-icon" style="background:rgba(249,115,22,0.12);color:#f97316">⚠️</div>
      <div>
        <div style="font-size:22px;font-weight:900;font-family:'Cairo',sans-serif">${ungrouped.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">غير مصنّف</div>
      </div>
    </div>
  </div>

  <!-- ─── قائمة الفروع ─────────────────────────────────────── -->
  ${groups.length === 0 ? `
  <div class="pg-empty">
    <div style="font-size:52px;margin-bottom:16px">🏢</div>
    <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif;margin-bottom:8px">لا توجد فروع بعد</h3>
    <p style="color:var(--text-muted);margin-bottom:20px">أنشئ فروعاً لتصنيف مزودي الخدمات (مثال: مزودو الفنادق، المهن، العيادات)</p>
    <button class="btn btn-primary" onclick="pg_openAddGroupModal()">+ إضافة أول فرع</button>
  </div>` : `
  <div id="pg-groups-list">
    ${groups.map(g => {
      const gVendors = vendors.filter(v => v.providerGroupId === g.id);
      const isActive = g.active !== false;
      return `
      <div class="pg-group-card" style="border-color:${isActive ? 'var(--border)' : 'rgba(239,68,68,0.25)'}">
        <div class="pg-group-header" onclick="pg_toggleGroupBody('${g.id}')">
          <div class="pg-group-icon">${escHtml(g.icon || '🏢')}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:16px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">${escHtml(g.name)}</span>
              ${!isActive ? `<span class="badge badge-rose" style="font-size:10px">معطّل</span>` : `<span class="badge badge-teal" style="font-size:10px">مفعّل</span>`}
              <span style="font-size:12px;color:var(--text-muted)">${gVendors.length} مزود</span>
            </div>
            ${g.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${escHtml(g.desc)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="pg_openAddVendorToGroupModal('${g.id}')" style="font-size:12px;padding:5px 10px">+ مزود</button>
            <button class="btn btn-sm btn-secondary" onclick="pg_openEditGroupModal('${g.id}')" style="padding:5px 8px" title="تعديل">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="pg_confirmDeleteGroup('${g.id}','${escHtml(g.name)}')" style="padding:5px 8px" title="حذف">🗑️</button>
            <span style="color:var(--text-muted);font-size:18px" id="pg-arrow-${g.id}">⌄</span>
          </div>
        </div>
        <div id="pg-body-${g.id}" style="padding:0 20px 16px;border-top:1px solid var(--border)">
          ${gVendors.length === 0 ? `
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">
            لا يوجد مزودون في هذا الفرع بعد
            <br><button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="pg_openAddVendorToGroupModal('${g.id}')">+ إضافة مزود</button>
          </div>` : `
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:14px">
            ${gVendors.map(v => `
            <div class="pg-vendor-chip">
              <span style="font-size:10px;color:#10b981">●</span>
              <span>${escHtml(v.name || v.email || '—')}</span>
              <button onclick="pg_confirmRemoveVendorFromGroup('${v.id}','${escHtml(v.name || '')}','${g.id}')"
                      style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;color:var(--text-muted)"
                      title="إزالة من الفرع">✕</button>
            </div>`).join('')}
            <button class="pg-add-btn" onclick="pg_openAddVendorToGroupModal('${g.id}')">+ إضافة مزود</button>
          </div>`}
        </div>
      </div>`;
    }).join('')}
  </div>

  ${inactiveGroups.length > 0 ? `
  <div style="margin-top:10px;font-size:12px;color:var(--text-muted)">
    ${inactiveGroups.length} فرع معطّل — يمكن تفعيله من زر التعديل
  </div>` : ''}
  `}

  <!-- ─── المزودون غير المصنّفين ────────────────────────────── -->
  ${ungrouped.length > 0 ? `
  <div style="margin-top:24px;padding:16px 20px;background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.25);border-radius:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-weight:700;font-size:14px;color:#f97316">⚠️ مزودون غير مصنّفين (${ungrouped.length})</div>
      <div style="font-size:12px;color:var(--text-muted)">هؤلاء لن يظهروا ضمن أي فرع عند اختيار المزود</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${ungrouped.map(v => `
      <div class="pg-vendor-chip" style="border-color:rgba(249,115,22,0.3)">
        <span style="font-size:10px;color:#f97316">●</span>
        <span>${escHtml(v.name || v.email || '—')}</span>
        <button onclick="pg_openAssignGroupModal('${v.id}','${escHtml(v.name || '')}')"
                style="background:none;border:none;cursor:pointer;font-size:11px;padding:0 2px;color:var(--primary)"
                title="تصنيف في فرع">تصنيف ←</button>
      </div>`).join('')}
    </div>
  </div>` : ''}
  `;
};

// ══════════════════════════════════════════════════════════════
//  Toggle جسم الفرع
// ══════════════════════════════════════════════════════════════
window.pg_toggleGroupBody = function (id) {
  const body  = document.getElementById(`pg-body-${id}`);
  const arrow = document.getElementById(`pg-arrow-${id}`);
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (arrow) arrow.style.transform = hidden ? 'rotate(180deg)' : '';
};

// ══════════════════════════════════════════════════════════════
//  مودال إضافة / تعديل فرع
// ══════════════════════════════════════════════════════════════
function _pg_groupModalHTML(g = null) {
  const icons = ['🏢','🏨','🏥','🔧','🛠️','💼','🏪','🎓','🚗','✈️','🍽️','💊','🏋️','📦','🧹','💇','🌿','🔑','🧰','🎨'];
  const selIcon = g?.icon || '🏢';
  return `
  <div class="modal-header">
    <h2 class="modal-title">${g ? '✏️ تعديل الفرع' : '🏢 إضافة فرع جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
    <div class="form-group">
      <label class="form-label">اسم الفرع <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="pg-name" value="${escHtml(g?.name||'')}" placeholder="مثال: مزودو الفنادق، المهن، العيادات..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الوصف (اختياري)</label>
      <input class="form-control" id="pg-desc" value="${escHtml(g?.desc||'')}" placeholder="وصف مختصر للفرع">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px" id="pg-icon-grid">
        ${icons.map(ic => `
        <div onclick="pg_selectIcon(this,'${ic}')"
             style="padding:10px;font-size:22px;border:2px solid ${ic===selIcon?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;background:${ic===selIcon?'rgba(139,92,246,0.1)':'rgba(255,255,255,0.02)'}"
             ${ic===selIcon?'id="pg-icon-selected"':''}>
          ${ic}
        </div>`).join('')}
      </div>
      <input type="hidden" id="pg-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" id="pg-order" type="number" min="1" value="${g?.order||''}" placeholder="1, 2, 3...">
    </div>
    ${g ? `
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" id="pg-active" ${g.active!==false?'checked':''} style="width:16px;height:16px">
        <span>فرع مفعّل</span>
      </label>
    </div>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pg_submitGroup(${g?`'${g.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.pg_selectIcon = function (el, icon) {
  document.querySelectorAll('#pg-icon-grid > div').forEach(d => {
    d.style.borderColor = 'var(--border)';
    d.style.background  = 'rgba(255,255,255,0.02)';
  });
  el.style.borderColor = 'var(--primary)';
  el.style.background  = 'rgba(139,92,246,0.1)';
  document.getElementById('pg-icon').value = icon;
};

window.pg_openAddGroupModal  = function () { openModal(_pg_groupModalHTML()); };
window.pg_openEditGroupModal = function (id) {
  const g = (AppData.providerGroups || []).find(g => g.id === id);
  if (g) openModal(_pg_groupModalHTML(g));
};

window.pg_submitGroup = async function (id = null) {
  const name   = document.getElementById('pg-name')?.value?.trim();
  const desc   = document.getElementById('pg-desc')?.value?.trim();
  const icon   = document.getElementById('pg-icon')?.value?.trim() || '🏢';
  const order  = document.getElementById('pg-order')?.value;
  const active = id ? (document.getElementById('pg-active')?.checked !== false) : true;
  if (!name) { toast('اسم الفرع مطلوب', 'error'); return; }
  showLoader('جاري الحفظ...');
  try {
    await pg_saveGroup({ name, desc, icon, order, active }, id);
    hideLoader();
    closeModal();
    toast(`✅ تم ${id ? 'تحديث' : 'إضافة'} الفرع`, 'success');
    render();
  } catch (e) {
    hideLoader();
    toast('خطأ: ' + (e.message || e), 'error');
  }
};

window.pg_confirmDeleteGroup = function (id, name) {
  const vendors = (AppData.users || []).filter(u => u.providerGroupId === id);
  const msg = vendors.length > 0
    ? `حذف فرع "${name}"؟ سيتم إلغاء تصنيف ${vendors.length} مزود.`
    : `حذف فرع "${name}"؟ لا يمكن التراجع.`;
  if (!confirm(msg)) return;
  showLoader('جاري الحذف...');
  pg_deleteGroup(id)
    .then(() => { hideLoader(); toast('✅ تم الحذف', 'success'); render(); })
    .catch(e => { hideLoader(); toast('خطأ: ' + (e.message || e), 'error'); });
};

// ══════════════════════════════════════════════════════════════
//  مودال إضافة مزود لفرع
// ══════════════════════════════════════════════════════════════
window.pg_openAddVendorToGroupModal = function (groupId) {
  const group   = (AppData.providerGroups || []).find(g => g.id === groupId);
  const vendors = (AppData.users || []).filter(u => ['vendor','provider'].includes(u.role));
  const already = vendors.filter(v => v.providerGroupId === groupId);
  const others  = vendors.filter(v => v.providerGroupId !== groupId);

  openModal(`
  <div class="modal-header">
    <h2 class="modal-title">➕ إضافة مزود لـ "${escHtml(group?.name||'')}"</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:16px">
    <input class="form-control" id="pg-vendor-search" placeholder="🔍 ابحث بالاسم أو البريد..."
           oninput="pg_filterVendorModal(this.value)" style="margin-bottom:12px">
    <div style="max-height:400px;overflow-y:auto" id="pg-vendor-modal-list">
      ${others.length === 0 ? `<p style="text-align:center;color:var(--text-muted);padding:20px">جميع المزودين مصنّفون في هذا الفرع أو فروع أخرى</p>` :
        others.map(v => `
        <label class="vendor-item" data-name="${escHtml((v.name||v.email||'').toLowerCase())}"
               style="display:flex;align-items:center;gap:12px;margin-bottom:8px;cursor:pointer;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);transition:all 0.2s">
          <input type="checkbox" class="pg-vendor-add-cb" value="${v.id}"
                 ${already.some(a=>a.id===v.id)?'checked':''} style="width:18px;height:18px;accent-color:var(--primary)">
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${escHtml(v.name||'—')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escHtml(v.email||v.phone||'')}
              ${v.providerGroupId && v.providerGroupId !== groupId
                ? `<span style="color:#f97316"> · ينتمي لفرع آخر</span>`
                : ''}</div>
          </div>
        </label>`).join('')
      }
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="pg_submitAddVendors('${groupId}')">✅ حفظ التصنيف</button>
    </div>
  </div>`);
};

window.pg_filterVendorModal = function (q) {
  const query = (q || '').toLowerCase();
  document.querySelectorAll('#pg-vendor-modal-list .vendor-item').forEach(item => {
    item.style.display = (item.dataset.name || '').includes(query) ? '' : 'none';
  });
};

window.pg_submitAddVendors = async function (groupId) {
  const checked = Array.from(document.querySelectorAll('.pg-vendor-add-cb:checked')).map(cb => cb.value);
  if (checked.length === 0) { toast('لم تختر أي مزود', 'warning'); return; }
  showLoader('جاري الحفظ...');
  try {
    await Promise.all(checked.map(vid => pg_setVendorGroup(vid, groupId)));
    hideLoader();
    closeModal();
    toast(`✅ تم تصنيف ${checked.length} مزود`, 'success');
    await loadAllData();
    render();
  } catch (e) {
    hideLoader();
    toast('خطأ: ' + (e.message || e), 'error');
  }
};

// ── مودال تصنيف مزود غير مصنّف ───────────────────────────────
window.pg_openAssignGroupModal = function (vendorId, vendorName) {
  const groups = AppData.providerGroups || [];
  openModal(`
  <div class="modal-header">
    <h2 class="modal-title">🏢 تصنيف "${escHtml(vendorName)}" في فرع</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
    ${groups.length === 0 ? `<p style="color:var(--text-muted);text-align:center">لا توجد فروع بعد. أضف فرعاً أولاً.</p>` :
      groups.map(g => `
      <button onclick="pg_assignAndClose('${vendorId}','${g.id}')"
              style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:var(--glass-bg);border:1.5px solid var(--border);cursor:pointer;transition:all 0.2s;width:100%"
              onmouseenter="this.style.borderColor='var(--primary)';this.style.background='rgba(139,92,246,0.06)'"
              onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--glass-bg)'">
        <span style="font-size:22px">${escHtml(g.icon||'🏢')}</span>
        <div style="text-align:right;flex:1">
          <div style="font-weight:700;font-size:15px;font-family:'Cairo',sans-serif">${escHtml(g.name)}</div>
          ${g.desc ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(g.desc)}</div>` : ''}
        </div>
        <span style="color:var(--text-muted)">←</span>
      </button>`).join('')
    }
    <button class="btn btn-secondary btn-sm" onclick="closeModal()" style="margin-top:4px">إلغاء</button>
  </div>`);
};

window.pg_assignAndClose = async function (vendorId, groupId) {
  showLoader('جاري الحفظ...');
  try {
    await pg_setVendorGroup(vendorId, groupId);
    hideLoader(); closeModal();
    toast('✅ تم التصنيف', 'success');
    render();
  } catch (e) { hideLoader(); toast('خطأ: ' + (e.message||e), 'error'); }
};

// ── تأكيد إزالة مزود من فرع ──────────────────────────────────
window.pg_confirmRemoveVendorFromGroup = function (vendorId, vendorName, groupId) {
  if (!confirm(`إزالة "${vendorName}" من هذا الفرع؟`)) return;
  showLoader();
  pg_setVendorGroup(vendorId, null)
    .then(() => { hideLoader(); toast('تمت الإزالة', 'success'); render(); })
    .catch(e => { hideLoader(); toast('خطأ: '+(e.message||e),'error'); });
};

// ══════════════════════════════════════════════════════════════
//  اختيار المزودين بخطوتين — يُستخدم في نماذج الخدمات
// ══════════════════════════════════════════════════════════════
window.__pg_selectedGroup = window.__pg_selectedGroup || null;

window.pg_renderVendorPickerGrouped = function (assignedIds = [], isMulti = true) {
  const groups  = AppData.providerGroups || [];
  const vendors = (AppData.users || []).filter(u => ['vendor','provider'].includes(u.role));
  const selGroup = window.__pg_selectedGroup;
  const type = isMulti ? 'checkbox' : 'radio';

  let displayedVendors;
  let groupName = '';
  if (selGroup === '__all__') {
    displayedVendors = vendors;
    groupName = 'جميع المزودين';
  } else if (selGroup) {
    displayedVendors = vendors.filter(v => v.providerGroupId === selGroup);
    const g = groups.find(g => g.id === selGroup);
    groupName = g ? `${g.icon||''} ${g.name}` : '';
  } else {
    displayedVendors = [];
  }

  return `
  <div class="vendor-picker-container" style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:16px;padding:16px;margin-top:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <label class="form-label" style="margin:0;font-weight:700;color:var(--primary)">💎 المزودون المعتمدون (إلزامي)</label>
      ${selGroup ? `
      <div id="multi-vendor-actions" style="display:${isMulti?'flex':'none'};gap:8px">
        <button type="button" class="btn btn-sm" style="font-size:11px;padding:4px 8px;background:rgba(139,92,246,0.1);color:var(--primary)" onclick="ph43_selectAllVendors(true)">تحديد الكل</button>
        <button type="button" class="btn btn-sm" style="font-size:11px;padding:4px 8px;background:rgba(244,63,94,0.1);color:var(--rose)" onclick="ph43_selectAllVendors(false)">إلغاء الكل</button>
      </div>` : ''}
    </div>

    <!-- الخطوة 1: اختيار الفرع -->
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600">📂 الخطوة 1 — اختر فرع المزود:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${groups.filter(g => g.active !== false).map(g => {
          const gVendors = vendors.filter(v => v.providerGroupId === g.id);
          const isSelected = selGroup === g.id;
          return `
          <button type="button"
            onclick="pg_selectGroupInPicker('${g.id}')"
            style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid ${isSelected?'var(--primary)':'var(--border)'};background:${isSelected?'rgba(139,92,246,0.12)':'rgba(255,255,255,0.02)'};color:${isSelected?'var(--primary)':'var(--text-main)'};cursor:pointer;font-size:13px;font-weight:${isSelected?'700':'500'};font-family:'Cairo',sans-serif;transition:all 0.15s">
            <span>${escHtml(g.icon||'🏢')}</span>
            <span>${escHtml(g.name)}</span>
            <span style="font-size:11px;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:8px">${gVendors.length}</span>
          </button>`;
        }).join('')}
        <button type="button"
          onclick="pg_selectGroupInPicker('__all__')"
          style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid ${selGroup==='__all__'?'var(--primary)':'var(--border)'};background:${selGroup==='__all__'?'rgba(139,92,246,0.12)':'rgba(255,255,255,0.02)'};color:${selGroup==='__all__'?'var(--primary)':'var(--text-muted)'};cursor:pointer;font-size:12px;font-family:'Cairo',sans-serif;transition:all 0.15s">
          📋 الكل (${vendors.length})
        </button>
      </div>
    </div>

    <!-- الخطوة 2: اختيار المزود -->
    ${selGroup ? `
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600">👤 الخطوة 2 — اختر من ${escHtml(groupName)}:</div>
      <input type="text" class="form-control form-control-sm" placeholder="🔍 ابحث عن مزود..." oninput="ph43_filterVendors(this.value)" style="margin-bottom:10px;height:36px;border-radius:10px;background:rgba(0,0,0,0.2)">
      <div style="max-height:200px;overflow-y:auto;padding-right:4px" id="svc-vendors-pool" class="custom-scrollbar">
        ${displayedVendors.length === 0 ? `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">
          لا يوجد مزودون في هذا الفرع بعد
          <br><small>يمكنك إضافتهم من قسم "فروع المزودين" في الإعدادات</small>
        </div>` :
        displayedVendors.map(v => `
        <label class="vendor-item" data-name="${escHtml((v.name||'').toLowerCase())}" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;cursor:pointer;padding:10px;border-radius:12px;background:rgba(255,255,255,0.02);transition:all 0.2s;border:1px solid transparent">
          <input type="${type}" name="svc-vendor" class="svc-vendor-cb" value="${v.id}" ${assignedIds.includes(v.id)?'checked':''} style="width:20px;height:20px;accent-color:var(--primary)">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${escHtml(v.name||'—')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escHtml(v.email||v.phone||'')}</div>
          </div>
          ${assignedIds.includes(v.id) ? '<span style="font-size:16px">✅</span>' : ''}
        </label>`).join('')}
      </div>
      <div id="picker-hint" style="font-size:11px;color:var(--text-muted);margin-top:10px;display:flex;align-items:center;gap:6px">
        <span style="font-size:14px">ℹ️</span>
        ${isMulti ? 'سيوجّه النظام الطلب تلقائياً للأقرب من المحددين.' : 'حدّد مزوداً واحداً لهذه الخدمة.'}
      </div>
    </div>` : `
    <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border-top:1px solid var(--border)">
      <span style="font-size:28px;display:block;margin-bottom:8px">☝️</span>
      اختر فرعاً أولاً لعرض المزودين
    </div>`}
  </div>
  <style>
    .vendor-item:hover { background:rgba(139,92,246,0.08) !important; border-color:var(--primary) !important; }
    .vendor-item:has(input:checked) { background:rgba(139,92,246,0.1) !important; border-color:var(--primary) !important; }
  </style>`;
};

window.pg_selectGroupInPicker = function (groupId) {
  window.__pg_selectedGroup = groupId;
  const container = document.querySelector('.vendor-picker-container');
  if (container) {
    const assignedIds = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb => cb.value);
    const isMulti = document.querySelector('.svc-vendor-cb')?.type === 'checkbox';
    container.outerHTML = pg_renderVendorPickerGrouped(assignedIds, isMulti !== undefined ? isMulti : true);
    const newContainer = document.querySelector('.vendor-picker-container');
    if (newContainer) newContainer.outerHTML = pg_renderVendorPickerGrouped(assignedIds, isMulti !== undefined ? isMulti : true);
  }
};

// ── إعادة رسم الـ picker بعد اختيار الفرع (بدون modal إعادة فتح)
window.pg_selectGroupInPicker = function (groupId) {
  window.__pg_selectedGroup = groupId;
  const container = document.querySelector('.vendor-picker-container');
  if (!container) return;
  const assignedIds = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb => cb.value);
  const isMultiEl = document.querySelector('.svc-vendor-cb');
  const isMulti = isMultiEl ? isMultiEl.type === 'checkbox' : true;
  container.outerHTML = pg_renderVendorPickerGrouped(assignedIds, isMulti);
};

// ── تحميل تلقائي عند بدء التطبيق ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  pg_loadGroups().catch(() => {});
});
if (typeof AppData !== 'undefined') {
  pg_loadGroups().catch(() => {});
}

console.log('[ProviderGroups] نظام فروع مزودي الخدمات جاهز ✅');
