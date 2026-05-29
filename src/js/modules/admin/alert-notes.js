// ═══════════════════════════════════════════════════
//  محجوز — حقول التنبيهات الإدارية المرقمة
//  Admin Alert Notes — Numbered Warning Fields
// ═══════════════════════════════════════════════════
'use strict';

// ── رندر قسم التنبيهات (يُستخدم في جميع نماذج الإضافة/التعديل) ──
window.renderAdminAlerts = function(notes = []) {
  const rows = notes.length > 0
    ? notes.map((n, i) => _alertRow(i, n)).join('')
    : '';
  return `
    <div id="admin-alerts-section" style="
      background: linear-gradient(135deg, rgba(234,179,8,0.06), rgba(245,158,11,0.04));
      border: 1.5px solid rgba(234,179,8,0.45);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 4px;
    ">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px;">⚠️</span>
          <div>
            <div style="font-weight:800; font-size:14px; color:#f59e0b;">ملاحظات تنبيهية للإدارة</div>
            <div style="font-size:11px; color:#d97706; margin-top:1px;">تظهر هذه الملاحظات للإدارة فقط بترقيم تلقائي</div>
          </div>
        </div>
        <button type="button" onclick="addAdminAlert()" style="
          display:flex; align-items:center; gap:5px;
          background: rgba(234,179,8,0.15);
          border: 1px solid rgba(234,179,8,0.45);
          border-radius: 8px;
          padding: 7px 13px;
          color: #f59e0b;
          font-family: var(--font-ar, 'Cairo', sans-serif);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        " onmouseover="this.style.background='rgba(234,179,8,0.25)'" onmouseout="this.style.background='rgba(234,179,8,0.15)'">
          ➕ إضافة تنبيه
        </button>
      </div>

      <div id="admin-alerts-list" style="display:flex; flex-direction:column; gap:8px;">
        ${rows || `<div id="admin-alerts-empty" style="text-align:center; padding:14px; color:#d97706; font-size:13px; border:1px dashed rgba(234,179,8,0.3); border-radius:8px;">
          لا توجد ملاحظات تنبيهية — اضغط "إضافة تنبيه" لإضافة أول ملاحظة
        </div>`}
      </div>
    </div>
  `;
};

// ── صف تنبيه واحد ──
function _alertRow(index, value = '') {
  return `
    <div class="admin-alert-row" data-idx="${index}" style="
      display:flex; align-items:center; gap:8px;
      background: rgba(234,179,8,0.08);
      border: 1px solid rgba(234,179,8,0.3);
      border-radius: 10px;
      padding: 8px 10px;
    ">
      <span style="
        background: #f59e0b;
        color: #fff;
        font-weight: 800;
        font-size: 12px;
        min-width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-family: var(--font-ar, 'Cairo', sans-serif);
      ">${index + 1}</span>
      <input
        type="text"
        class="admin-alert-input"
        value="${escAttr ? escAttr(value) : value.replace(/"/g, '&quot;')}"
        placeholder="اكتب الملاحظة التنبيهية هنا..."
        style="
          flex: 1;
          background: rgba(234,179,8,0.06);
          border: 1px solid rgba(234,179,8,0.25);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fef3c7;
          font-family: var(--font-ar, 'Cairo', sans-serif);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        "
        onfocus="this.style.borderColor='rgba(234,179,8,0.7)'"
        onblur="this.style.borderColor='rgba(234,179,8,0.25)'"
      >
      <button type="button" onclick="removeAdminAlert(this)" title="حذف هذا التنبيه" style="
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.3);
        border-radius: 7px;
        padding: 6px 9px;
        color: #f87171;
        cursor: pointer;
        font-size: 14px;
        flex-shrink: 0;
        transition: all 0.2s;
        line-height: 1;
      " onmouseover="this.style.background='rgba(239,68,68,0.22)'" onmouseout="this.style.background='rgba(239,68,68,0.12)'">✕</button>
    </div>
  `;
}

// ── إضافة تنبيه جديد ──
window.addAdminAlert = function() {
  const list = document.getElementById('admin-alerts-list');
  if (!list) return;

  // إزالة رسالة "لا توجد ملاحظات" إن وجدت
  const empty = document.getElementById('admin-alerts-empty');
  if (empty) empty.remove();

  const rows = list.querySelectorAll('.admin-alert-row');
  const newIndex = rows.length;

  const div = document.createElement('div');
  div.innerHTML = _alertRow(newIndex);
  list.appendChild(div.firstElementChild);

  // تركيز على الحقل الجديد
  const newInput = list.lastElementChild?.querySelector('input');
  if (newInput) newInput.focus();
};

// ── حذف تنبيه ──
window.removeAdminAlert = function(btn) {
  const row = btn.closest('.admin-alert-row');
  if (!row) return;
  row.remove();
  _renumberAlerts();

  // إذا لم يتبقَ أي صفوف، أعد رسالة الفراغ
  const list = document.getElementById('admin-alerts-list');
  if (list && list.querySelectorAll('.admin-alert-row').length === 0) {
    list.innerHTML = `<div id="admin-alerts-empty" style="text-align:center; padding:14px; color:#d97706; font-size:13px; border:1px dashed rgba(234,179,8,0.3); border-radius:8px;">
      لا توجد ملاحظات تنبيهية — اضغط "إضافة تنبيه" لإضافة أول ملاحظة
    </div>`;
  }
};

// ── إعادة ترقيم الصفوف بعد الحذف ──
function _renumberAlerts() {
  const rows = document.querySelectorAll('#admin-alerts-list .admin-alert-row');
  rows.forEach((row, i) => {
    row.dataset.idx = i;
    const badge = row.querySelector('span');
    if (badge) badge.textContent = i + 1;
  });
}

// ── قراءة جميع التنبيهات من النموذج ──
window.getAdminAlerts = function() {
  const inputs = document.querySelectorAll('#admin-alerts-list .admin-alert-input');
  return Array.from(inputs)
    .map(i => i.value.trim())
    .filter(Boolean);
};
