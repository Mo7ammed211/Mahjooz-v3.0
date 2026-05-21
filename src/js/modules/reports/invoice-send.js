// ═══════════════════════════════════════════════════════
//  محجوز v2.7 — Phase 7
//  Send invoice PDF directly to the customer
//
//  Strategy (no backend needed):
//    1. Generate PDF as Blob via ph6_generateInvoice(id, {returnBlob:true})
//    2. Try Web Share API (navigator.canShare with files)
//         — works on most mobile browsers, lets the user pick
//           Mail / WhatsApp / Telegram / etc.
//    3. Fallback: download the PDF + open mailto: with a
//       pre-filled body asking the user to attach the file.
//
//  Auto-trigger: when an admin/driver marks an order as
//  "completed", we ask: "📧 إرسال الفاتورة للعميل؟"
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('send_invoice',           'إرسال الفاتورة للعميل',         'Send invoice to customer');
  add('send_invoice_short',     'إرسال للعميل',                  'Send to customer');
  add('send_invoice_ask',       '📧 هل تريد إرسال الفاتورة للعميل الآن؟', '📧 Send the invoice to the customer now?');
  add('send_via',               'اختر طريقة الإرسال',             'Choose a delivery method');
  add('send_share',             '📲 مشاركة (واتساب / إيميل / غيره)', '📲 Share (WhatsApp / Email / etc.)');
  add('send_email_only',        '📧 بريد إلكتروني',              '📧 Email');
  add('send_whatsapp',          '💬 واتساب',                     '💬 WhatsApp');
  add('send_download_only',     '⬇️ تنزيل فقط',                  '⬇️ Download only');
  add('send_no_email',          'لا يوجد بريد إلكتروني للعميل',   'Customer has no email on file');
  add('send_no_phone',          'لا يوجد رقم جوال للعميل',        'Customer has no phone on file');
  add('send_done',              'تم فتح نافذة الإرسال ✅',        'Send window opened ✅');
  add('send_cancelled',         'تم إلغاء الإرسال',              'Send cancelled');
  add('send_attach_hint',       'تم تنزيل ملف الفاتورة. يرجى إرفاقه يدوياً برسالة البريد المفتوحة.', 'Invoice file downloaded. Please attach it manually to the opened email.');
  add('email_subject',          'فاتورة طلبك من محجوز',           'Your Mahjooz invoice');
  add('email_body',             'مرحباً،\n\nمرفق فاتورة طلبك رقم {orderId} من منصة محجوز.\n\nشكراً لاختيارك خدماتنا.\n\nمحجوز ✨', 'Hello,\n\nAttached is the invoice for your order #{orderId} from Mahjooz.\n\nThank you for choosing us.\n\nMahjooz ✨');
  add('whatsapp_msg',           'مرحباً، فاتورة طلبك رقم {orderId} من محجوز جاهزة. (أرفقت ملف PDF)', 'Hi, your invoice for order #{orderId} from Mahjooz is ready. (PDF attached)');
})();

// ─── Helper: lookup customer + order ──────────────────
function ph7_lookup(orderId) {
  const order = (AppData.orders || []).find(o => o.id === orderId || o.orderId === orderId);
  if (!order) return { error: 'الطلب غير موجود' };
  const customer = (AppData.users || []).find(u => u.uid === order.userId || u.uid === order.customerId);
  return { order, customer };
}

// ─── Send dialog: lets the user pick a method ─────────
function ph7_showSendDialog(orderId) {
  const { order, customer, error } = ph7_lookup(orderId);
  if (error) { ph7_toast(error, 'error'); return; }

  const hasEmail = !!(customer?.email);
  const hasPhone = !!(customer?.phone);
  const canShare = !!(navigator.canShare && navigator.share);

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📧 ${t('send_invoice')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="padding:8px 4px 16px 4px">
      <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.25);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:12px;color:var(--text-secondary)">رقم الطلب</div>
            <div style="font-weight:800;font-family:monospace">${order.orderId || order.id}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-secondary)">العميل</div>
            <div style="font-weight:700">${customer?.name || order.customerName || '—'}</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-secondary);display:flex;gap:14px;flex-wrap:wrap">
          ${hasEmail ? `<span>✉️ ${customer.email}</span>` : `<span style="color:#ef4444">⚠️ ${t('send_no_email')}</span>`}
          ${hasPhone ? `<span>📱 ${customer.phone}</span>` : `<span style="color:#ef4444">⚠️ ${t('send_no_phone')}</span>`}
        </div>
      </div>

      <div style="font-weight:700;margin-bottom:10px">${t('send_via')}:</div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${canShare ? `
          <button class="btn btn-primary btn-block" onclick="ph7_doSend('${order.id}','share')" style="background:#7c3aed;border-color:#7c3aed;text-align:right;padding:14px 16px">
            <div style="font-weight:700">${t('send_share')}</div>
            <div style="font-size:12px;opacity:.85;margin-top:2px">يفتح قائمة المشاركة في الجهاز — الأنسب للجوال</div>
          </button>` : ''}

        <button class="btn btn-secondary btn-block" onclick="ph7_doSend('${order.id}','email')" ${hasEmail ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'} style="text-align:right;padding:14px 16px">
          <div style="font-weight:700">${t('send_email_only')}</div>
          <div style="font-size:12px;opacity:.75;margin-top:2px">${hasEmail ? `تنزيل + فتح بريد إلى ${customer.email}` : t('send_no_email')}</div>
        </button>

        <button class="btn btn-secondary btn-block" onclick="ph7_doSend('${order.id}','whatsapp')" ${hasPhone ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'} style="text-align:right;padding:14px 16px;background:#25d36615;border-color:#25d366">
          <div style="font-weight:700;color:#25d366">${t('send_whatsapp')}</div>
          <div style="font-size:12px;opacity:.75;margin-top:2px">${hasPhone ? `تنزيل + فتح واتساب إلى ${customer.phone}` : t('send_no_phone')}</div>
        </button>

        <button class="btn btn-secondary btn-block" onclick="ph7_doSend('${order.id}','download')" style="text-align:right;padding:14px 16px">
          <div style="font-weight:700">${t('send_download_only')}</div>
          <div style="font-size:12px;opacity:.75;margin-top:2px">حفظ ملف PDF فقط على جهازك</div>
        </button>
      </div>
    </div>
  `);
}
window.ph7_showSendDialog = ph7_showSendDialog;

// ─── Build a PDF File from invoice ────────────────────
async function ph7_buildInvoiceFile(orderId) {
  const blob = await ph6_generateInvoice(orderId, { returnBlob: true, silent: false });
  if (!blob) return null;
  const filename = `mahjooz-invoice-${orderId}.pdf`;
  return new File([blob], filename, { type: 'application/pdf' });
}

// ─── Trigger a browser download for a Blob/File ───────
function ph7_downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}

// ─── The actual send dispatcher ───────────────────────
async function ph7_doSend(orderId, method) {
  closeModal();
  const { order, customer, error } = ph7_lookup(orderId);
  if (error) { ph7_toast(error, 'error'); return; }

  const file = await ph7_buildInvoiceFile(orderId);
  if (!file) return;
  const orderNo = order.orderId || order.id;

  if (method === 'share') {
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t('email_subject'),
          text: t('email_body').replace('{orderId}', orderNo).replace(/\n/g, ' '),
        });
        ph7_toast(t('send_done'), 'success');
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') { ph7_toast(t('send_cancelled'), 'info'); return; }
      console.warn('Share failed, falling back:', e);
    }
    // fallback
    ph7_downloadBlob(file, file.name);
    ph7_toast(t('send_attach_hint'), 'info');
    return;
  }

  if (method === 'email') {
    if (!customer?.email) { ph7_toast(t('send_no_email'), 'error'); return; }
    ph7_downloadBlob(file, file.name);
    const subject = encodeURIComponent(t('email_subject') + ` #${orderNo}`);
    const body = encodeURIComponent(t('email_body').replace('{orderId}', orderNo));
    setTimeout(() => {
      window.location.href = `mailto:${encodeURIComponent(customer.email)}?subject=${subject}&body=${body}`;
      ph7_toast(t('send_attach_hint'), 'info');
    }, 700);
    return;
  }

  if (method === 'whatsapp') {
    if (!customer?.phone) { ph7_toast(t('send_no_phone'), 'error'); return; }
    ph7_downloadBlob(file, file.name);
    const phone = String(customer.phone).replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(t('whatsapp_msg').replace('{orderId}', orderNo));
    setTimeout(() => {
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      ph7_toast(t('send_attach_hint'), 'info');
    }, 700);
    return;
  }

  if (method === 'download') {
    ph7_downloadBlob(file, file.name);
    ph7_toast(t('pdf_done'), 'success');
    return;
  }
}
window.ph7_doSend = ph7_doSend;

// ─── Toast helper ─────────────────────────────────────
function ph7_toast(msg, type = 'info') {
  if (typeof toast === 'function') { toast(msg, type); return; }
  console.log(`[${type}]`, msg);
}

// ─── Auto-prompt on order completion ──────────────────
//  Wraps existing fsUpdate/handlers without breaking them.
//  We monkey-patch updateOrderStatus + updateDeliveryStatus.
(function wrapCompletionHandlers() {
  // Admin handler
  const __origUpdateOrderStatus = window.updateOrderStatus;
  if (typeof __origUpdateOrderStatus === 'function') {
    window.updateOrderStatus = async function (orderId, status) {
      const before = (AppData.orders || []).find(o => o.id === orderId);
      const wasCompleted = before?.status === 'completed';
      await __origUpdateOrderStatus(orderId, status);
      if (status === 'completed' && !wasCompleted) {
        ph7_promptSendOnCompletion(orderId);
      }
    };
  }

  // Driver handler — fires the auto-completed branch
  const __origUpdateDeliveryStatus = window.updateDeliveryStatus;
  if (typeof __origUpdateDeliveryStatus === 'function') {
    window.updateDeliveryStatus = async function (orderId, status) {
      const before = (AppData.orders || []).find(o => o.id === orderId);
      const wasCompleted = before?.status === 'completed';
      await __origUpdateDeliveryStatus(orderId, status);
      // delivery handler auto-promotes 'delivered' → 'completed'
      if ((status === 'delivered' || status === 'completed') && !wasCompleted) {
        // small delay so the render() inside the original finishes first
        setTimeout(() => ph7_promptSendOnCompletion(orderId), 400);
      }
    };
  }
})();

// ─── Small confirmation banner (auto-dismiss in 12s) ──
function ph7_promptSendOnCompletion(orderId) {
  const { order, customer } = ph7_lookup(orderId);
  if (!order) return;

  // Build a floating prompt
  const id = 'ph7-completion-prompt';
  document.getElementById(id)?.remove();
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    z-index:99999; background:linear-gradient(135deg,#7c3aed,#a855f7);
    color:#fff; padding:14px 18px; border-radius:14px;
    box-shadow:0 10px 30px rgba(124,58,237,0.4);
    display:flex; align-items:center; gap:14px; flex-wrap:wrap;
    max-width:92vw; font-family:inherit; direction:rtl;
    animation: ph7slideup 0.3s ease-out;
  `;
  wrap.innerHTML = `
    <style>
      @keyframes ph7slideup { from { opacity:0; transform:translate(-50%, 30px); } to { opacity:1; transform:translate(-50%, 0); } }
    </style>
    <div style="font-size:24px">📧</div>
    <div style="flex:1;min-width:180px">
      <div style="font-weight:800;font-size:14px">${t('send_invoice_ask')}</div>
      <div style="font-size:11px;opacity:.85;margin-top:2px">طلب #${order.orderId || order.id} • ${customer?.name || order.customerName || ''}</div>
    </div>
    <button onclick="document.getElementById('${id}').remove(); ph7_showSendDialog('${order.id}')" style="background:#fff;color:#7c3aed;border:0;padding:8px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px">إرسال</button>
    <button onclick="document.getElementById('${id}').remove()" style="background:rgba(255,255,255,0.2);color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-size:13px">لاحقاً</button>
  `;
  document.body.appendChild(wrap);

  // Auto-dismiss after 12s
  setTimeout(() => document.getElementById(id)?.remove(), 12000);
}
window.ph7_promptSendOnCompletion = ph7_promptSendOnCompletion;

// ─── Inject 📧 button into admin orders rows ──────────
const __ph7_origRenderAdminOrders = window.renderAdminOrders;
window.renderAdminOrders = function () {
  let html = __ph7_origRenderAdminOrders ? __ph7_origRenderAdminOrders() : '';
  // Inject email button right after the existing PDF (📄) button added by phase6
  html = html.replace(
    /(<button class="btn btn-sm btn-secondary"[^>]*onclick="ph6_generateInvoice\('([^']+)'\)"[^>]*>.*?<\/button>)/g,
    (full, btn, oid) => `${btn}<button class="btn btn-sm btn-secondary" onclick="ph7_showSendDialog('${oid}')" title="${t('send_invoice_short')}" style="background:#10b981;color:#fff;border-color:#10b981;padding:8px">📧</button>`
  );
  return html;
};
