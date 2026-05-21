/* ============================================================
   phase30.js — نظام كود الخصم (Cupon System)
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('cupons', 'كوبونات الخصم', 'Discount Cupons');
  add('cupon', 'كوبون الخصم', 'Discount Cupon');
  add('apply_cupon', 'تطبيق الكوبون', 'Apply Cupon');
  add('cupon_code', 'كود الكوبون', 'Cupon Code');
  add('enter_cupon_code', 'أدخل كود الكوبون', 'Enter Cupon Code');
  add('discount', 'الخصم', 'Discount');
  add('valid_until', 'صالح حتى', 'Valid Until');
  add('uses_left', 'المتبقي من الاستخدام', 'Uses Left');
  add('cupon_applied', 'تم تطبيق الكوبون بنجاح', 'Cupon Applied');
  add('cupon_invalid', 'كوبون غير صالح أو منتهي', 'Invalid Cupon');
  add('cupon_expired', 'كوبون منتهي الصلاحية', 'Cupon Expired');
  add('cupon_limit_reached', 'تم reached الحد الأقصى للاستخدام', 'Usage Limit Reached');
  add('new_cupon', 'كوبون جديد', 'New Cupon');
  add('create_cupon', 'إنشاء كبون', 'Create Cupon');
  add('cupon_type', 'نوع الكوبون', 'Cupon Type');
  add('percentage_discount', 'خصم نسبة', 'Percentage Discount');
  add('fixed_discount', 'خصم مبلغ ثابت', 'Fixed Discount');
  add('min_order_value', 'الحد الأدنى للطلب', 'Min Order Value');
  add('max_uses', 'أقصى استخدام', 'Max Uses');
  add('single_use', 'استخدام واحد', 'Single Use');
  add('unlimited_uses', 'استخدام غير محدود', 'Unlimited Uses');
  add('welcome_cupon', 'كوبون ترحيبي', 'Welcome Cupon');
  add('special_offer', 'عرض خاص', 'Special Offer');
  add('remove_cupon', 'إزالة الكوبون', 'Remove Cupon');
  add('cupon_saved', 'تم حفظ الكوبون', 'Cupon Saved');
  add('cupon_deleted', 'تم حذف الكوبون', 'Cupon Deleted');

})();

// ============================================================
//Cupons Collection Helper
// ============================================================

if (typeof AppData !== 'undefined') AppData.cupons = AppData.cupons || [];

// ============================================================
// Check and Apply Cupon
// ============================================================

window.ph30_validateCupon = function(code, orderValue = 0) {
  const cupon = AppData.cupons.find(c => c.code && c.code.toUpperCase() === code.toUpperCase());
  
  if (!cupon) return { valid: false, message: I18N.ar.cupon_invalid };
  
  // Check expiry
  if (cupon.expiresAt) {
    const expiry = new Date(cupon.expiresAt);
    if (expiry < new Date()) return { valid: false, message: I18N.ar.cupon_expired };
  }
  
  // Check usage limit
  if (cupon.maxUses && cupon.uses && cupon.uses >= cupon.maxUses) {
    return { valid: false, message: I18N.ar.cupon_limit_reached };
  }
  
  // Check minimum order value
  if (cupon.minOrderValue && orderValue < cupon.minOrderValue) {
    return { valid: false, message: `الحد الأدنى للطلب ${cupon.minOrderValue} ريال` };
  }
  
  // Calculate discount
  let discount = 0;
  if (cupon.type === 'percentage') {
    discount = Math.round(orderValue * (cupon.discountValue / 100));
  } else {
    discount = Math.min(cupon.discountValue, orderValue);
  }
  
  return {
    valid: true,
    cupon: cupon,
    discount: discount,
    message: `${discount} ريال ${I18N.ar.discount}`
  };
};

window.ph30_applyCupon = async function(code, orderValue = 0) {
  const result = window.ph30_validateCupon(code, orderValue);
  
  if (!result.valid) {
    toast(result.message, 'error');
    return null;
  }
  
  // Save to state
  window.ph30_activeCupon = result.cupon;
  toast(I18N.ar.cupon_applied + ` (${result.discount} ريال)`, 'success');
  
  return result;
};

window.ph30_removeCupon = function() {
  window.ph30_activeCupon = null;
  toast(I18N.ar.remove_cupon, 'info');
};

window.ph30_getDiscountAmount = function() {
  if (!window.ph30_activeCupon) return 0;
  return window.ph30_activeCupon._calculatedDiscount || 0;
};

// ============================================================
// Admin: Create Cupon Modal
// ============================================================

window.ph30_showCreateCuponModal = function() {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🎟️ ${I18N.ar.new_cupon}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="ph30-form">
      <div class="form-group">
        <label class="form-label">${I18N.ar.cupon_code} *</label>
        <input class="form-control" id="ph30-code" placeholder="مثال: SUMMER50" style="text-transform:uppercase">
        <small style="color:var(--text-muted)">ستحتاج لكتابة الأحرف الكبيرة</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">${I18N.ar.cupon_type}</label>
        <select class="form-control" id="ph30-type" onchange="ph30_toggleType()">
          <option value="percentage">${I18N.ar.percentage_discount}</option>
          <option value="fixed">${I18N.ar.fixed_discount}</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">${I18N.ar.discount} (%)</label>
        <input class="form-control" id="ph30-discount" type="number" placeholder="50" min="1" max="100">
      </div>
      
      <div class="form-group">
        <label class="form-label">${I18N.ar.min_order_value} (ريال)</label>
        <input class="form-control" id="ph30-min" type="number" placeholder="100" min="0">
      </div>
      
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">${I18N.ar.valid_until}</label>
          <input class="form-control" id="ph30-expiry" type="date">
        </div>
        <div class="form-group">
          <label class="form-label">${I18N.ar.max_uses}</label>
          <input class="form-control" id="ph30-max" type="number" placeholder="100">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">${I18N.ar.description}</label>
        <textarea class="form-control" id="ph30-desc" rows="2" placeholder="وصف الكوبون..."></textarea>
      </div>
      
      <button class="btn btn-primary btn-block" onclick="ph30_saveCupon()">💾 ${I18N.ar.create_cupon}</button>
    </div>
  `);
};

window.ph30_toggleType = function() {
  const type = document.getElementById('ph30-type').value;
  const label = document.querySelector('#ph30-discount').previousElementSibling;
  if (type === 'percentage') {
    label.textContent = I18N.ar.discount + ' (%)';
  } else {
    label.textContent = I18N.ar.discount + ' (ريال)';
  }
};

window.ph30_saveCupon = async function() {
  const code = document.getElementById('ph30-code').value.trim().toUpperCase();
  const type = document.getElementById('ph30-type').value;
  const discountValue = parseInt(document.getElementById('ph30-discount').value);
  const minOrderValue = parseInt(document.getElementById('ph30-min').value) || 0;
  const expiresAt = document.getElementById('ph30-expiry').value;
  const maxUses = parseInt(document.getElementById('ph30-max').value) || null;
  const desc = document.getElementById('ph30-desc').value.trim();
  
  if (!code || !discountValue) {
    toast('يرجى إدخال الكود ونسبة الخصم', 'error');
    return;
  }
  
  // Check if code exists
  if (AppData.cupons.find(c => c.code === code)) {
    toast('هذا الكود مستخدم من قبل', 'error');
    return;
  }
  
  const cuponData = {
    code,
    type,
    discountValue,
    minOrderValue,
    expiresAt: expiresAt || null,
    maxUses: maxUses || null,
    uses: 0,
    description: desc,
    createdAt: new Date(),
    createdBy: State.currentUser?.uid
  };
  
  await fsAdd('cupons', cuponData);
  AppData.cupons.push(cuponData);
  
  closeModal();
  toast(I18N.ar.cupon_saved, 'success');
  
  if (typeof render === 'function') render();
};

// ============================================================
// Admin: Manage Cupons
// ============================================================

window.ph30_renderCuponsAdmin = function() {
  const cupons = AppData.cupons || [];
  
  if (cupons.length === 0) {
    return `
      <div class="ph30-empty">
        <div style="font-size:48px;margin-bottom:16px">🎟️</div>
        <div>لا توجد كوبونات</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="ph30_showCreateCuponModal()">➕ إضافة كبون</button>
      </div>
    `;
  }
  
  return `
    <div class="ph30-list">
      ${cupons.map(c => {
        const isActive = !c.expiresAt || new Date(c.expiresAt) > new Date();
        const usesLeft = c.maxUses ? (c.maxUses - (c.uses || 0)) : '∞';
        
        return `
          <div class="ph30-card ${isActive ? 'active' : 'expired'}">
            <div class="ph30-card-header">
              <span class="ph30-code">${c.code}</span>
              <span class="ph30-badge ${isActive ? 'active' : 'expired'}">${isActive ? '✅ نشط' : '❌ منتهي'}</span>
            </div>
            <div class="ph30-card-body">
              <div class="ph30-discount">${c.type === 'percentage' ? c.discountValue + '%' : c.discountValue + 'ريال'}</div>
              <div class="ph30-info">
                ${c.minOrderValue ? `<div>الحد الأدنى: ${c.minOrderValue} ريال</div>` : ''}
                <div>الاستخدام: ${c.uses || 0} ${c.maxUses ? '/ ' + c.maxUses : ''}</div>
                ${c.expiresAt ? `<div>ينتهي: ${new Date(c.expiresAt).toLocaleDateString('ar-SA')}</div>` : ''}
              </div>
            </div>
            <div class="ph30-card-actions">
              <button class="btn btn-sm btn-secondary" onclick="ph30_deleteCupon('${c.id}')">🗑️ حذف</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:16px" onclick="ph30_showCreateCuponModal()">➕ إضافة كبون جديد</button>
  `;
};

window.ph30_deleteCupon = async function(cuponId) {
  if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
  
  await fsDelete('cupons', cuponId);
  AppData.cupons = AppData.cupons.filter(c => c.id !== cuponId);
  toast(I18N.ar.cupon_deleted, 'success');
  if (typeof render === 'function') render();
};

// ============================================================
// Cupon Input in Booking
// ============================================================

window.ph30_renderCuponInput = function() {
  return `
    <div class="ph30-cupon-input">
      <div class="form-group">
        <label class="form-label">🎟️ ${I18N.ar.enter_cupon_code}</label>
        <div style="display:flex;gap:8px">
          <input class="form-control" id="ph30-booking-code" placeholder="${I18N.ar.cupon_code}">
          <button class="btn btn-secondary" onclick="ph30_applyBookingCupon()">تطبيق</button>
        </div>
      </div>
      ${window.ph30_activeCupon ? `
        <div class="ph30-applied">
          <span>🎉 تم تطبيق: ${window.ph30_activeCupon.code}</span>
          <button onclick="ph30_removeCupon()" style="margin-right:8px;background:none;border:none;color:var(--danger);cursor:pointer">✕</button>
        </div>
      ` : ''}
    </div>
  `;
};

window.ph30_applyBookingCupon = async function() {
  const code = document.getElementById('ph30-booking-code').value.trim();
  const price = window.ph30_orderTotal || 0;
  
  await window.ph30_applyCupon(code, price);
  
  // Update display
  const container = document.querySelector('.ph30-cupon-input');
  if (container && window.ph30_activeCupon) {
    container.innerHTML = `
      <div class="ph30-applied" style="background:linear-gradient(135deg,#10b98120,#05966920);padding:12px;border-radius:8px;display:flex;align-items:center;justify-content:space-between">
        <span>🎉 تم تطبيق: <strong>${window.ph30_activeCupon.code}</strong> (-${window.ph30_getDiscountAmount()} ريال)</span>
        <button onclick="ph30_removeCupon()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:18px">✕</button>
      </div>
    `;
  }
};

// ============================================================
// Add Styles
// ============================================================

(function() {
  if (window.ph30_stylesAdded) return;
  window.ph30_stylesAdded = true;
  
  const style = document.createElement('style');
  style.textContent = `
    .ph30-form { padding: 8px; }
    .ph30-list { display: grid; gap: 12px; }
    .ph30-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
    .ph30-card.active { border-color: #10b981; }
    .ph30-card.expired { opacity: 0.6; }
    .ph30-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .ph30-code { font-size: 20px; font-weight: 800; letter-spacing: 2px; }
    .ph30-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .ph30-badge.active { background: #10b981; color: #fff; }
    .ph30-badge.expired { background: #ef4444; color: #fff; }
    .ph30-discount { font-size: 28px; font-weight: 800; color: #10b981; }
    .ph30-info { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
    .ph30-card-actions { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .ph30-applied { background: linear-gradient(135deg, #10b98120, #05966920); padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; }
    .ph30-cupon-input { margin: 16px 0; padding: 16px; background: var(--bg-card); border-radius: 12px; }
    .ph30-empty { text-align: center; padding: 40px; color: var(--text-muted); }
  `;
  document.head.appendChild(style);
})();

console.log('[Phase 30] Cupon System loaded');