/* ============================================================
   phase28.js — نظام العربون (Deposit System)
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('deposit_system', 'نظام العربون', 'Deposit System');
  add('deposit_percentage', 'نسبة العربون', 'Deposit %');
  add('deposit_amount', 'مبلغ العربون', 'Deposit Amount');
  add('pay_deposit_only', 'دفع العربون فقط', 'Pay Deposit Only');
  add('remaining_amount', 'المبلغ المتبقي', 'Remaining Amount');
  add('deposit_paid', 'تم دفع العربون', 'Deposit Paid');
  add('remaining_to_pay', 'المتبقي للدفع', 'Remaining to Pay');

})();

window.ph28_calcDeposit = function(price, depositPercent) {
  if (!price || !depositPercent) return { deposit: 0, remaining: price, hasDeposit: false };
  const deposit = Math.round(price * (depositPercent / 100));
  const remaining = price - deposit;
  return { deposit, remaining, hasDeposit: true };
};

window.ph28_showBookingWithDeposit = function(service, addr) {
  const u = State.currentUser;
  if (!u) { navigate('login'); return; }
  
  const price = service.price || 0;
  const depositPercent = service.depositPercent || 0;
  const calc = window.ph28_calcDeposit(price, depositPercent);
  
  if (!calc.hasDeposit) {
    return false;
  }
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${service.icon || '🔷'} تأكيد الحجز بالعربون</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div style="background:linear-gradient(135deg,#7c3aed10,#9333ea10);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-weight:700;font-size:16px;margin-bottom:4px">${service.name}</div>
      <div style="color:var(--text-muted);font-size:13px">${service.provider || ''}</div>
    </div>
    
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span>سعر الخدمة:</span>
        <span style="font-weight:600">${price.toLocaleString()} ر</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--text-muted)">
        <span>نسبة العربون:</span>
        <span>${depositPercent}%</span>
      </div>
      <div style="border-top:1px dashed var(--border);padding-top:12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--primary)">
          <span style="font-weight:700">💰 العربون (تدفع الآن):</span>
          <span style="font-weight:800;font-size:18px;color:var(--primary)">${calc.deposit.toLocaleString()} ر</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:var(--text-muted)">
          <span>المتبقي (تدفع عند الوصول):</span>
          <span style="font-weight:600">${calc.remaining.toLocaleString()} ر</span>
        </div>
      </div>
    </div>

    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label" style="font-weight:700">📅 التاريخ المطلوب *</label>
      <input class="form-control" id="bk-date" type="date" min="${new Date().toISOString().split('T')[0]}" style="font-family:'Tajawal', sans-serif;">
    </div>
    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label" style="font-weight:700">🕐 الوقت المفضل</label>
      <input class="form-control" id="bk-time" type="time" style="font-family:'Tajawal', sans-serif;">
    </div>
    <div class="form-group" style="margin-bottom: 16px;">
      <label class="form-label" style="font-weight:700">💬 ملاحظات إضافية</label>
      <textarea class="form-control" id="bk-note" placeholder="أي تفاصيل أو ملاحظات خاصة بطلبك..." style="resize:vertical; font-family:'Tajawal', sans-serif;"></textarea>
    </div>
    
    <button class="btn btn-primary btn-lg btn-block" style="background:linear-gradient(135deg,#10b981,#059669)" onclick="ph28_confirmBookingDeposit('${service.id}', '${addr || ''}')">
      💰 تأكيد ودفع العربون (${calc.deposit.toLocaleString()} ر)
    </button>
    
    <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-muted)">
      ✅ سيتم دفع المبلغ المتبقي (${calc.remaining.toLocaleString()} ر) عند وصول الخدمة
    </div>
  `);
  
  return true;
};

window.ph28_confirmBookingDeposit = async function(svcId, addr) {
  const u = State.currentUser;
  const s = AppData.services.find(x => x.id === svcId);
  if (!s || !u) return;

  const date = document.getElementById('bk-date')?.value;
  const time = document.getElementById('bk-time')?.value || '';
  const note = document.getElementById('bk-note')?.value.trim() || '';

  if (!date) {
    toast('يرجى اختيار التاريخ المطلوب', 'error');
    return;
  }
  
  const price = s.price || 0;
  const depositPercent = s.depositPercent || 0;
  const calc = window.ph28_calcDeposit(price, depositPercent);
  
  const matchedAddr = (window.__ph41_addresses || []).find(a => a.address === addr);
  const housePics = matchedAddr ? (matchedAddr.pics || []) : (u.housePics || []);

  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
  await fsAdd('orders', {
    orderId,
    userId: u.uid,
    customerName: u.name,
    customerPhone: u.phone,
    customerAddr: addr,
    serviceId: s.id,
    svcName: s.name,
    svcIcon: s.icon,
    vendorId: s.vendorId,
    providerName: s.provider,
    price: price,
    depositPercent: depositPercent,
    depositAmount: calc.deposit,
    remainingAmount: calc.remaining,
    total: calc.deposit,
    paidAmount: calc.deposit,
    paymentStatus: 'deposit_paid',
    status: 'pending',
    date: date,
    time: time,
    note: note,
    createdAt: new Date(),
    housePics: housePics
  });
  
  if (calc.deposit > 0) {
    await window.creditWallet(u.uid, -calc.deposit, 'دفع العربون للحجز - ' + s.name);
  }
  
  closeModal();
  toast('✅ تم تأكيد حجزك! دفع العربون: ' + calc.deposit.toLocaleString() + ' ر', 'success');
  navigate('myorders');
};

console.log('[Phase 28] نظام العربون loaded');