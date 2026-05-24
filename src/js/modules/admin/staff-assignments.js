// ═══════════════════════════════════════════════════════════════
//  محجوز — نظام تعيين الأقسام والتصنيفات والمناطق للموظفين
//  يتيح للمدير تقسيم الضغط: كل موظف يرى فقط طلبات نطاقه
// ═══════════════════════════════════════════════════════════════
'use strict';

// ─── ثوابت الأقسام ────────────────────────────────────────────
const PH_ASSIGN_SECTIONS = [
  { k: 'bookings',    l: '📅 الحجوزات',          color: '#3b82f6' },
  { k: 'professions', l: '🔧 الخدمات المهنية',    color: '#10b981' },
  { k: 'stores',      l: '🏪 المتاجر',             color: '#f59e0b' },
  { k: 'offers',      l: '🏷️ العروض والخصومات',   color: '#ef4444' },
];

// ─── فتح مودال تعيين الأقسام ─────────────────────────────────
window.ph_openAssignModal = function (userId) {
  const u = (AppData.users || []).find(x => x.id === userId);
  if (!u) return;

  const assignedSections  = u.assignedSections  || [];
  const assignedCatIds    = u.assignedCatIds    || [];
  const assignedRegionIds = u.assignedRegionIds || [];

  const allCats    = AppData.cats    || [];
  const allRegions = (AppData.regions || []).filter(r => r.active !== false);

  const sectionCheckboxes = PH_ASSIGN_SECTIONS.map(s => `
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 14px;border:1px solid ${assignedSections.includes(s.k) ? s.color : 'var(--glass-border)'};border-radius:10px;background:${assignedSections.includes(s.k) ? s.color + '18' : 'transparent'};transition:all 0.2s;margin-bottom:6px" onclick="ph_toggleAssignSection(this,'${s.k}','${s.color}')">
      <input type="checkbox" class="ph-assign-sec-cb" data-sec="${s.k}" ${assignedSections.includes(s.k) ? 'checked' : ''} style="width:18px;height:18px;accent-color:${s.color}">
      <span style="font-weight:700;font-size:14px">${s.l}</span>
    </label>`).join('');

  const catOptions = allCats.map(c => {
    const sec = PH_ASSIGN_SECTIONS.find(s => s.k === c.section);
    return `<option value="${c.id}" data-sec="${c.section}" ${assignedCatIds.includes(c.id) ? 'selected' : ''}>
      ${sec ? sec.l.split(' ')[0] : '📂'} ${escHtml(c.name)}
    </option>`;
  }).join('');

  const regionOptions = allRegions.map(r =>
    `<option value="${r.id}" ${assignedRegionIds.includes(r.id) ? 'selected' : ''}>${escHtml(r.name)}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 تعيين نطاق عمل: ${escHtml(u.name || u.email)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:4px;max-height:76vh;overflow-y:auto;display:flex;flex-direction:column;gap:18px">

      <!-- الأقسام -->
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:16px">
        <div style="font-weight:800;font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          🗂️ الأقسام المسؤول عنها
          <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(فارغ = يرى كل الأقسام)</span>
        </div>
        ${sectionCheckboxes}
      </div>

      <!-- التصنيفات -->
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:16px">
        <div style="font-weight:800;font-size:15px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          📂 التصنيفات المختص بها
          <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(فارغ = جميع التصنيفات في الأقسام المحددة)</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">اضغط Ctrl للاختيار المتعدد</div>
        ${allCats.length ? `
          <div style="position:relative">
            <input type="text" class="form-control" placeholder="🔍 بحث في التصنيفات..." oninput="ph_filterAssignCats(this.value)" style="margin-bottom:8px">
            <select id="ph-assign-cats" multiple size="8" style="width:100%;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-input);color:var(--text-main);padding:4px;font-size:13px">
              ${catOptions}
            </select>
          </div>
          <div style="margin-top:6px;display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="Array.from(document.getElementById('ph-assign-cats').options).forEach(o=>o.selected=true)">اختيار الكل</button>
            <button class="btn btn-secondary btn-sm" onclick="Array.from(document.getElementById('ph-assign-cats').options).forEach(o=>o.selected=false)">مسح الكل</button>
          </div>` : '<div style="color:var(--text-muted);font-size:13px">لا توجد تصنيفات بعد</div>'}
      </div>

      <!-- المناطق -->
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:16px">
        <div style="font-weight:800;font-size:15px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          📍 المناطق الجغرافية المختص بها
          <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(فارغ = جميع المناطق)</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">اضغط Ctrl للاختيار المتعدد</div>
        ${allRegions.length ? `
          <select id="ph-assign-regions" multiple size="6" style="width:100%;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-input);color:var(--text-main);padding:4px;font-size:13px">
            ${regionOptions}
          </select>
          <div style="margin-top:6px;display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="Array.from(document.getElementById('ph-assign-regions').options).forEach(o=>o.selected=true)">اختيار الكل</button>
            <button class="btn btn-secondary btn-sm" onclick="Array.from(document.getElementById('ph-assign-regions').options).forEach(o=>o.selected=false)">مسح الكل</button>
          </div>` : '<div style="color:var(--text-muted);font-size:13px">لا توجد مناطق محددة بعد — يمكن إضافتها من إعدادات التوصيل</div>'}
      </div>

      <!-- زر الحفظ -->
      <button class="btn btn-primary btn-block" onclick="ph_saveAssignments('${userId}')">
        💾 حفظ التعيينات
      </button>
    </div>`);
};

// ─── تبديل قسم مع تحديث مظهر العنصر ────────────────────────
window.ph_toggleAssignSection = function (labelEl, secKey, color) {
  const cb = labelEl.querySelector('input[type=checkbox]');
  if (!cb) return;
  const isChecked = cb.checked;
  labelEl.style.border        = `1px solid ${isChecked ? color : 'var(--glass-border)'}`;
  labelEl.style.background    = isChecked ? color + '18' : 'transparent';
};

// ─── بحث في قائمة التصنيفات ──────────────────────────────────
window.ph_filterAssignCats = function (q) {
  const lower = q.toLowerCase().trim();
  const opts = document.querySelectorAll('#ph-assign-cats option');
  opts.forEach(o => {
    o.style.display = !lower || o.textContent.toLowerCase().includes(lower) ? '' : 'none';
  });
};

// ─── حفظ التعيينات في Firestore ──────────────────────────────
window.ph_saveAssignments = async function (userId) {
  const sectionCbs    = Array.from(document.querySelectorAll('.ph-assign-sec-cb:checked'));
  const assignedSections  = sectionCbs.map(cb => cb.dataset.sec);

  const catSel = document.getElementById('ph-assign-cats');
  const assignedCatIds = catSel
    ? Array.from(catSel.selectedOptions).map(o => o.value)
    : [];

  const regSel = document.getElementById('ph-assign-regions');
  const assignedRegionIds = regSel
    ? Array.from(regSel.selectedOptions).map(o => o.value)
    : [];

  showLoader();
  try {
    await fsUpdate('users', userId, { assignedSections, assignedCatIds, assignedRegionIds });
    const u = (AppData.users || []).find(x => x.id === userId);
    if (u) { u.assignedSections = assignedSections; u.assignedCatIds = assignedCatIds; u.assignedRegionIds = assignedRegionIds; }
    closeModal();
    toast('✅ تم حفظ تعيينات الموظف', 'success');
    await render();
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

// ─── فلترة الطلبات حسب تعيينات الموظف ────────────────────────
window.ph_filterOrdersByAssignment = function (orders, staffUser) {
  if (!staffUser) return orders;
  const { assignedSections = [], assignedCatIds = [], assignedRegionIds = [] } = staffUser;
  if (!assignedSections.length && !assignedCatIds.length && !assignedRegionIds.length) return orders;

  return orders.filter(o => {
    let pass = true;

    // فلتر القسم — عبر تصنيف الطلب
    if (assignedSections.length) {
      const cat = (AppData.cats || []).find(c => c.id === o.catId);
      const orderSection = cat?.section || o.section || '';
      pass = pass && assignedSections.some(s => orderSection === s || orderSection.startsWith(s));
    }

    // فلتر التصنيف المحدد
    if (pass && assignedCatIds.length) {
      pass = pass && assignedCatIds.includes(o.catId);
    }

    // فلتر المنطقة
    if (pass && assignedRegionIds.length) {
      const orderRegion = o.regionId || o.region || '';
      pass = pass && (!orderRegion || assignedRegionIds.includes(orderRegion));
    }

    return pass;
  });
};

// ─── عرض شارات نطاق عمل الموظف (للوحة الموظف) ───────────────
window.ph_renderStaffScopeBadges = function (staffUser) {
  if (!staffUser) return '';
  const { assignedSections = [], assignedCatIds = [], assignedRegionIds = [] } = staffUser;
  if (!assignedSections.length && !assignedCatIds.length && !assignedRegionIds.length) {
    return `<div style="font-size:12px;color:var(--text-muted);padding:6px 0">نطاق عمل: <b>جميع الأقسام</b></div>`;
  }

  const secLabels  = assignedSections.map(k => PH_ASSIGN_SECTIONS.find(s => s.k === k)?.l || k);
  const catCount   = assignedCatIds.length;
  const regCount   = assignedRegionIds.length;

  let html = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">';
  secLabels.forEach(l => html += `<span style="background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:2px 9px;font-size:11px;color:var(--primary);font-weight:700">${l}</span>`);
  if (catCount)  html += `<span style="background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:2px 9px;font-size:11px;color:#10b981;font-weight:700">📂 ${catCount} تصنيف</span>`;
  if (regCount)  html += `<span style="background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.3);border-radius:20px;padding:2px 9px;font-size:11px;color:#3b82f6;font-weight:700">📍 ${regCount} منطقة</span>`;
  html += '</div>';
  return html;
};

// ─── لوحة الطلبات المعينة للموظف ─────────────────────────────
window.renderStaffOrders = function () {
  const u = State.currentUser;
  if (!u) return '';

  const statusLabel = {
    pending: 'معلق', pending_admin: 'بانتظار المراجعة', pending_provider: 'بانتظار المزود',
    approved: 'مقبول', in_progress: 'قيد التنفيذ', completed: 'مكتمل',
    delivered: 'تم التسليم', cancelled: 'ملغي', rejected: 'مرفوض',
  };
  const statusColor = {
    pending: '#f59e0b', pending_admin: '#f59e0b', pending_provider: '#3b82f6',
    approved: '#10b981', in_progress: '#8b5cf6', completed: '#10b981',
    delivered: '#10b981', cancelled: '#ef4444', rejected: '#ef4444',
  };

  const staffSubTab = State.staffOrdersSubTab || 'pending';
  const allOrders   = AppData.orders || [];
  const myOrders    = ph_filterOrdersByAssignment(allOrders, u);

  const pendingCount   = myOrders.filter(o => ['pending','pending_admin'].includes(o.status)).length;
  const inProgressCount = myOrders.filter(o => ['approved','in_progress','pending_provider'].includes(o.status)).length;
  const doneCount      = myOrders.filter(o => ['completed','delivered'].includes(o.status)).length;
  const cancelCount    = myOrders.filter(o => ['cancelled','rejected'].includes(o.status)).length;

  const displayed = myOrders.filter(o => {
    if (staffSubTab === 'pending')      return ['pending','pending_admin'].includes(o.status);
    if (staffSubTab === 'in_progress')  return ['approved','in_progress','pending_provider'].includes(o.status);
    if (staffSubTab === 'done')         return ['completed','delivered'].includes(o.status);
    if (staffSubTab === 'cancelled')    return ['cancelled','rejected'].includes(o.status);
    return true;
  });

  const subTabs = [
    { k:'pending',     l:'⏳ بانتظار المراجعة', n: pendingCount,    c:'#f59e0b' },
    { k:'in_progress', l:'🔄 قيد التنفيذ',      n: inProgressCount, c:'#8b5cf6' },
    { k:'done',        l:'✅ مكتملة',            n: doneCount,       c:'#10b981' },
    { k:'cancelled',   l:'❌ ملغية/مرفوضة',    n: cancelCount,     c:'#ef4444' },
  ];

  const scopeInfo = ph_renderStaffScopeBadges(u);

  const renderRow = o => {
    const svc = (AppData.services || []).find(s => s.id === o.svcId);
    const cat = (AppData.cats || []).find(c => c.id === o.catId);
    const sc  = statusColor[o.status] || '#8b5cf6';
    const sl  = statusLabel[o.status] || o.status;
    const dt  = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)).toLocaleDateString('ar-SA') : '—';
    return `
    <tr>
      <td>
        <div style="font-weight:700;font-size:13px">${escHtml(o.customerName || o.userId || '—')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${dt}</div>
      </td>
      <td>
        <div style="font-weight:600;font-size:13px">${escHtml(svc?.name || o.svcName || '—')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${escHtml(cat?.name || '—')}</div>
      </td>
      <td><span style="background:${sc}22;color:${sc};border:1px solid ${sc}44;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">${sl}</span></td>
      <td style="font-weight:700;color:var(--primary)">${(o.totalPrice || o.price || 0).toLocaleString('ar-SA')} ر.س</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['pending','pending_admin'].includes(o.status) ? `
            <button class="btn btn-sm" style="background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:8px" onclick="ph_staffApproveOrder('${o.id}')">✅ موافقة</button>
            <button class="btn btn-sm" style="background:rgba(239,68,68,0.10);color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:8px" onclick="ph_staffRejectOrder('${o.id}')">❌ رفض</button>
          ` : ''}
          <button class="btn btn-sm btn-secondary" onclick="typeof viewOrderDetails==='function'?viewOrderDetails('${o.id}'):(typeof ph_openOrderModal==='function'?ph_openOrderModal('${o.id}'):null)">📄 تفاصيل</button>
        </div>
      </td>
    </tr>`;
  };

  return `
  <div class="dashboard-header">
    <h2>📋 الطلبات المعينة لي</h2>
    <p>الطلبات المرتبطة بنطاق عملك</p>
  </div>

  ${scopeInfo}

  <!-- إحصاءات سريعة -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin:16px 0">
    ${[
      { n: pendingCount,    l: 'بانتظار المراجعة', c: '#f59e0b' },
      { n: inProgressCount, l: 'قيد التنفيذ',      c: '#8b5cf6' },
      { n: doneCount,       l: 'مكتملة',            c: '#10b981' },
      { n: cancelCount,     l: 'ملغية / مرفوضة',  c: '#ef4444' },
    ].map(s => `
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:${s.c}">${s.n}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${s.l}</div>
      </div>`).join('')}
  </div>

  <!-- تبويبات الفلتر -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
    ${subTabs.map(t => `
      <button onclick="State.staffOrdersSubTab='${t.k}';render()" style="border:2px solid ${staffSubTab===t.k ? t.c : 'var(--glass-border)'};background:${staffSubTab===t.k ? t.c+'18' : 'transparent'};color:${staffSubTab===t.k ? t.c : 'var(--text-secondary)'};border-radius:99px;padding:6px 16px;font-weight:700;font-size:13px;cursor:pointer">
        ${t.l} ${t.n ? `<span style="background:${t.c};color:#fff;border-radius:99px;padding:0 6px;font-size:11px;margin-right:4px">${t.n}</span>` : ''}
      </button>`).join('')}
  </div>

  ${displayed.length ? `
  <div class="table-wrap">
    <table class="admin-table">
      <thead><tr><th>العميل</th><th>الخدمة / التصنيف</th><th>الحالة</th><th>المبلغ</th><th>إجراءات</th></tr></thead>
      <tbody>${displayed.map(renderRow).join('')}</tbody>
    </table>
  </div>` : `
  <div class="empty-state" style="padding:60px 0">
    <div class="empty-icon">📋</div>
    <div class="empty-title">لا توجد طلبات في هذا القسم</div>
    <div class="empty-desc">ستظهر هنا الطلبات المرتبطة بنطاق عملك</div>
  </div>`}`;
};

// ─── موافقة على طلب (من لوحة الموظف) ────────────────────────
window.ph_staffApproveOrder = async function (orderId) {
  if (!confirm('الموافقة على هذا الطلب؟')) return;
  showLoader();
  try {
    await fsUpdate('orders', orderId, { status: 'approved', approvedAt: new Date(), approvedBy: State.currentUser?.uid });
    const o = (AppData.orders || []).find(x => x.id === orderId);
    if (o) o.status = 'approved';
    toast('✅ تمت الموافقة على الطلب', 'success');
    render();
  } catch (e) { toast('خطأ: ' + e.message, 'error'); } finally { hideLoader(); }
};

// ─── رفض طلب (من لوحة الموظف) ────────────────────────────────
window.ph_staffRejectOrder = async function (orderId) {
  const reason = prompt('سبب الرفض (اختياري):') ?? '';
  if (reason === null) return;
  showLoader();
  try {
    await fsUpdate('orders', orderId, { status: 'rejected', rejectedAt: new Date(), rejectedBy: State.currentUser?.uid, rejectReason: reason });
    const o = (AppData.orders || []).find(x => x.id === orderId);
    if (o) o.status = 'rejected';
    toast('تم رفض الطلب', 'success');
    render();
  } catch (e) { toast('خطأ: ' + e.message, 'error'); } finally { hideLoader(); }
};

console.log('[Staff Assignments] نظام تعيين الأقسام والمناطق جاهز ✅');
