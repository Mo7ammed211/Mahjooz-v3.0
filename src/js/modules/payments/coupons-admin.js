// ═══════════════════════════════════════════════════════
//  محجوز v3.4 — Phase 14 (Coupons / Promo Codes)
//  - تبويب جديد "🎟️ كوبونات" في لوحة المدير لإنشاء/إدارة الأكواد
//  - حقل "كود خصم" في نافذة الحجز يطبّق الخصم تلقائياً
//  - دعم نوعين: نسبة % أو مبلغ ثابت
//  - حدود: تاريخ صلاحية، عدد استخدامات كلي، استخدامات لكل عميل
// ═══════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('coupons_tab',     '🎟️ كوبونات',         '🎟️ Coupons');
  add('coupon_code_lbl', 'كود الخصم (اختياري)','Promo code (optional)');
  add('coupon_apply',    'تطبيق',               'Apply');
  add('coupon_invalid',  'كود غير صالح',         'Invalid code');
  add('coupon_expired',  'الكود منتهي الصلاحية', 'Code expired');
  add('coupon_maxed',    'الكود استُنفد',         'Code max-used');
  add('coupon_user_max', 'استخدمت هذا الكود سابقاً', 'You have used this code already');
  add('coupon_applied',  'تم تطبيق الخصم',       'Discount applied');
})();


// ── Coupons tab logic moved to Master Router (phase26.js) ──



// Hook into the data load to also fetch coupons (lazy)
window.__ph14_coupons = [];
window.ph14_loadCoupons = async function () {
  try {
    const snap = await db.collection('coupons').get();
    window.__ph14_coupons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { window.__ph14_coupons = []; }
};

window.ph14_renderCouponsAdmin = function () {
  // Trigger async load on first view
  if (!window.__ph14_loaded) {
    window.__ph14_loaded = true;
    ph14_loadCoupons().then(() => render());
  }
  const list = window.__ph14_coupons || [];
  const usedCount = (cid) => (AppData.orders || []).filter(o => o.couponId === cid).length;
  return `
    <div class="ph14-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h2>🎟️ الكوبونات والعروض</h2>
        <button class="btn btn-primary" onclick="ph14_openCouponModal()">➕ كوبون جديد</button>
      </div>
      ${list.length === 0
        ? `<div class="empty-state" style="margin-top:24px">لا توجد كوبونات بعد. اضغط "➕ كوبون جديد" لإضافة أول كوبون.</div>`
        : `<div class="table-wrap" style="margin-top:16px"><table class="admin-table">
            <thead><tr>
              <th>الكود</th><th>النوع</th><th>القيمة</th><th>الصلاحية</th>
              <th>الاستخدامات</th><th>الحالة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>${list.map(c => {
              const uses = usedCount(c.id);
              const expired = c.expiresAt && (c.expiresAt.seconds * 1000 < Date.now());
              const maxed = c.maxUses && uses >= c.maxUses;
              const status = c.active === false ? '🚫 موقوف' : expired ? '⏰ منتهي' : maxed ? '🛑 مستنفد' : '✅ نشط';
              const expDate = c.expiresAt ? new Date(c.expiresAt.seconds*1000).toLocaleDateString('ar-EG') : '∞';
              return `<tr>
                <td><strong>${escHtml(c.code)}</strong></td>
                <td>${c.kind === 'percent' ? 'نسبة %' : 'مبلغ ثابت'}</td>
                <td>${c.value}${c.kind === 'percent' ? '%' : ' ر'}</td>
                <td>${expDate}</td>
                <td>${uses}${c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                <td>${status}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="ph14_toggleActive('${c.id}', ${c.active === false})">${c.active === false ? 'تفعيل' : 'إيقاف'}</button>
                  <button class="btn btn-sm btn-danger" onclick="ph14_deleteCoupon('${c.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>`}
    </div>`;
};

window.ph14_openCouponModal = function () {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🎟️ كوبون جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">الكود</label>
      <input class="form-control" id="ph14-code" placeholder="مثال: WELCOME10" style="text-transform:uppercase">
    </div>
    <div class="ph9-grid-2">
      <div class="form-group"><label class="form-label">النوع</label>
        <select class="form-control" id="ph14-kind">
          <option value="percent">نسبة %</option>
          <option value="fixed">مبلغ ثابت</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">القيمة</label>
        <input class="form-control" id="ph14-value" type="number" min="1" placeholder="10">
      </div>
      <div class="form-group"><label class="form-label">تاريخ الانتهاء</label>
        <input class="form-control" id="ph14-exp" type="date">
      </div>
      <div class="form-group"><label class="form-label">الحد الأقصى للاستخدامات</label>
        <input class="form-control" id="ph14-max" type="number" min="1" placeholder="غير محدود">
      </div>
      <div class="form-group"><label class="form-label">حد لكل عميل</label>
        <input class="form-control" id="ph14-perUser" type="number" min="1" value="1">
      </div>
      <div class="form-group"><label class="form-label">الحد الأدنى للطلب (ر)</label>
        <input class="form-control" id="ph14-minOrder" type="number" min="0" placeholder="0">
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="ph14_saveCoupon()">💾 حفظ الكوبون</button>
  `);
};

window.ph14_saveCoupon = async function () {
  const code = document.getElementById('ph14-code').value.trim().toUpperCase();
  const kind = document.getElementById('ph14-kind').value;
  const value = parseFloat(document.getElementById('ph14-value').value);
  const exp = document.getElementById('ph14-exp').value;
  const max = parseInt(document.getElementById('ph14-max').value) || null;
  const perUser = parseInt(document.getElementById('ph14-perUser').value) || 1;
  const minOrder = parseFloat(document.getElementById('ph14-minOrder').value) || 0;
  if (!code || !value || value <= 0) { toast('أكمل الحقول الأساسية', 'error'); return; }
  if (kind === 'percent' && value > 100) { toast('النسبة لا تتجاوز 100%', 'error'); return; }
  // Check duplicate
  if (window.__ph14_coupons.find(c => c.code === code)) { toast('الكود موجود مسبقاً', 'error'); return; }
  try {
    const data = {
      code, kind, value, maxUses: max, maxPerUser: perUser, minOrder, active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (exp) data.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(exp));
    await db.collection('coupons').add(data);
    closeModal();
    toast('✅ تم حفظ الكوبون', 'success');
    await ph14_loadCoupons();
    await render();
  } catch (e) { toast('تعذّر الحفظ: ' + (e.message || e), 'error'); }
};

window.ph14_toggleActive = async function (id, makeActive) {
  try {
    await db.collection('coupons').doc(id).update({ active: makeActive });
    await ph14_loadCoupons();
    await render();
  } catch (e) { toast('فشل', 'error'); }
};

window.ph14_deleteCoupon = async function (id) {
  if (!confirm('حذف هذا الكوبون؟')) return;
  try {
    await db.collection('coupons').doc(id).delete();
    await ph14_loadCoupons();
    await render();
    toast('تم الحذف', 'success');
  } catch (e) { toast('فشل الحذف', 'error'); }
};

// ════════════════════════════════════════════════════════════
//  2) Customer: validate + apply coupon at booking
// ════════════════════════════════════════════════════════════
window.__ph14_appliedCoupon = null;

window.ph14_validateAndApply = async function () {
  const s = typeof ph17_settings === 'function' ? ph17_settings() : {};
  if (s.couponsEnabled === false) {
    const summaryEl = document.getElementById('ph14-bk-summary');
    if (summaryEl) summaryEl.innerHTML = '<span style="color:#ef4444">النظام معطل حالياً</span>';
    return;
  }
  const code = (document.getElementById('ph14-bk-code')?.value || '').trim().toUpperCase();
  const summaryEl = document.getElementById('ph14-bk-summary');
  if (!code) { window.__ph14_appliedCoupon = null; if (summaryEl) summaryEl.innerHTML = ''; return; }
  // Lazy-load coupons if empty
  if (!window.__ph14_coupons || !window.__ph14_coupons.length) await ph14_loadCoupons();
  const c = window.__ph14_coupons.find(x => x.code === code);
  if (!c || c.active === false) { window.__ph14_appliedCoupon = null; if (summaryEl) summaryEl.innerHTML = `<span style="color:#ef4444">${t('coupon_invalid')}</span>`; return; }
  if (c.expiresAt && (c.expiresAt.seconds * 1000 < Date.now())) { window.__ph14_appliedCoupon = null; if (summaryEl) summaryEl.innerHTML = `<span style="color:#ef4444">${t('coupon_expired')}</span>`; return; }
  const usesAll = (AppData.orders || []).filter(o => o.couponId === c.id).length;
  if (c.maxUses && usesAll >= c.maxUses) { window.__ph14_appliedCoupon = null; if (summaryEl) summaryEl.innerHTML = `<span style="color:#ef4444">${t('coupon_maxed')}</span>`; return; }
  const u = State.currentUser;
  const usesByMe = (AppData.orders || []).filter(o => o.couponId === c.id && o.customerId === u.uid).length;
  if (c.maxPerUser && usesByMe >= c.maxPerUser) { window.__ph14_appliedCoupon = null; if (summaryEl) summaryEl.innerHTML = `<span style="color:#ef4444">${t('coupon_user_max')}</span>`; return; }
  window.__ph14_appliedCoupon = c;
  if (summaryEl) summaryEl.innerHTML = `<span style="color:#10b981">${t('coupon_applied')}: ${c.kind === 'percent' ? c.value + '%' : c.value + ' ر'} خصم</span>`;
};

// Inject coupon input into booking modal — wrap openModal to detect bookings
(function patchOpenModalForCoupon() {
  const __orig = window.openModal;
  if (typeof __orig !== 'function') { setTimeout(patchOpenModalForCoupon, 600); return; }
  window.openModal = function (html, opts) {
    const s = typeof ph17_settings === 'function' ? ph17_settings() : {};
    if (s.couponsEnabled === false) return __orig.call(this, html, opts);

    // Detect booking modal: contains "تأكيد الحجز" + the confirmBooking call
    if (typeof html === 'string' && html.includes("confirmBooking('") && !html.includes('ph14-bk-code')) {
      // Inject coupon block right before the confirm button
      const couponBlock = `
        <div class="form-group">
          <label class="form-label">${t('coupon_code_lbl')}</label>
          <div style="display:flex;gap:8px">
            <input class="form-control" id="ph14-bk-code" placeholder="WELCOME10" style="text-transform:uppercase;flex:1">
            <button class="btn btn-secondary" onclick="ph14_validateAndApply()">${t('coupon_apply')}</button>
          </div>
          <div id="ph14-bk-summary" style="margin-top:6px;font-size:13px"></div>
        </div>`;
      window.__ph14_appliedCoupon = null;
      html = html.replace(/(<button[^>]*onclick="confirmBooking\(')/, couponBlock + '$1');
    }
    return __orig.call(this, html, opts);
  };
})();

// Apply discount inside confirmBooking
(function patchConfirmBookingForCoupon() {
  const __orig = window.confirmBooking;
  if (typeof __orig !== 'function') { setTimeout(patchConfirmBookingForCoupon, 600); return; }
  window.confirmBooking = async function (svcId) {
    const c = window.__ph14_appliedCoupon;
    if (!c) return __orig.apply(this, arguments);
    // Wrap fsAdd one time to inject coupon discount into the order
    const __origAdd = window.fsAdd;
    window.fsAdd = async function (col, data) {
      if (col === 'orders' && c) {
        const base = data.servicePrice || 0;
        const discount = c.kind === 'percent' ? Math.round(base * c.value / 100) : Math.min(base, c.value);
        const newTotal = Math.max(0, (data.total || 0) - discount);
        data = { ...data, couponId: c.id, couponCode: c.code, couponDiscount: discount, total: newTotal };
        window.__ph14_appliedCoupon = null;
        window.fsAdd = __origAdd;
      }
      return __origAdd.call(this, col, data);
    };
    return __orig.apply(this, arguments);
  };
})();

console.log('[Phase 14] Coupons system loaded.');
