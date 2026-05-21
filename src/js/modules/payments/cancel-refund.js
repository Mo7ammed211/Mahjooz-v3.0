/* ============================================================
   phase32.js — نظام إلغاء الحجز والاسترداد
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('cancel_order', 'إلغاء الطلب', 'Cancel Order');
  add('cancel_booking', 'إلغاء الحجز', 'Cancel Booking');
  add('cancel_reason', 'سبب الإلغاء', 'Cancel Reason');
  add('select_reason', 'اختر السبب', 'Select Reason');
  add('cancel_confirmation', 'تأكيد الإلغاء', 'Confirm Cancellation');
  add('refund', 'استرداد', 'Refund');
  add('refund_amount', 'مبلغ الاسترداد', 'Refund Amount');
  add('refund_processed', 'تم معالجة الاسترداد', 'Refund Processed');
  add('refund_to_wallet', 'استرداد للمحفظة', 'Refund to Wallet');
  add('cancel_policy', 'سياسة الإلغاء', 'Cancellation Policy');
  add('free_cancellation', 'إلغاء مجاني', 'Free Cancellation');
  add('partial_refund', 'استرداد جزئي', 'Partial Refund');
  add('no_refund', 'لا يوجد استرداد', 'No Refund');
  add('cancel_not_allowed', 'لا يمكن الإلغاء', 'Cancel Not Allowed');
  add('already_cancelled', 'تم إلغاء الطلب مسبقاً', 'Already Cancelled');
  add('cancellation_request', 'طلب إلغاء', 'Cancellation Request');
  add('pending_refund', 'استرداد معلق', 'Pending Refund');
  add('refund_completed', 'اكتمل الاسترداد', 'Refund Completed');
  add('order_cancelled', 'تم إلغاء الطلب', 'Order Cancelled');
  add('changed_mind', 'تغيير الخطط', 'Changed Mind');
  add('service_unavailable', 'الخدمة غير متاحة', 'Service Unavailable');
  add('emergency', 'طوارئ', 'Emergency');
  add('other_reason', 'سبب آخر', 'Other Reason');

})();

// ============================================================
// Cancellation Policy Config
// ============================================================

window.ph32_config = {
  // Policy: refund % based on hours before service time
  policies: [
    { hoursBefore: 24, refundPercent: 100, label: 'إلغاء مجاني (قبل 24 ساعة)' },
    { hoursBefore: 12, refundPercent: 50, label: 'استرداد 50% (قبل 12 ساعة)' },
    { hoursBefore: 6, refundPercent: 25, label: 'استرداد 25% (قبل 6 ساعات)' },
    { hoursBefore: 0, refundPercent: 0, label: 'لا يوجد استرداد' }
  ],
  // Reasons for cancellation
  reasons: [
    { id: 'changed_mind', label: 'تغيير الخطط', refundPercent: 100 },
    { id: 'found_other', label: 'وجدت مزود آخر', refundPercent: 100 },
    { id: 'emergency', label: 'طوارئ', refundPercent: 100 },
    { id: 'service_unavailable', label: 'الخدمة غير متاحة', refundPercent: 100 },
    { id: 'delay', label: 'تأخر كبير', refundPercent: 50 },
    { id: 'price_issue', label: 'مشكلة في السعر', refundPercent: 50 },
    { id: 'other', label: 'سبب آخر', refundPercent: 0 }
  ]
};

// ============================================================
// Calculate Refund
// ============================================================

window.ph32_calculateRefund = function(order) {
  if (!order || !order.date || !order.time) {
    return { refund: 0, percent: 0, label: window.ph32_config.policies[3].label };
  }
  
  const serviceDateTime = new Date(`${order.date}T${order.time}`);
  const now = new Date();
  const hoursBefore = (serviceDateTime - now) / (1000 * 60 * 60);
  
  for (const policy of window.ph32_config.policies) {
    if (hoursBefore >= policy.hoursBefore) {
      const refund = Math.round(order.total * (policy.refundPercent / 100));
      return {
        refund,
        percent: policy.refundPercent,
        label: policy.label,
        hoursBefore
      };
    }
  }
  
  return { refund: 0, percent: 0, label: 'لا يوجد استرداد' };
};

// ============================================================
// Show Cancel Modal
// ============================================================

window.ph32_showCancelModal = function(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  
  if (o.status === 'cancelled') {
    toast(I18N.ar.already_cancelled, 'error');
    return;
  }
  
  const calc = window.ph32_calculateRefund(o);
  const reasons = window.ph32_config.reasons;
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">❌ ${I18N.ar.cancel_order}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div class="ph32-order-info" style="background:var(--bg-card);padding:16px;border-radius:12px;margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:8px">${o.svcIcon || '🔷'} ${o.svcName}</div>
      <div style="font-size:13px;color:var(--text-muted)">${o.orderId}</div>
    </div>
    
    <div class="ph32-policy" style="background:linear-gradient(135deg,#f59e0b20,#fef3c7);padding:16px;border-radius:12px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:8px">📋 ${I18N.ar.cancel_policy}</div>
      <div style="font-size:14px">
        ${window.ph32_config.policies.map(p => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span>${p.label}</span>
            <span style="font-weight:600;color:${p.refundPercent > 0 ? '#10b981' : '#ef4444'}">${p.refundPercent}%</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="ph32-refund-preview" style="background:linear-gradient(135deg,#10b98120,#05966920);padding:16px;border-radius:12px;margin-bottom:16px;text-align:center">
      <div style="font-size:12px;color:var(--text-muted)">${I18N.ar.refund_amount}</div>
      <div style="font-size:32px;font-weight:800;color:#10b981">${calc.refund} ريال</div>
      <div style="font-size:12px;color:var(--text-muted)">${calc.label}</div>
    </div>
    
    <div class="form-group">
      <label class="form-label">${I18N.ar.select_reason}</label>
      <select class="form-control" id="ph32-cancel-reason">
        <option value="">-- اختر --</option>
        ${reasons.map(r => `<option value="${r.id}" data-refund="${r.refundPercent}">${r.label}</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label class="form-label">${I18N.ar.cancel_reason} (اختياري)</label>
      <textarea class="form-control" id="ph32-cancel-note" rows="2" placeholder="اكتب ملاحظاتك..."></textarea>
    </div>
    
    <button class="btn btn-danger btn-block btn-lg" onclick="ph32_confirmCancel('${orderId}')">
      ❌ ${I18N.ar.cancel_order} والاسترداد
    </button>
  `);
  
  window.ph32_currentRefund = calc;
};

window.ph32_confirmCancel = async function(orderId) {
  const reason = document.getElementById('ph32-cancel-reason').value;
  const note = document.getElementById('ph32-cancel-note').value.trim();
  const o = AppData.orders.find(x => x.id === orderId);
  const u = State.currentUser;
  
  if (!reason) {
    toast('يرجى اختيار السبب', 'error');
    return;
  }
  
  // Calculate final refund
  const reasonData = window.ph32_config.reasons.find(r => r.id === reason);
  let refundAmount = window.ph32_currentRefund?.refund || 0;
  
  // If order already paid via wallet, refund to wallet
  if (refundAmount > 0 && o.paymentMethod === 'wallet') {
    await window.creditWallet(o.customerId, refundAmount, `استرداد إلغاء طلب #${o.orderId}`);
  }
  
  // Update order status
  await fsUpdate('orders', orderId, {
    status: 'cancelled',
    cancelledAt: new Date(),
    cancelReason: reason,
    cancelNote: note,
    refundAmount: refundAmount,
    refundStatus: refundAmount > 0 ? 'completed' : 'none'
  });
  
  // Notify vendor if exists
  // (Add notification code here if needed)
  
  closeModal();
  toast(`${I18N.ar.order_cancelled}${refundAmount > 0 ? ` + ${refundAmount} ريال مسترد` : ''}`, 'success');
  navigate('myorders');
};

// ============================================================
// Render Cancel Button in Order
// ============================================================

window.ph32_renderCancelButton = function(order) {
  // Only show for pending or accepted orders
  if (!['pending', 'accepted'].includes(order.status)) return '';
  
  const timeLeft = window.ph32_getTimeUntilService(order);
  const cancelAllowed = timeLeft === null || timeLeft > 0;
  
  if (!cancelAllowed) return '';
  
  return `
    <button class="btn btn-sm" style="background:var(--danger);color:#fff" onclick="ph32_showCancelModal('${order.id}')">
      ❌ ${I18N.ar.cancel_order}
    </button>
  `;
};

window.ph32_getTimeUntilService = function(order) {
  if (!order.date || !order.time) return null;
  
  const serviceDateTime = new Date(`${order.date}T${order.time}`);
  const now = new Date();
  const hours = (serviceDateTime - now) / (1000 * 60 * 60);
  
  return hours;
};

// ============================================================
// Admin: View Cancellations
// ============================================================

window.ph32_renderCancellationsAdmin = function() {
  const cancelled = AppData.orders.filter(o => o.status === 'cancelled');
  
  if (cancelled.length === 0) {
    return `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">❌</div>
        <div>لا توجد طلبات ملغاة</div>
      </div>
    `;
  }
  
  return `
    <div class="ph32-cancellations-list">
      ${cancelled.map(o => `
        <div class="ph32-cancelled-card" style="background:var(--bg-card);border:1px solid var(--danger);border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <div>
              <div style="font-weight:700">${o.svcIcon || '🔷'} ${o.svcName}</div>
              <div style="font-size:12px;color:var(--text-muted)">${o.orderId}</div>
            </div>
            <span class="badge badge-danger">ملغي</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            <div>السبب: <strong>${o.cancelReason || '—'}</strong></div>
            <div>المسترد: <strong style="color:#10b981">${o.refundAmount || 0} ريال</strong></div>
            ${o.cancelNote ? `<div style="grid-column:span 2">ملاحظة: ${o.cancelNote}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// ============================================================
// Auto-check on order status change
// ============================================================

window.ph32_checkAndRefund = async function(orderId, newStatus) {
  if (newStatus === 'cancelled') {
    const o = AppData.orders.find(x => x.id === orderId);
    if (!o) return;
    
    const calc = window.ph32_calculateRefund(o);
    if (calc.refund > 0 && o.paymentMethod === 'wallet') {
      await window.creditWallet(o.customerId, calc.refund, `استرداد تلقائي - طلب #${o.orderId}`);
    }
  }
};

// ============================================================
// Add Styles
// ============================================================

(function() {
  if (window.ph32_stylesAdded) return;
  window.ph32_stylesAdded = true;
  
  const style = document.createElement('style');
  style.textContent = `
    .ph32-order-info { }
    .ph32-policy { }
    .ph32-refund-preview { }
    .ph32-cancelled-card { }
    .badge-danger { background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; }
  `;
  document.head.appendChild(style);
})();

console.log('[Phase 32] Cancel/Refund System loaded');