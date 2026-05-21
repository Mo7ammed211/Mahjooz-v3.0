// ═══════════════════════════════════════════════════════
//  محجوز v2.6 — Phase 6
//  PDF Report Export (Arabic / RTL friendly)
//    • Single-order invoice
//    • User account statement (transactions + recharges)
//    • Monthly performance report (KPIs + top services/regions)
//
//  Approach: build a styled HTML offscreen, snapshot via
//  html2canvas, then embed as image into a jsPDF document.
//  This bypasses jsPDF's poor Arabic font support entirely
//  by letting the BROWSER render the Arabic text.
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('pdf_invoice',          'فاتورة PDF',                 'Invoice PDF');
  add('pdf_statement',        'كشف حساب PDF',               'Statement PDF');
  add('pdf_monthly_report',   'تقرير شهري PDF',             'Monthly report PDF');
  add('pdf_generating',       'جاري إنشاء الملف...',         'Generating PDF...');
  add('pdf_done',             'تم تحميل الملف ✅',           'PDF downloaded ✅');
  add('pdf_error',            'فشل إنشاء الملف',             'PDF generation failed');
  add('pdf_libs_missing',     'مكتبة PDF غير محمّلة',         'PDF library not loaded');
  add('inv_title',            'فاتورة',                     'Invoice');
  add('inv_number',           'رقم الفاتورة',                'Invoice No.');
  add('inv_date',             'تاريخ الإصدار',               'Issue date');
  add('inv_customer',         'بيانات العميل',               'Customer details');
  add('inv_provider',         'بيانات المزوّد',              'Provider details');
  add('inv_service',          'الخدمة',                     'Service');
  add('inv_unit',             'وحدة',                       'unit');
  add('inv_qty',              'الكمية',                     'Qty');
  add('inv_price',            'السعر',                      'Price');
  add('inv_subtotal',         'الإجمالي الفرعي',             'Subtotal');
  add('inv_tax',              'ضريبة القيمة المضافة (15%)', 'VAT (15%)');
  add('inv_grand',            'المبلغ الإجمالي',             'Grand total');
  add('inv_status',           'حالة الطلب',                 'Order status');
  add('inv_payment',          'طريقة الدفع',                 'Payment method');
  add('inv_thanks',           'شكراً لاختياركم محجوز ✨',     'Thank you for choosing Mahjooz ✨');
  add('inv_footer',           'هذه الفاتورة صادرة إلكترونياً ولا تحتاج توقيع.', 'This invoice is electronically generated and requires no signature.');
  add('stmt_title',           'كشف حساب',                   'Account statement');
  add('stmt_period',          'الفترة',                      'Period');
  add('stmt_user',            'المستخدم',                    'User');
  add('stmt_open_balance',    'الرصيد الافتتاحي',            'Opening balance');
  add('stmt_close_balance',   'الرصيد الختامي',              'Closing balance');
  add('stmt_credits',         'إجمالي الإيداعات',            'Total credits');
  add('stmt_debits',          'إجمالي السحوبات',             'Total debits');
  add('stmt_net',             'الصافي',                     'Net');
  add('stmt_no_tx',           'لا توجد حركات في هذه الفترة', 'No transactions in this period');
  add('mr_title',             'تقرير الأداء الشهري',         'Monthly Performance Report');
  add('mr_period',            'الفترة المغطّاة',              'Period covered');
  add('mr_kpis',              'المؤشرات الرئيسية',           'Key indicators');
  add('mr_top_svc',           'أفضل الخدمات',                'Top services');
  add('mr_top_reg',           'أفضل المناطق',                'Top regions');
  add('mr_status_break',      'توزيع حالات الطلبات',         'Status breakdown');
  add('mr_generated',         'تاريخ الإنشاء',               'Generated on');
  add('th_date',              'التاريخ',                    'Date');
  add('th_type',              'النوع',                      'Type');
  add('th_amount',            'المبلغ',                     'Amount');
  add('th_balance',           'الرصيد',                     'Balance');
  add('th_note',              'ملاحظة',                     'Note');
  add('th_orders',            'الطلبات',                    'Orders');
  add('th_revenue',           'الإيرادات',                  'Revenue');
  add('th_count',             'العدد',                      'Count');
  add('th_percent',           'النسبة',                     'Percent');
  add('credit',               'إيداع',                      'Credit');
  add('debit',                'سحب',                        'Debit');
  add('range_30',             'آخر 30 يوم',                  'Last 30 days');
  add('range_90',             'آخر 90 يوم',                  'Last 90 days');
  add('select_period',        'اختر الفترة',                 'Select period');
})();

// ─── Helper utilities ─────────────────────────────────
function ph6_toDate(ts) {
  if (!ts) return null;
  if (ts.toDate)  return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') { const d = new Date(ts); return isNaN(d) ? null : d; }
  if (ts instanceof Date) return ts;
  return null;
}
function ph6_fmtMoney(n) {
  return Number(n||0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ph6_fmtDate(d) {
  if (!d) return '—';
  const dd = ph6_toDate(d) || new Date();
  return dd.toLocaleDateString('ar-SA', { year:'numeric', month:'2-digit', day:'2-digit' }) +
         ' ' + dd.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });
}
function ph6_dayKey(d) {
  const dd = d instanceof Date ? d : (ph6_toDate(d) || new Date());
  return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
}

// ─── Loading toast (fallback if `toast` is missing) ───
function ph6_toast(msg, type = 'info') {
  if (typeof toast === 'function') { toast(msg, type); return; }
  console.log(`[${type}]`, msg);
}

// ─── Wait for libs (non-blocking, returns boolean) ────
function ph6_loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('script failed: ' + src));
    document.head.appendChild(s);
  });
}
async function ph6_libsReady(maxWaitMs = 25000) {
  const has = () => !!(window.html2canvas && window.jspdf?.jsPDF);
  // First wait the natural CDN load.
  const start = Date.now();
  while (Date.now() - start < Math.min(8000, maxWaitMs)) {
    if (has()) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  // Fallback: manually inject from alternative CDNs.
  const tasks = [];
  if (!window.html2canvas) {
    tasks.push(
      ph6_loadScript('https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js')
        .catch(() => ph6_loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'))
        .catch(() => null)
    );
  }
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    tasks.push(
      ph6_loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js')
        .catch(() => ph6_loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'))
        .catch(() => null)
    );
  }
  await Promise.all(tasks);
  // Final wait.
  const finalStart = Date.now();
  while (Date.now() - finalStart < (maxWaitMs - (Date.now()-start))) {
    if (has()) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return has();
}

// ─── Core: turn an HTML string into a PDF (download or Blob) ──
// options: { returnBlob: bool } — when true, returns a Blob and skips download
async function ph6_htmlToPdf(htmlInner, filename, options = {}) {
  const ready = await ph6_libsReady();
  if (!ready) { ph6_toast(t('pdf_libs_missing'), 'error'); return null; }

  // Build offscreen container with proper Arabic font styling
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed; top:0; left:0;
    width:794px; min-height:1123px;
    background:#ffffff; color:#1f2937;
    direction:rtl; text-align:right;
    font-family: 'Tajawal', 'Tahoma', Arial, sans-serif;
    font-size:13px; line-height:1.8;
    padding:36px 40px;
    box-sizing:border-box;
    opacity:0;
    z-index:-1;
  `;
  wrap.innerHTML = htmlInner;
  document.body.appendChild(wrap);

  // Wait briefly
  await new Promise(r => setTimeout(r, 500));

  // Make visible before capture
  wrap.style.opacity = '1';
  wrap.style.zIndex = '9999';
  
  await new Promise(r => setTimeout(r, 300));

  try {
    const canvas = await window.html2canvas(wrap, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: true,
      windowWidth: wrap.scrollWidth,
      windowHeight: wrap.scrollHeight,
    });

    console.log('Canvas dimensions:', canvas.width, canvas.height);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const imgW  = pageW;
    const imgH  = (canvas.height * imgW) / canvas.width;

    // Slice the tall canvas across pages
    let heightLeft = imgH;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, undefined, 'FAST');
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, undefined, 'FAST');
      heightLeft -= pageH;
    }
    if (options.returnBlob) {
      return pdf.output('blob');
    }
    pdf.save(filename);
    ph6_toast(t('pdf_done'), 'success');
    return null;
  } catch (e) {
    console.error('PDF generation error:', e);
    ph6_toast(t('pdf_error') + ': ' + (e?.message || e), 'error');
    return null;
  } finally {
    // Make invisible and remove
    wrap.style.opacity = '0';
    wrap.style.zIndex = '-1';
    document.body.removeChild(wrap);
  }
}

// ─── Brand header (used at top of all docs) ───────────
function ph6_brandHeader(subtitle) {
  const isAr = t('language') !== 'Language';
  const brandName = isAr ? 'محجوز' : 'Mahjooz';
  const brandTag = isAr ? 'منصة الحجوزات والخدمات الشاملة' : 'Bookings & Services Platform';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid #7c3aed;margin-bottom:20px">
      <div>
        <div class="brand-text" style="font-size:28px;font-weight:800;color:#7c3aed;letter-spacing:1px">${brandName}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${brandTag}</div>
      </div>
      <div style="text-align:left;font-size:12px;color:#6b7280">
        <div style="font-weight:700;color:#1f2937;font-size:14px;margin-bottom:2px">${subtitle || ''}</div>
        <div>${ph6_fmtDate(new Date())}</div>
      </div>
    </div>`;
}
function ph6_footer() {
  const isAr = t('language') !== 'Language';
  return `
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af">
      ${t('inv_footer')} • ${isAr ? 'محجوز' : 'Mahjooz'} © ${new Date().getFullYear()}
    </div>`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// ═══════════════════════════════════════════════════════
//  1) INVOICE PDF (single order)
// ═══════════════════════════════════════════════════════
async function ph6_generateInvoice(orderId, options = {}) {
  const order = (AppData.orders || []).find(o => o.id === orderId || o.orderId === orderId);
  if (!order) { ph6_toast('الطلب غير موجود', 'error'); return null; }

  if (!options.silent) ph6_toast(t('pdf_generating'), 'info');

  const customer = (AppData.users || []).find(u => u.uid === order.userId || u.uid === order.customerId) || {};
  const vendor   = (AppData.users || []).find(u => u.uid === order.vendorId) || {};
  const service  = (AppData.services || []).find(s => s.id === order.serviceId) || {};

  // Use English for PDF to avoid Arabic rendering issues
  const lang = 'en';
  
  const labels = {
    ar: {
      title: 'فاتورة رسمية',
      invoiceNo: 'رقم الفاتورة',
      issueDate: 'تاريخ الإصدار',
      customer: 'بيانات العميل',
      provider: 'مزود الخدمة',
      service: 'الخدمة',
      qty: 'الكمية',
      unit: 'وحدة',
      price: 'السعر',
      subtotal: 'الإجمالي الفرعي',
      tax: 'ضريبة القيمة المضافة (15%)',
      grand: 'المبلغ الإجمالي',
      status: 'حالة الطلب',
      payment: 'طريقة الدفع',
      thanks: 'شكراً لاختياركم محجوز ✨',
      wallet: 'محفظة محجوز',
      pending: 'قيد الانتظار',
      accepted: 'مقبول',
      withDriver: 'مع المندوب',
      delivered: 'مُوصّل',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      orderDate: 'تاريخ الطلب',
      deliveryAddr: 'عنوان التوصيل',
      serviceDesc: 'وصف الخدمة',
      platformFee: 'رسوم المنصة',
      providerEarnings: 'صافي دخل المزود',
    },
    en: {
      title: 'Official Invoice',
      invoiceNo: 'Invoice No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      provider: 'Provider Details',
      service: 'Service',
      qty: 'Qty',
      unit: 'unit',
      price: 'Price',
      subtotal: 'Subtotal',
      tax: 'VAT (15%)',
      grand: 'Grand Total',
      status: 'Order Status',
      payment: 'Payment Method',
      thanks: 'Thank you for choosing Mahjooz ✨',
      wallet: 'Mahjooz Wallet',
      pending: 'Pending',
      accepted: 'Accepted',
      withDriver: 'With Driver',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
      orderDate: 'Order Date',
      deliveryAddr: 'Delivery Address',
      serviceDesc: 'Service Description',
      platformFee: 'Platform Fee',
      providerEarnings: 'Provider Earnings',
    }
  };
  const l = labels[lang];
  
  const sLabel = {
    pending: l.pending,
    accepted: l.accepted,
    with_driver: l.withDriver,
    delivered: l.delivered,
    completed: l.completed,
    cancelled: l.cancelled
  };

  const subtotal = Number(order.total || 0);
  const platformFee = +(subtotal * 0.15).toFixed(2);
  const grand = +(subtotal).toFixed(2);
  const providerEarnings = +(grand - platformFee).toFixed(2);

  const paymentMethod = order.paymentMethod || l.wallet;

  const html = `
    ${ph6_brandHeader(l.title + ' • ' + (order.orderId || order.id))}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px">
        <div style="font-weight:700;color:#7c3aed;font-size:12px;margin-bottom:4px">${l.invoiceNo}</div>
        <div style="font-family:monospace;font-weight:700;font-size:14px">${esc(order.orderId || order.id)}</div>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px">
        <div style="font-weight:700;color:#7c3aed;font-size:12px;margin-bottom:4px">${l.issueDate}</div>
        <div style="font-weight:600">${ph6_fmtDate(order.createdAt)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px">
        <div style="font-weight:700;color:#92400e;font-size:12px;margin-bottom:6px">👤 ${l.customer}</div>
        <div style="font-weight:700;font-size:14px">${esc(customer.name || order.customerName || '—')}</div>
        ${customer.phone ? `<div style="color:#6b7280;font-size:12px">📱 ${esc(customer.phone)}</div>` : ''}
        ${customer.email ? `<div style="color:#6b7280;font-size:12px">✉️ ${esc(customer.email)}</div>` : ''}
        ${order.customerAddr ? `<div style="color:#6b7280;font-size:11px;margin-top:6px;padding-top:6px;border-top:1px dashed #d1d5db">📍 ${esc(order.customerAddr)}</div>` : ''}
      </div>
      <div style="background:#dbeafe;border:1px solid #60a5fa;border-radius:10px;padding:14px">
        <div style="font-weight:700;color:#1e40af;font-size:12px;margin-bottom:6px">🏢 ${l.provider}</div>
        <div style="font-weight:700;font-size:14px">${esc(vendor.name || service.provider || '—')}</div>
        ${vendor.phone ? `<div style="color:#6b7280;font-size:12px">📱 ${esc(vendor.phone)}</div>` : ''}
        ${service.contact ? `<div style="color:#6b7280;font-size:12px">☎️ ${esc(service.contact)}</div>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px">
      <thead>
        <tr style="background:#7c3aed;color:#fff">
          <th style="padding:10px;text-align:right">${l.service}</th>
          <th style="padding:10px;text-align:center;width:80px">${l.qty}</th>
          <th style="padding:10px;text-align:left;width:100px">${l.price}</th>
          <th style="padding:10px;text-align:left;width:120px">${l.subtotal}</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:14px 10px;font-weight:600">
            ${order.svcIcon || service.icon || '🛎️'} ${esc(order.svcName || service.name || '—')}
            ${service.desc ? `<div style="font-size:11px;color:#6b7280;font-weight:400;margin-top:3px">${esc(service.desc)}</div>` : ''}
            ${order.date ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">📅 ${esc(order.date)}</div>` : ''}
          </td>
          <td style="padding:14px 10px;text-align:center">1 ${l.unit}</td>
          <td style="padding:14px 10px;text-align:left">${ph6_fmtMoney(subtotal)} ر</td>
          <td style="padding:14px 10px;text-align:left;font-weight:700">${ph6_fmtMoney(subtotal)} ر</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-start">
      <div style="width:300px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px">
          <span>${l.subtotal}</span><span>${ph6_fmtMoney(subtotal)} ر</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280">
          <span>${l.tax}</span><span>${ph6_fmtMoney(platformFee)} ر</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0 4px 0;border-top:2px solid #7c3aed;margin-top:6px;font-weight:800;font-size:15px;color:#7c3aed">
          <span>${l.grand}</span><span>${ph6_fmtMoney(grand)} ر</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;font-size:12px">
      <div style="background:#f3f4f6;border-radius:8px;padding:10px 14px">
        <span style="color:#6b7280">${l.status}:</span>
        <span style="font-weight:700;margin-right:6px">${sLabel[order.status] || order.status || '—'}</span>
      </div>
      <div style="background:#f3f4f6;border-radius:8px;padding:10px 14px">
        <span style="color:#6b7280">${l.payment}:</span>
        <span style="font-weight:700;margin-right:6px">${esc(paymentMethod)}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;font-size:12px">
      <div style="background:#ecfdf5;border-radius:8px;padding:10px 14px;border:1px solid #10b981">
        <span style="color:#059669">${l.providerEarnings}:</span>
        <span style="font-weight:700;margin-right:6px;color:#059669">${ph6_fmtMoney(providerEarnings)} ر</span>
      </div>
    </div>

    <div style="text-align:center;margin-top:30px;padding:20px;background:linear-gradient(135deg,#7c3aed10,#7c3aed05);border-radius:12px;font-size:14px;color:#7c3aed;font-weight:700">
      ${l.thanks}
    </div>

    ${ph6_footer()}
  `;

  const filename = `mahjooz-invoice-${order.orderId || order.id}.pdf`;
  if (options.returnBlob) {
    return await ph6_htmlToPdf(html, filename, { returnBlob: true });
  }
  await ph6_htmlToPdf(html, filename);
  return null;
}
window.ph6_generateInvoice = ph6_generateInvoice;

// ═══════════════════════════════════════════════════════
//  2) ACCOUNT STATEMENT PDF (per user, last N days)
// ═══════════════════════════════════════════════════════
async function ph6_generateStatement(userId, days = 30) {
  // Look up by uid OR Firestore doc id, then fall back to current user.
  const me = (typeof State !== 'undefined' && State?.currentUser) || null;
  const user = (AppData.users || []).find(u => u.uid === userId || u.id === userId)
            || (me && (me.uid === userId || me.id === userId) ? me : null)
            || me;
  if (!user) { ph6_toast('المستخدم غير موجود', 'error'); return; }
  // Ensure userId we use downstream is the canonical key on transactions.
  userId = user.uid || user.id || userId;

  ph6_toast(t('pdf_generating'), 'info');

  const cutoff = new Date(Date.now() - days * 86400000);
  // Transactions are stored with `uid` field (see core.js creditWallet/deductWallet);
  // accept legacy `userId` too for safety.
  const txAll = (AppData.transactions || []).filter(t => (t.uid && t.uid === userId) || (t.userId && t.userId === userId));
  const tx = txAll
    .map(t => ({ ...t, _date: ph6_toDate(t.createdAt) }))
    .filter(t => t._date && t._date >= cutoff)
    .sort((a, b) => a._date - b._date);

  const credits = tx.filter(t => t.type === 'credit').reduce((a, t) => a + (Number(t.amount) || 0), 0);
  const debits  = tx.filter(t => t.type === 'debit').reduce((a, t) => a + (Number(t.amount) || 0), 0);
  const net = credits - debits;
  const closingBalance = Number(user.walletBalance || user.balance || 0);
  const openingBalance = closingBalance - net;

  // Build running-balance column
  let running = openingBalance;
  const rows = tx.map(t => {
    if (t.type === 'credit') running += Number(t.amount) || 0;
    else                     running -= Number(t.amount) || 0;
    return { ...t, running };
  });

  const html = `
    ${ph6_brandHeader(t('stmt_title'))}

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:20px">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px">
        <div style="font-weight:700;color:#7c3aed;font-size:12px;margin-bottom:6px">👤 ${t('stmt_user')}</div>
        <div style="font-weight:700;font-size:15px">${esc(user.name || '—')}</div>
        <div style="color:#6b7280;font-size:12px;margin-top:2px">
          ${esc(user.email || '—')}${user.phone ? ' • ' + esc(user.phone) : ''}
        </div>
        <div style="margin-top:6px;font-size:11px;color:#9ca3af">معرّف: ${esc(user.uid)}</div>
      </div>
      <div style="background:#7c3aed;color:#fff;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:11px;opacity:.85;margin-bottom:4px">${t('stmt_period')}</div>
        <div style="font-weight:800;font-size:14px">${days === 30 ? t('range_30') : days === 90 ? t('range_90') : `آخر ${days} يوم`}</div>
        <div style="font-size:10px;opacity:.8;margin-top:4px">${ph6_fmtDate(cutoff).split(' ')[0]} → ${ph6_fmtDate(new Date()).split(' ')[0]}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;color:#15803d">${t('stmt_open_balance')}</div>
        <div style="font-weight:800;font-size:16px;margin-top:3px;color:#15803d">${ph6_fmtMoney(openingBalance)} ر</div>
      </div>
      <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;color:#1d4ed8">${t('stmt_credits')}</div>
        <div style="font-weight:800;font-size:16px;margin-top:3px;color:#1d4ed8">+${ph6_fmtMoney(credits)} ر</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;color:#b91c1c">${t('stmt_debits')}</div>
        <div style="font-weight:800;font-size:16px;margin-top:3px;color:#b91c1c">−${ph6_fmtMoney(debits)} ر</div>
      </div>
      <div style="background:#7c3aed;color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;opacity:.85">${t('stmt_close_balance')}</div>
        <div style="font-weight:800;font-size:16px;margin-top:3px">${ph6_fmtMoney(closingBalance)} ر</div>
      </div>
    </div>

    ${rows.length === 0 ? `
      <div style="text-align:center;padding:50px 20px;color:#9ca3af;background:#f9fafb;border:1px dashed #d1d5db;border-radius:10px">
        <div style="font-size:42px;margin-bottom:8px">📭</div>
        <div>${t('stmt_no_tx')}</div>
      </div>
    ` : `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#1f2937;color:#fff">
            <th style="padding:10px;text-align:right">${t('th_date')}</th>
            <th style="padding:10px;text-align:right">${t('th_type')}</th>
            <th style="padding:10px;text-align:right">${t('th_note')}</th>
            <th style="padding:10px;text-align:left">${t('th_amount')}</th>
            <th style="padding:10px;text-align:left">${t('th_balance')}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background:${i%2?'#f9fafb':'#fff'};border-bottom:1px solid #e5e7eb">
              <td style="padding:8px 10px;font-size:11px;color:#6b7280">${ph6_fmtDate(r._date)}</td>
              <td style="padding:8px 10px">
                <span style="background:${r.type==='credit'?'#dcfce7':'#fee2e2'};color:${r.type==='credit'?'#166534':'#991b1b'};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">
                  ${r.type === 'credit' ? '↑ ' + t('credit') : '↓ ' + t('debit')}
                </span>
              </td>
              <td style="padding:8px 10px">${esc(r.note || r.description || '—')}</td>
              <td style="padding:8px 10px;text-align:left;font-weight:700;color:${r.type==='credit'?'#15803d':'#b91c1c'}">
                ${r.type==='credit'?'+':'−'}${ph6_fmtMoney(r.amount)} ر
              </td>
              <td style="padding:8px 10px;text-align:left;font-weight:700">${ph6_fmtMoney(r.running)} ر</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `}

    ${ph6_footer()}
  `;

  await ph6_htmlToPdf(html, `mahjooz-statement-${user.uid}-${days}d.pdf`);
}
window.ph6_generateStatement = ph6_generateStatement;

// ═══════════════════════════════════════════════════════
//  3) MONTHLY PERFORMANCE REPORT PDF
// ═══════════════════════════════════════════════════════
async function ph6_generateMonthlyReport(days = 30) {
  ph6_toast(t('pdf_generating'), 'info');

  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 86400000);
  const orders = (AppData.orders || []).map(o => ({ ...o, _date: ph6_toDate(o.createdAt) }))
    .filter(o => o._date && o._date >= cutoff);

  const isRev = (o) => o.status === 'completed' || o.status === 'delivered';
  const revenue = orders.filter(isRev).reduce((a,o)=>a+(Number(o.total)||0), 0);
  const completed = orders.filter(o=>o.status==='completed').length;
  const cancelled = orders.filter(o=>o.status==='cancelled').length;
  const completionRate = orders.length ? Math.round((completed/orders.length)*100) : 0;
  const avgValue = orders.length ? Math.round(revenue/orders.length) : 0;
  const activeUsers = new Set(orders.map(o => o.userId || o.customerId).filter(Boolean)).size;

  // Status breakdown
  const statusBuckets = { pending:0, accepted:0, with_driver:0, delivered:0, completed:0, cancelled:0 };
  for (const o of orders) {
    const s = (o.status || '').toLowerCase();
    if (statusBuckets[s] !== undefined) statusBuckets[s]++;
  }
  const statusLabels = { pending:'⏳ قيد الانتظار', accepted:'✅ مقبول', with_driver:'🚗 مع المندوب',
                         delivered:'📦 موصّل', completed:'🎉 مكتمل', cancelled:'❌ ملغي' };

  // Top services (by revenue)
  const services = AppData.services || [];
  const svcName = {}; for (const s of services) svcName[s.id] = s.name || s.id;
  const svcTotals = {};
  for (const o of orders) {
    const sid = o.serviceId || 'unknown';
    if (!svcTotals[sid]) svcTotals[sid] = { count:0, revenue:0 };
    svcTotals[sid].count++;
    if (isRev(o)) svcTotals[sid].revenue += Number(o.total)||0;
  }
  const topSvc = Object.entries(svcTotals).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,8);

  // Top regions
  const regions = AppData.regions || [];
  const regName = {}; for (const r of regions) regName[r.id] = r.name;
  const svcRegion = {}; for (const s of services) svcRegion[s.id] = s.regionId;
  const regCounts = {};
  for (const o of orders) {
    const rid = svcRegion[o.serviceId] || o.regionId || 'unknown';
    if (!regCounts[rid]) regCounts[rid] = { count:0, revenue:0 };
    regCounts[rid].count++;
    if (isRev(o)) regCounts[rid].revenue += Number(o.total)||0;
  }
  const topReg = Object.entries(regCounts).sort((a,b)=>b[1].count-a[1].count).slice(0,6);

  const kpiCard = (icon, label, value, color) => `
    <div style="background:linear-gradient(135deg,${color}15,${color}05);border:1px solid ${color};border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:22px;margin-bottom:4px">${icon}</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${label}</div>
      <div style="font-weight:800;font-size:18px;color:${color}">${value}</div>
    </div>`;

  const html = `
    ${ph6_brandHeader(t('mr_title'))}

    <div style="background:#7c3aed;color:#fff;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;opacity:.85">${t('mr_period')}</div>
        <div style="font-weight:800;font-size:16px;margin-top:2px">${days === 30 ? t('range_30') : days === 90 ? t('range_90') : `آخر ${days} يوم`}</div>
      </div>
      <div style="text-align:left;font-size:11px;opacity:.85">
        <div>${t('mr_generated')}</div>
        <div style="font-weight:700;margin-top:2px">${ph6_fmtDate(now)}</div>
      </div>
    </div>

    <div style="font-weight:700;margin-bottom:10px;color:#1f2937;font-size:14px">📊 ${t('mr_kpis')}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
      ${kpiCard('💰', t('th_revenue'), ph6_fmtMoney(revenue) + ' ر', '#10b981')}
      ${kpiCard('📦', t('th_orders'), orders.length.toLocaleString('ar-EG'), '#3b82f6')}
      ${kpiCard('✅', 'نسبة الإتمام', completionRate + '%', '#8b5cf6')}
      ${kpiCard('🧾', 'متوسط قيمة الطلب', ph6_fmtMoney(avgValue) + ' ر', '#f59e0b')}
      ${kpiCard('👥', 'العملاء النشطون', activeUsers.toLocaleString('ar-EG'), '#ec4899')}
      ${kpiCard('❌', 'الطلبات الملغاة', cancelled.toLocaleString('ar-EG'), '#ef4444')}
    </div>

    <div style="font-weight:700;margin:14px 0 8px 0;color:#1f2937;font-size:14px">🍩 ${t('mr_status_break')}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12px">
      <thead>
        <tr style="background:#1f2937;color:#fff">
          <th style="padding:9px;text-align:right">الحالة</th>
          <th style="padding:9px;text-align:left;width:90px">${t('th_count')}</th>
          <th style="padding:9px;text-align:left;width:90px">${t('th_percent')}</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(statusBuckets).filter(([,n])=>n>0).map(([k,n], i)=>{
          const pct = orders.length ? Math.round((n/orders.length)*100) : 0;
          return `<tr style="background:${i%2?'#f9fafb':'#fff'};border-bottom:1px solid #e5e7eb">
            <td style="padding:8px 10px;font-weight:600">${statusLabels[k]||k}</td>
            <td style="padding:8px 10px;text-align:left;font-weight:700">${n}</td>
            <td style="padding:8px 10px;text-align:left">
              <div style="display:flex;align-items:center;gap:6px;justify-content:flex-start;direction:ltr">
                <div style="width:60px;height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:#7c3aed"></div>
                </div>
                <span style="font-weight:700;font-size:11px">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="3" style="padding:14px;text-align:center;color:#9ca3af">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>

    <div style="font-weight:700;margin:14px 0 8px 0;color:#1f2937;font-size:14px">🏆 ${t('mr_top_svc')}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12px">
      <thead>
        <tr style="background:#10b981;color:#fff">
          <th style="padding:9px;text-align:right">الخدمة</th>
          <th style="padding:9px;text-align:left;width:90px">${t('th_orders')}</th>
          <th style="padding:9px;text-align:left;width:120px">${t('th_revenue')}</th>
        </tr>
      </thead>
      <tbody>
        ${topSvc.map(([id, v], i) => `
          <tr style="background:${i%2?'#f9fafb':'#fff'};border-bottom:1px solid #e5e7eb">
            <td style="padding:8px 10px;font-weight:600">${i+1}. ${esc(svcName[id] || id)}</td>
            <td style="padding:8px 10px;text-align:left">${v.count}</td>
            <td style="padding:8px 10px;text-align:left;font-weight:700;color:#10b981">${ph6_fmtMoney(v.revenue)} ر</td>
          </tr>`).join('') || '<tr><td colspan="3" style="padding:14px;text-align:center;color:#9ca3af">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>

    <div style="font-weight:700;margin:14px 0 8px 0;color:#1f2937;font-size:14px">📍 ${t('mr_top_reg')}</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#06b6d4;color:#fff">
          <th style="padding:9px;text-align:right">المنطقة</th>
          <th style="padding:9px;text-align:left;width:90px">${t('th_orders')}</th>
          <th style="padding:9px;text-align:left;width:120px">${t('th_revenue')}</th>
        </tr>
      </thead>
      <tbody>
        ${topReg.map(([id, v], i) => `
          <tr style="background:${i%2?'#f9fafb':'#fff'};border-bottom:1px solid #e5e7eb">
            <td style="padding:8px 10px;font-weight:600">${i+1}. ${esc(regName[id] || (id==='unknown'?'— غير محدد —':id))}</td>
            <td style="padding:8px 10px;text-align:left">${v.count}</td>
            <td style="padding:8px 10px;text-align:left;font-weight:700;color:#06b6d4">${ph6_fmtMoney(v.revenue)} ر</td>
          </tr>`).join('') || '<tr><td colspan="3" style="padding:14px;text-align:center;color:#9ca3af">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>

    ${ph6_footer()}
  `;

  await ph6_htmlToPdf(html, `mahjooz-monthly-report-${ph6_dayKey(now)}-${days}d.pdf`);
}
window.ph6_generateMonthlyReport = ph6_generateMonthlyReport;

// ═══════════════════════════════════════════════════════
//  UI INTEGRATION — inject buttons into existing screens
// ═══════════════════════════════════════════════════════

// Override renderAdminOrders to add a 📄 button per row
const __ph6_originalRenderAdminOrders = window.renderAdminOrders;
window.renderAdminOrders = function () {
  let html = __ph6_originalRenderAdminOrders ? __ph6_originalRenderAdminOrders() : '';
  // Inject a PDF invoice button into the action cells.
  // Insert just after the first 👁️ "view" button on each row.
  html = html.replace(
    /(<button class="btn btn-sm btn-secondary"[^>]*onclick="showOrderDetails\('([^']+)'\)"[^>]*>.*?<\/button>)/g,
    (full, btn, oid) => `${btn}<button class="btn btn-sm btn-secondary" onclick="ph6_generateInvoice('${oid}')" title="${t('pdf_invoice')}" style="background:#7c3aed;color:#fff;border-color:#7c3aed;padding:8px">📄</button>`
  );
  return html;
};

// Override renderAdminWallet to add 📄 statement buttons per user
const __ph6_originalRenderAdminWallet = window.renderAdminWallet;
window.renderAdminWallet = function () {
  let html = __ph6_originalRenderAdminWallet ? __ph6_originalRenderAdminWallet() : '';
  // Append a generic "users statement" button block at top
  const me = State.currentUser;
  if (me?.role === 'admin' || (typeof userHasPerm==='function' && userHasPerm(me, 'view_wallets'))) {
    const wmap = (AppData.wallets || {});
    const balOf = (u) => Number((wmap[u.uid]?.balance) ?? u.walletBalance ?? u.balance ?? 0);
    const usersList = (AppData.users || [])
      .map(u => ({...u, _bal: balOf(u)}))
      .filter(u => u._bal > 0 || (AppData.transactions||[]).some(t => (t.uid && t.uid===u.uid) || (t.userId && t.userId===u.uid)))
      .slice(0, 200);
    if (usersList.length) {
      const userOptions = usersList.map(u =>
        `<option value="${u.uid || u.id}">${esc(u.name || u.email || u.uid || u.id)} — ${ph6_fmtMoney(u._bal)} ر</option>`
      ).join('');
      const block = `
        <div style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:16px;margin:16px 0">
          <h3 style="margin:0 0 10px 0">📄 تصدير كشف حساب PDF</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="ph6-stmt-user" class="input" style="flex:1;min-width:220px">${userOptions}</select>
            <select id="ph6-stmt-days" class="input" style="width:160px">
              <option value="30">${t('range_30')}</option>
              <option value="90">${t('range_90')}</option>
              <option value="365">آخر سنة</option>
            </select>
            <button class="btn btn-primary" onclick="ph6_generateStatement(document.getElementById('ph6-stmt-user').value, parseInt(document.getElementById('ph6-stmt-days').value,10))">📥 تحميل PDF</button>
          </div>
        </div>`;
      html = html.replace(/<h2>💰 إدارة المحافظ<\/h2>/, m => m + block);
    }
  }
  return html;
};
