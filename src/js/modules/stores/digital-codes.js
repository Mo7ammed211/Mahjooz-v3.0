/* ============================================================
   Phase 44 — نظام المنتجات الرقمية (Digital Codes / Vouchers)
   - Admin: رفع الأكواد (PDF/TXT/يدوي) وإدارة المخزون
   - Customer: يحصل على كود فريد عند اكتمال طلبه
   ============================================================ */
'use strict';

// ─── Helper: توليد slug للمنتج الرقمي ──────────────────
function ph44_mkId() {
  return 'dc_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ─── Admin: فتح مودال إدارة مخزون الأكواد ──────────────
window.ph44_showCodesModal = function (productId, storeId) {
  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;

  const allCodes = (AppData.digitalCodes || []).filter(c => c.productId === productId);
  const available = allCodes.filter(c => c.status === 'available');
  const sold      = allCodes.filter(c => c.status === 'sold');

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🔑 مخزون الأكواد — ${escHtml(p.name)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#10b981">${available.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">متاح للبيع</div>
      </div>
      <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:var(--primary)">${sold.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">مباع</div>
      </div>
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#3b82f6">${allCodes.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">الإجمالي</div>
      </div>
    </div>

    ${available.length < 10 && available.length > 0 ? `
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#d97706;font-weight:600">
      ⚠️ تنبيه: المخزون المتاح منخفض (${available.length} كود فقط). يرجى رفع أكواد جديدة قريباً.
    </div>` : ''}

    ${available.length === 0 ? `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#dc2626;font-weight:600">
      🚫 نفد المخزون! لن يتمكن العملاء من شراء هذا المنتج حتى يتم رفع أكواد جديدة.
    </div>` : ''}

    <div style="border:1px solid var(--glass-border);border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="background:var(--bg-secondary);padding:12px 16px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center">
        <span>📋 الأكواد المتاحة (${available.length})</span>
        ${available.length > 0 ? `<button class="btn btn-sm btn-danger" onclick="ph44_clearAvailable('${productId}')">🗑️ حذف الكل</button>` : ''}
      </div>
      <div style="max-height:180px;overflow-y:auto;padding:10px 14px">
        ${available.length ? available.slice(0,50).map((c,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--glass-border)">
            <span style="color:var(--text-muted);font-size:12px;min-width:28px">#${c.seq||i+1}</span>
            <span style="font-family:monospace;font-size:13px;flex:1;letter-spacing:.5px">${escHtml(c.code)}</span>
            <button style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:0 4px" onclick="ph44_deleteSingleCode('${c.id}','${productId}')" title="حذف">✕</button>
          </div>`).join('') + (available.length > 50 ? `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">... و ${available.length-50} كود آخر</div>` : '')
        : '<p style="text-align:center;color:var(--text-muted);padding:14px;margin:0">لا توجد أكواد متاحة</p>'}
      </div>
    </div>

    <div style="background:var(--bg-secondary);border-radius:14px;padding:18px">
      <div style="font-weight:700;margin-bottom:14px;font-size:14px">⬆️ رفع أكواد جديدة</div>
      
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="ph44-tab-btn active" id="ph44-tab-file" onclick="ph44_switchTab('file')">📄 ملف PDF/TXT</button>
        <button class="ph44-tab-btn" id="ph44-tab-paste" onclick="ph44_switchTab('paste')">📋 لصق نصي</button>
        <button class="ph44-tab-btn" id="ph44-tab-single" onclick="ph44_switchTab('single')">➕ كود واحد</button>
      </div>

      <div id="ph44-panel-file">
        <input type="file" class="form-control" id="ph44-file-input" accept=".pdf,.txt,.csv,.xlsx"
               onchange="ph44_handleFileUpload(this, '${productId}')">
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">يدعم: PDF (نص قابل للنسخ)، TXT، CSV — كل كود في سطر منفصل</div>
        <div id="ph44-extract-preview" style="margin-top:12px"></div>
      </div>

      <div id="ph44-panel-paste" style="display:none">
        <textarea class="form-control" id="ph44-paste-area" rows="6"
                  placeholder="الصق الأكواد هنا — كل كود في سطر منفصل&#10;مثال:&#10;XXXX-YYYY-1111&#10;XXXX-YYYY-2222&#10;XXXX-YYYY-3333"
                  style="font-family:monospace;font-size:13px;resize:vertical"></textarea>
        <button class="btn btn-primary btn-block" style="margin-top:10px"
                onclick="ph44_savePastedCodes('${productId}')">💾 حفظ الأكواد</button>
      </div>

      <div id="ph44-panel-single" style="display:none">
        <input class="form-control" id="ph44-single-code" placeholder="أدخل الكود الواحد هنا...">
        <button class="btn btn-primary btn-block" style="margin-top:10px"
                onclick="ph44_saveSingleCode('${productId}')">➕ إضافة الكود</button>
      </div>
    </div>
  `);
};

// ─── Tab Switching ──────────────────────────────────────
window.ph44_switchTab = function (tab) {
  ['file','paste','single'].forEach(t => {
    document.getElementById('ph44-panel-' + t).style.display = t === tab ? 'block' : 'none';
    const btn = document.getElementById('ph44-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
};

// ─── File Upload Handler ────────────────────────────────
window.ph44_handleFileUpload = async function (input, productId) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('ph44-extract-preview');
  if (preview) preview.innerHTML = '<div style="color:var(--text-muted);font-size:13px">⏳ جارٍ استخراج الأكواد...</div>';

  let rawText = '';
  try {
    if (file.name.endsWith('.pdf')) {
      rawText = await ph44_extractPdfText(file);
    } else {
      rawText = await file.text();
    }
  } catch(e) {
    if (preview) preview.innerHTML = '<div style="color:#ef4444;font-size:13px">❌ تعذّر قراءة الملف: ' + escHtml(e.message) + '</div>';
    return;
  }

  const codes = ph44_parseCodesFromText(rawText);
  if (!codes.length) {
    if (preview) preview.innerHTML = '<div style="color:#f59e0b;font-size:13px">⚠️ لم يُعثر على أكواد في الملف. تأكد أن الملف يحتوي على نصوص قابلة للنسخ.</div>';
    return;
  }

  // Store pending codes
  window.__ph44_pendingCodes = codes;
  if (preview) preview.innerHTML = `
    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:12px;margin-top:4px">
      <div style="font-weight:700;color:#10b981;margin-bottom:8px">✅ تم استخراج ${codes.length} كود</div>
      <div style="max-height:120px;overflow-y:auto;font-family:monospace;font-size:12px;color:var(--text-muted)">
        ${codes.slice(0,10).map(c => escHtml(c)).join('<br>')}
        ${codes.length > 10 ? `<br>... و ${codes.length - 10} أكواد أخرى` : ''}
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="ph44_saveExtractedCodes('${productId}')">
        💾 حفظ ${codes.length} كود في المخزون
      </button>
    </div>`;
};

// ─── Extract text from PDF using PDF.js ────────────────
window.ph44_extractPdfText = async function (file) {
  // Load pdf.js from CDN if not already loaded
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
};

// ─── Parse codes from raw text ─────────────────────────
window.ph44_parseCodesFromText = function (text) {
  const lines = text.split(/[\n\r]+/);
  const codes = [];
  const seen = new Set();

  lines.forEach(line => {
    const trimmed = line.trim()
      .replace(/^[\d]+[\.\)\-\s]+/, '') // remove leading numbers like "1. " or "1)"
      .trim();
    if (
      trimmed.length >= 4 &&
      trimmed.length <= 100 &&
      !seen.has(trimmed) &&
      /[A-Za-z0-9]/.test(trimmed) // must contain at least one alphanumeric
    ) {
      seen.add(trimmed);
      codes.push(trimmed);
    }
  });
  return codes;
};

// ─── Save extracted codes from file ────────────────────
window.ph44_saveExtractedCodes = async function (productId) {
  const codes = window.__ph44_pendingCodes;
  if (!codes || !codes.length) return;
  await ph44_uploadCodes(productId, codes);
  window.__ph44_pendingCodes = null;
};

// ─── Save pasted codes ──────────────────────────────────
window.ph44_savePastedCodes = async function (productId) {
  const text = document.getElementById('ph44-paste-area')?.value || '';
  const codes = ph44_parseCodesFromText(text);
  if (!codes.length) { toast('لم يُعثر على أكواد صالحة', 'error'); return; }
  await ph44_uploadCodes(productId, codes);
};

// ─── Save single code ───────────────────────────────────
window.ph44_saveSingleCode = async function (productId) {
  const code = document.getElementById('ph44-single-code')?.value.trim();
  if (!code) { toast('أدخل الكود أولاً', 'error'); return; }
  await ph44_uploadCodes(productId, [code]);
};

// ─── Core: upload codes batch to Firestore ─────────────
window.ph44_uploadCodes = async function (productId, codes) {
  showLoader(`جاري رفع ${codes.length} كود...`);
  try {
    const existing = (AppData.digitalCodes || []).filter(c => c.productId === productId);
    const existingSet = new Set(existing.map(c => c.code));
    const newCodes = codes.filter(c => !existingSet.has(c));

    if (!newCodes.length) {
      hideLoader();
      toast('جميع الأكواد موجودة بالفعل في المخزون', 'warning');
      return;
    }

    const startSeq = existing.length + 1;
    // Batch write using fsAdd
    for (let i = 0; i < newCodes.length; i++) {
      await fsAdd('digital_codes', {
        productId,
        code: newCodes[i],
        seq: startSeq + i,
        status: 'available',
        orderId: null,
        customerId: null,
        soldAt: null,
        createdAt: new Date().toISOString()
      });
    }

    // Reload data
    await ph44_reloadCodes();
    hideLoader();
    toast(`✅ تم رفع ${newCodes.length} كود بنجاح!`, 'success');
    ph44_showCodesModal(productId);
  } catch(e) {
    hideLoader();
    toast('خطأ أثناء الرفع: ' + e.message, 'error');
  }
};

// ─── Delete a single available code ────────────────────
window.ph44_deleteSingleCode = async function (codeId, productId) {
  if (!confirm('حذف هذا الكود من المخزون؟')) return;
  showLoader();
  try {
    await fsDelete('digital_codes', codeId);
    await ph44_reloadCodes();
    hideLoader();
    toast('تم حذف الكود', 'success');
    ph44_showCodesModal(productId);
  } catch(e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

// ─── Clear all available codes for a product ───────────
window.ph44_clearAvailable = async function (productId) {
  if (!confirm('حذف كل الأكواد المتاحة لهذا المنتج نهائياً؟')) return;
  const toDelete = (AppData.digitalCodes || []).filter(c => c.productId === productId && c.status === 'available');
  showLoader(`جاري حذف ${toDelete.length} كود...`);
  try {
    for (const c of toDelete) await fsDelete('digital_codes', c.id);
    await ph44_reloadCodes();
    hideLoader();
    toast('✅ تم حذف جميع الأكواد المتاحة', 'success');
    ph44_showCodesModal(productId);
  } catch(e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

// ─── Reload digital codes from Firestore ───────────────
window.ph44_reloadCodes = async function () {
  try {
    AppData.digitalCodes = await fsGetAll('digital_codes');
  } catch(e) { AppData.digitalCodes = []; }
};

// ─── Core: assign code when order is completed ─────────
window.ph44_assignCodeToOrder = async function (orderId) {
  const order = (AppData.orders || []).find(o => o.id === orderId);
  if (!order || !order.items) return null;

  // Check if order contains any digital product
  const products = AppData.storeProducts || [];
  let assignedCode = null;

  for (const item of order.items) {
    const baseId = (item.productId || '').split('_')[0];
    const product = products.find(p => p.id === baseId);
    if (!product || !product.isDigital) continue;

    // Find the next available code for this product
    const available = (AppData.digitalCodes || [])
      .filter(c => c.productId === baseId && c.status === 'available')
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));

    if (!available.length) {
      toast(`⚠️ نفد مخزون الأكواد للمنتج: ${product.name}`, 'warning');
      continue;
    }

    const codeDoc = available[0];
    try {
      // Mark code as sold
      await fsUpdate('digital_codes', codeDoc.id, {
        status: 'sold',
        orderId,
        customerId: order.userId || order.customerId || null,
        soldAt: new Date().toISOString()
      });

      // Attach code to order
      await fsUpdate('orders', orderId, {
        digitalCode: codeDoc.code,
        digitalCodeId: codeDoc.id,
        digitalProductName: product.name
      });

      // Update local cache
      const localCode = (AppData.digitalCodes || []).find(c => c.id === codeDoc.id);
      if (localCode) { localCode.status = 'sold'; localCode.orderId = orderId; }

      const localOrder = (AppData.orders || []).find(o => o.id === orderId);
      if (localOrder) {
        localOrder.digitalCode = codeDoc.code;
        localOrder.digitalProductName = product.name;
      }

      assignedCode = codeDoc.code;
      toast(`🔑 تم إرسال كود ${product.name} للعميل`, 'success');
    } catch(e) {
      toast('خطأ أثناء تعيين الكود: ' + e.message, 'error');
    }
  }
  return assignedCode;
};

// ─── Patch updateOrderStatus to auto-assign codes ──────
setTimeout(() => {
  const __origUOS = window.updateOrderStatus;
  if (typeof __origUOS === 'function' && !window.__ph44_patched_uos) {
    window.__ph44_patched_uos = true;
    window.updateOrderStatus = async function (orderId, status) {
      await __origUOS(orderId, status);
      if (status === 'completed' || status === 'accepted') {
        await ph44_assignCodeToOrder(orderId);
      }
    };
  }
}, 2500);

// ─── Inject 🔑 button in Admin Product Table ───────────
setTimeout(() => {
  const origRender = window.renderAdminSystem;
  if (typeof origRender === 'function' && !window.__ph44_injected) {
    window.__ph44_injected = true;
    window.renderAdminSystem = function () {
      let html = origRender.apply(this, arguments);
      // Inject after the 🏷️ tiers button
      html = html.replace(
        /(<button class="btn btn-sm" style="background:linear-gradient\(135deg,#8b5cf6,#7c3aed\);color:#fff" onclick="ph40_showTiersModal\('([^']+)'\)"[^>]*>🏷️<\/button>)/g,
        (full, btn, pid) => {
          const p = (AppData.storeProducts || []).find(x => x.id === pid);
          if (!p || !p.isDigital) return full;
          const avail = (AppData.digitalCodes || []).filter(c => c.productId === pid && c.status === 'available').length;
          return `${full}<button class="btn btn-sm" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff" onclick="ph44_showCodesModal('${pid}')" title="مخزون الأكواد الرقمية">🔑 ${avail}</button>`;
        }
      );
      return html;
    };
  }
}, 2600);

// ─── Initialize AppData.digitalCodes ───────────────────
if (typeof AppData !== 'undefined' && !AppData.digitalCodes) {
  AppData.digitalCodes = [];
}

// ─── Styles ────────────────────────────────────────────
(function () {
  if (window.__ph44_styles) return;
  window.__ph44_styles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ph44-tab-btn {
      padding: 7px 14px;
      border: 1px solid var(--glass-border);
      background: var(--bg-card);
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.2s;
      white-space: nowrap;
    }
    .ph44-tab-btn:hover { border-color: var(--primary); color: var(--primary); }
    .ph44-tab-btn.active {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 44] Digital Codes System loaded');
