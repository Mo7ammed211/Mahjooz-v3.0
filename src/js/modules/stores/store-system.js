// ═══════════════════════════════════════════════════════
//  محجوز — Phase 43: Store & Pharmacy System
//  Shopping Cart + Multi-store + Admin Management
// ═══════════════════════════════════════════════════════
'use strict';

// ───────────────────────────────────────────────────────
// SECTION 1 — Cart State & Core Functions
// ───────────────────────────────────────────────────────
if (!window.__ph43Cart) window.__ph43Cart = [];

window.ph43_getCart    = () => window.__ph43Cart;
window.ph43_setCart    = (c) => { window.__ph43Cart = c; ph43_updateCartBadge(); };
window.ph43_cartTotal  = () => window.__ph43Cart.reduce((s, i) => s + i.price * i.qty, 0);
window.ph43_cartCount  = () => window.__ph43Cart.reduce((s, i) => s + i.qty, 0);

window.ph43_updateCartBadge = function () {
  const badge = document.getElementById('ph43-cart-badge');
  const count = ph43_cartCount();
  if (!badge) return;
  const oldVal = badge.textContent;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
  
  if (count > 0 && String(count) !== String(oldVal)) {
    const btn = badge.closest('.ph43-cart-nav-btn');
    if (btn) {
      btn.classList.remove('cart-bump');
      void btn.offsetWidth; // trigger reflow
      btn.classList.add('cart-bump');
    }
  }
};

window.ph43_addToCart = function (productId, storeId, selectedTier = null) {
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }
  const store   = (AppData.stores || []).find(s => s.id === storeId);
  const product = (AppData.storeProducts || []).find(p => p.id === productId);
  if (!product || !store) return;

  const cartItemKey = selectedTier ? `${productId}_${selectedTier.name}` : productId;
  const displayName = selectedTier ? `${product.name} (${selectedTier.name})` : product.name;
  const finalPrice  = selectedTier ? selectedTier.price : product.price;

  const cart     = ph43_getCart();
  const existing = cart.find(i => i.productId === cartItemKey);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: cartItemKey,
      storeId,
      storeName: store.name,
      storeIcon: store.icon || '🏪',
      name: displayName,
      price: finalPrice,
      qty: 1,
      image: product.imageBase64 || null,
      tierName: selectedTier ? selectedTier.name : null
    });
  }
  ph43_setCart(cart);
  toast(`✅ أُضيف "${displayName}" للسلة`, 'success');
  ph43_refreshProductBtn(productId);
};

window.ph43_removeFromCart = function (productId) {
  ph43_setCart(ph43_getCart().filter(i => i.productId !== productId));
  ph43_renderCartBody();
  
  // Refresh base product button badge after removal
  const baseId = productId.split('_')[0];
  ph43_refreshProductBtn(baseId);
};

window.ph43_changeQty = function (productId, delta) {
  const cart = ph43_getCart();
  const item  = cart.find(i => i.productId === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  ph43_setCart(cart);
  ph43_renderCartBody();
  
  const baseId = productId.split('_')[0];
  ph43_refreshProductBtn(baseId);
};

window.ph43_clearCart = function () {
  if (!confirm('هل تريد إفراغ السلة كاملاً؟')) return;
  const oldCart = ph43_getCart();
  ph43_setCart([]);
  closeModal();
  
  // Refresh all buttons
  oldCart.forEach(item => {
    const baseId = item.productId.split('_')[0];
    ph43_refreshProductBtn(baseId);
  });
};

window.ph43_refreshProductBtn = function (productId) {
  document.querySelectorAll(`[data-ph43-pid="${productId}"]`).forEach(btn => {
    const items = ph43_getCart().filter(i => i.productId === productId || i.productId.startsWith(productId + '_'));
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const product = (AppData.storeProducts || []).find(p => p.id === productId);
    const hasTiers = product && product.tiers && product.tiers.length > 0;
    
    if (totalQty > 0) {
      btn.innerHTML = `🛒 <span>${totalQty} في السلة</span>`;
      btn.classList.add('in-cart');
    } else {
      btn.innerHTML = `🛒 <span>${hasTiers ? 'اختر الفئة' : 'أضف للسلة'}</span>`;
      btn.classList.remove('in-cart');
    }
  });
};

// ───────────────────────────────────────────────────────
// SECTION 2 — Cart Modal
// ───────────────────────────────────────────────────────
window.ph43_showCart = function () {
  const cart = ph43_getCart();
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🛒 سلة التسوق</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div id="ph43-cart-body" style="max-height:60vh;overflow-y:auto;padding-right:2px"></div>
    <div id="ph43-cart-actions" style="margin-top:16px"></div>
  `);
  ph43_renderCartBody();
};

function ph43_renderCartBody() {
  const cart  = ph43_getCart();
  const body  = document.getElementById('ph43-cart-body');
  const acts  = document.getElementById('ph43-cart-actions');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:64px;margin-bottom:16px">🛒</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text-main)">السلة فارغة</div>
        <div style="font-size:14px">أضف منتجات من متاجرنا المتنوعة</div>
      </div>`;
    if (acts) acts.innerHTML = '';
    return;
  }

  // Group by store
  const byStore = {};
  cart.forEach(item => {
    if (!byStore[item.storeId]) byStore[item.storeId] = { name: item.storeName, icon: item.storeIcon, items: [] };
    byStore[item.storeId].items.push(item);
  });

  body.innerHTML = Object.entries(byStore).map(([, g]) => `
    <div style="margin-bottom:14px;border-radius:16px;border:1px solid var(--glass-border);overflow:hidden">
      <div style="background:var(--bg-secondary);padding:10px 16px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px">
        <span style="font-size:20px">${g.icon}</span>
        <span>${escHtml(g.name)}</span>
        <span style="margin-inline-start:auto;font-size:12px;color:var(--text-muted)">${g.items.reduce((s,i)=>s+i.qty,0)} وحدة</span>
      </div>
      ${g.items.map(item => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--glass-border)">
        ${item.image
          ? `<img src="${item.image}" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0">`
          : `<div style="width:52px;height:52px;border-radius:12px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📦</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</div>
          <div style="color:var(--primary);font-weight:700;font-size:13px;margin-top:3px">${(item.price * item.qty).toLocaleString('ar-SA')} ريال</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="ph43_changeQty('${item.productId}',-1)" style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--glass-border);background:var(--bg-card);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--text-main)">−</button>
          <span style="font-weight:800;min-width:22px;text-align:center;font-size:15px">${item.qty}</span>
          <button onclick="ph43_changeQty('${item.productId}',1)" style="width:30px;height:30px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
          <button onclick="ph43_removeFromCart('${item.productId}')" style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--rose);background:transparent;color:var(--rose);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;margin-inline-start:4px">✕</button>
        </div>
      </div>`).join('')}
    </div>
  `).join('') + `
  <div style="background:linear-gradient(135deg,rgba(139,92,246,0.06),rgba(139,92,246,0.02));border-radius:16px;border:1px solid var(--glass-border);padding:16px">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <span style="color:var(--text-secondary)">المجموع الفرعي</span>
      <span style="font-weight:700">${ph43_cartTotal().toLocaleString('ar-SA')} ريال</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
      <span style="color:var(--text-secondary)">رسوم التوصيل</span>
      <span style="font-size:12px;color:var(--text-muted)">تُحسب عند إدخال عنوان التوصيل</span>
    </div>
    <div style="height:1px;background:var(--glass-border)"></div>
    <div style="display:flex;justify-content:space-between;margin-top:10px">
      <span style="font-weight:800;font-size:17px">المجموع الفرعي</span>
      <span style="font-weight:800;font-size:22px;background:var(--gradient-main);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${ph43_cartTotal().toLocaleString('ar-SA')} ريال</span>
    </div>
  </div>`;


  if (acts) acts.innerHTML = `
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary" onclick="ph43_clearCart()" style="flex-shrink:0">🗑️ إفراغ</button>
      <button class="btn btn-primary btn-block btn-lg" onclick="ph43_proceedCheckout()">💳 متابعة الدفع</button>
    </div>`;
}

// ───────────────────────────────────────────────────────
// SECTION 3 — Checkout Flow
// ───────────────────────────────────────────────────────
window.ph43_proceedCheckout = async function () {
  const cart = ph43_getCart();
  if (!cart.length) { toast('السلة فارغة', 'error'); return; }
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }
  if (typeof checkAccountActive === 'function' && !checkAccountActive()) return;
  if (typeof checkMandatoryVerification === 'function' && !checkMandatoryVerification()) return;

  let savedAddresses = [];
  try { if (typeof ph41_loadAddresses === 'function') savedAddresses = await ph41_loadAddresses(); } catch (e) {}
  const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 إتمام الطلب</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02));border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
      <div style="font-size:36px">🛍️</div>
      <div>
        <div style="font-size:13px;color:var(--text-muted)">${cart.reduce((s,i)=>s+i.qty,0)} منتج من ${[...new Set(cart.map(i=>i.storeName))].length} متجر</div>
        <div style="font-weight:800;font-size:24px;color:var(--primary)">${ph43_cartTotal().toLocaleString('ar-SA')} ريال</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">+ رسوم التوصيل تُحسب بعد إدخال العنوان</div>
      </div>
    </div>

    ${savedAddresses.length && typeof ph41_renderAddressSelector === 'function' ? ph41_renderAddressSelector(savedAddresses) : ''}

    <div class="form-group">
      <label class="form-label">📍 عنوان التوصيل${savedAddresses.length ? ' (أو أدخل جديداً)' : ''}</label>
      <input class="form-control" id="cart-addr" placeholder="المدينة، الحي، الشارع، رقم المبنى..."
             value="${defaultAddr ? escAttr(defaultAddr.address) : ''}"
             style="${defaultAddr ? 'display:none' : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">💬 ملاحظات للتوصيل</label>
      <textarea class="form-control" id="cart-note" placeholder="أي تعليمات أو ملاحظات..." style="resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">💳 طريقة الدفع</label>
      <div class="bk-payment-grid">
        <button class="bk-pay-btn active" id="bk-pay-wallet" onclick="bkSelectPayment('wallet')"><div style="font-weight:700">المحفظة</div><div style="font-size:11px;color:var(--text-muted)" id="checkout-wallet-bal">جاري الجلب...</div></button>
        <button class="bk-pay-btn" id="bk-pay-cod" onclick="bkSelectPayment('cod')"><div style="font-weight:700">عند الاستلام</div><div style="font-size:11px;color:var(--text-muted)">+5 ريال</div></button>
        <button class="bk-pay-btn" id="bk-pay-bank" onclick="bkSelectPayment('bank_transfer')"><div style="font-weight:700">تحويل بنكي</div><div style="font-size:11px;color:var(--text-muted)">إيداع مسبق</div></button>
      </div>
      
      <div id="bk-bank-info" style="display:none; margin-top:16px; padding:12px; background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); border-radius:8px;">
        <div style="font-weight:700; margin-bottom:8px; color:var(--primary)">يرجى التحويل إلى أحد الحسابات التالية:</div>
        ${(AppData.bankAccounts||[]).filter(b=>b.active!==false).map(b => `<div style="font-size:13px; margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--border)">🏦 <strong>${b.bankName}</strong><br><span style="font-family:monospace; font-size:14px">${b.accountNumber}</span><br><span style="color:var(--text-muted)">اسم المستفيد: ${b.ownerName}</span></div>`).join('')}
        <div style="font-size:12px; color:var(--text-muted); margin-top:8px">سيتم إكمال الطلب، يرجى إرفاق صورة الإيصال لاحقاً في تفاصيل الطلب من صفحة طلباتي لكي نتمكن من اعتماد الطلب.</div>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:8px" onclick="ph43_confirmOrder()">✅ تأكيد الطلب</button>
  `);
  State.selectedPaymentMethod = 'wallet';
  
  // Fetch wallet balance async
  if (u && u.uid) {
    getBalance(u.uid).then(bal => {
      const el = document.getElementById('checkout-wallet-bal');
      if (el) el.innerText = bal + ' ريال متاح';
    }).catch(e => {
      const el = document.getElementById('checkout-wallet-bal');
      if (el) el.innerText = 'الرصيد غير متاح';
    });
  }
};

window.ph43_confirmOrder = async function () {
  const cart     = ph43_getCart();
  const addrEl   = document.getElementById('cart-addr');
  const addr     = addrEl?.value.trim() || '';
  const note     = document.getElementById('cart-note')?.value.trim() || '';
  if (!addr) { toast('أدخل عنوان التوصيل', 'error'); return; }

  const u          = State.currentUser;
  const payMethod  = State.selectedPaymentMethod || 'wallet';

  // ─── حساب رسوم التوصيل بناءً على موقع المتجر وعنوان العميل ─────
  let deliveryFee = 0;
  let totalDelivery = 0;
  if (typeof dp_calculateFee === 'function') {
    // حساب لكل متجر على حدة
    const uniqueStores = [...new Set(cart.map(i => i.storeId))];
    for (const sid of uniqueStores) {
      const storeObj = (AppData.stores || []).find(s => s.id === sid);
      const fromArea = storeObj?.area || storeObj?.location || storeObj?.address || '';
      const toArea   = addr || u?.address || u?.area || '';
      if (fromArea && toArea) {
        const result = dp_calculateFee(fromArea, toArea);
        totalDelivery += result.found ? result.fee : (AppData.platformSettings?.deliveryFee || 0);
        if (!result.found) toast(`⚠️ سعر التوصيل لـ "${storeObj?.name || sid}" غير مسجّل`, 'warning');
      } else {
        totalDelivery += AppData.platformSettings?.deliveryFee || 0;
      }
    }
    deliveryFee = totalDelivery;
  } else {
    deliveryFee = AppData.platformSettings?.deliveryFee || 0;
  }

  const codFee = payMethod === 'cod' ? 5 : 0;
  const total  = ph43_cartTotal() + deliveryFee + codFee;

  if (payMethod === 'wallet') {
    const bal = await getBalance(u.uid);
    if (bal < total) {
      toast(`رصيدك (${bal} ريال) غير كافٍ. المطلوب: ${total} ريال`, 'error');
      closeModal(); navigate('wallet'); return;
    }
  }

  showLoader('جاري تأكيد الطلب...');
  try {
    const orderId    = await generateOrderId();
    const storeNames = [...new Set(cart.map(i => i.storeName))].join(' & ');
    const matchedAddr = (window.__ph41_addresses || []).find(a => a.address === addr);
    const housePics = matchedAddr ? (matchedAddr.pics || []) : (u.housePics || []);

    await fsAdd('orders', {
      orderId, type: 'store_order',
      items: cart.map(i => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price, storeId: i.storeId, storeName: i.storeName })),
      svcName: `طلب من: ${storeNames}`,
      svcIcon: '🛒',
      servicePrice: ph43_cartTotal(),
      deliveryFee, codFee, total,
      paymentMethod: payMethod,
      customerId: u.uid, customerName: u.name, customerAddr: addr,
      vendorId: null, vendorName: storeNames,
      driverId: null, driverName: null,
      note, status: 'pending',
      housePics: housePics
    });
    if (payMethod === 'wallet') {
      await deductWallet(u.uid, total, `طلب متاجر: ${orderId}`, orderId);
    }
    ph43_setCart([]);
    hideLoader(); closeModal();
    toast(`✅ تم الطلب! رقم العملية: ${orderId}`, 'success');
    await navigate('myorders');
  } catch (e) {
    hideLoader(); toast('حدث خطأ: ' + (e.message || e), 'error');
  }
};

// ───────────────────────────────────────────────────────
// SECTION 4 — Customer: Store Listing Page
// ───────────────────────────────────────────────────────
window.ph43_renderStoresList = function () {
  // Support native routing / phone back button for digital stores
  if (State.params?.digital === 'cats' && typeof ph45_renderDigitalStorefront === 'function') {
    return ph45_renderDigitalStorefront();
  }
  if (State.params?.digital === 'cat' && State.params?.catId && typeof ph45_renderDigitalCat === 'function') {
    return ph45_renderDigitalCat(State.params.catId);
  }
  if (State.params?.digital === 'store' && State.params?.storeId && typeof ph45_renderDigitalStore === 'function') {
    return ph45_renderDigitalStore(State.params.storeId);
  }

  const _regionId = State.currentUser?.regionId;
  const filter = State.activeSidebarFilter || 'all';

  let stores = (AppData.stores || []).filter(s => {
    if (s.active === false) return false;
    if (_regionId && s.regionId && s.regionId !== _regionId) return false;
    return true;
  });

  if (filter === 'nearby') {
    // Leave stores empty when selecting nearby as requested by the user
    stores = [];
  } else if (filter === 'new') {
    stores = stores.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  } else if (filter === 'favorites') {
    const favs = typeof ph18_getFavorites === 'function' ? ph18_getFavorites() : [];
    stores = stores.filter(s => favs.includes(s.id));
  }

  const view = State.ph43StoreView || 'grid';

  return `<div id="app-content">
    <div class="page-header" style="padding-bottom:12px">
      <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="margin:0">🏪 المتاجر والصيدليات</h1>
          <p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">${stores.length} متجر متاح</p>
        </div>
        <!-- أزرار طريقة العرض -->
        <div class="ph43-view-toggle">
          <button class="ph43-vtbtn${view==='grid'?' active':''}" onclick="State.ph43StoreView='grid';render()" title="مربعات">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>
            <span>مربعات</span>
          </button>
          <button class="ph43-vtbtn${view==='list'?' active':''}" onclick="State.ph43StoreView='list';render()" title="قائمة">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1.5"/><rect x="1" y="6.5" width="14" height="3" rx="1.5"/><rect x="1" y="11" width="14" height="3" rx="1.5"/></svg>
            <span>قائمة</span>
          </button>
          <button class="ph43-vtbtn${view==='slideshow'?' active':''}" onclick="State.ph43StoreView='slideshow';render()" title="شرائح">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="9" rx="2"/><rect x="4" y="13" width="8" height="2" rx="1"/></svg>
            <span>شرائح</span>
          </button>
        </div>
      </div>
    </div>
    <div class="sec-layout">
      ${typeof renderSectionSidebar === 'function' ? renderSectionSidebar() : ''}
      <main class="sec-main">
        <div class="search-wrap" style="margin-bottom:20px;">
          <div class="search-box" style="padding:0; border:none; background:transparent">
            <input class="search-input" id="stores-search" oninput="ph43_filterStores()" placeholder="ابحث عن متجر..." style="border-radius:12px">
            <span class="search-icon" style="right:16px; left:auto">🔍</span>
          </div>
        </div>

        <!-- ⚡ بطاقة النظام الرقمي ⚡ -->
        ${(AppData.digitalStoreCats && AppData.digitalStoreCats.length > 0) ? `
        <div onclick="navigate('stores', { digital: 'cats' })" style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(99,102,241,0.04));border:1px solid var(--glass-border);border-radius:16px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.2s" class="hover-scale">
          <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--primary),#c4b5fd);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;box-shadow:0 6px 16px rgba(139,92,246,0.3);flex-shrink:0">⚡</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:15px;margin-bottom:2px">الشحن والمنتجات الرقمية</div>
            <div style="font-size:12px;color:var(--text-secondary)">رصيد · كروت شبكات · تسديد · وأكثر</div>
          </div>
          <div style="color:var(--primary);font-size:18px">←</div>
        </div>` : ''}

        ${stores.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🏪</div>
          <div class="empty-title">${filter==='nearby'?'المتاجر لا تدعم خاصية الموقع حالياً':'لا توجد متاجر متاحة'}</div>
          <div class="empty-sub">${filter==='nearby'?'سيتم تفعيلها في التحديثات القادمة':'ترقبوا إضافة المزيد قريباً'}</div>
        </div>` :
        view === 'grid' ? `<div class="ph43-stores-grid" id="stores-grid">${stores.map(s=>ph43_renderStoreCard(s)).join('')}</div>` :
        view === 'list' ? `<div class="ph43-stores-list" id="stores-grid">${stores.map(s=>ph43_renderStoreListItem(s)).join('')}</div>` :
        ph43_renderSlideshowView(stores)
        }
      </main>
    </div>
  </div>`;
};

window.ph43_filterStores = function () {
  const q = document.getElementById('stores-search')?.value.toLowerCase() || '';
  document.querySelectorAll('.ph43-store-card, .ph43-store-list-item, .ph43-slide-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

function ph43_renderStoreListItem(s) {
  const prodCount = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.active!==false).length;
  return `
  <div class="ph43-store-list-item" onclick="navigate('store',{storeId:'${s.id}'})">
    <div class="ph43-list-logo">
      ${s.logoBase64 ? `<img src="${s.logoBase64}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : `<span style="font-size:26px">${s.icon||'🏪'}</span>`}
    </div>
    <div class="ph43-list-info">
      <div class="ph43-list-name">${escHtml(s.name)}</div>
      ${s.desc ? `<div class="ph43-list-desc">${escHtml(s.desc.length>65?s.desc.substring(0,65)+'…':s.desc)}</div>` : ''}
      <div class="ph43-list-meta">
        <span>📦 ${prodCount} منتج</span>
        ${s.deliveryTime ? `<span>🚗 ${escHtml(s.deliveryTime)}</span>` : ''}
        ${s.active===false ? `<span style="color:#ef4444">⏸️ مغلق</span>` : '<span style="color:#10b981">✅ مفتوح</span>'}
      </div>
    </div>
    <div class="ph43-list-arrow">←</div>
  </div>`;
}

function ph43_renderSlideshowView(stores) {
  if (!stores.length) return `<div class="empty-state"><div class="empty-icon">🏪</div><div class="empty-title">لا توجد متاجر</div></div>`;
  return `<div class="ph43-slideshow-view">${stores.map(s => {
    const cats = (AppData.storeCats||[]).filter(c=>c.storeId===s.id).sort((a,b)=>(a.order||0)-(b.order||0));
    const prodCount = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.active!==false).length;
    return `
    <div class="ph43-slide-card">
      <div class="ph43-slide-hero" onclick="navigate('store',{storeId:'${s.id}'})">
        ${s.bannerBase64
          ? `<img src="${s.bannerBase64}" class="ph43-slide-banner-img" alt="">`
          : `<div class="ph43-slide-banner-ph">${s.icon||'🏪'}</div>`}
        <div class="ph43-slide-overlay">
          <div class="ph43-slide-avatar">${s.logoBase64?`<img src="${s.logoBase64}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(s.icon||'🏪')}</div>
          <div style="flex:1;min-width:0">
            <div class="ph43-slide-name">${escHtml(s.name)}</div>
            ${s.desc ? `<div class="ph43-slide-subdesc">${escHtml(s.desc.length>50?s.desc.substring(0,50)+'…':s.desc)}</div>` : ''}
          </div>
          <button class="ph43-slide-showall-btn" onclick="event.stopPropagation();navigate('store',{storeId:'${s.id}'})">
            عرض الكل <span style="font-size:11px;opacity:.8">(${prodCount})</span> ←
          </button>
        </div>
      </div>
      ${cats.length ? `
      <div class="ph43-slide-cats-row">
        <div class="ph43-slide-cats-label">الأقسام</div>
        <div class="ph43-slide-cats-scroll">
          ${cats.map(c=>{
            const cnt = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.catId===c.id&&p.active!==false).length;
            return `<button class="ph43-slide-chip" onclick="State.storeActiveCat='${c.id}';navigate('store',{storeId:'${s.id}'})">
              <span>${c.icon||'📦'}</span>
              <span>${escHtml(c.name)}</span>
              <span class="ph43-chip-cnt">${cnt}</span>
            </button>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function ph43_renderStoreCard(s) {
  const prodCount = (AppData.storeProducts || []).filter(p => p.storeId === s.id && p.active !== false).length;
  return `
  <div class="ph43-store-card" onclick="navigate('store',{storeId:'${s.id}'})">
    <div class="ph43-store-card-header">
      ${s.bannerBase64
        ? `<img src="${s.bannerBase64}" class="ph43-store-banner" alt="">`
        : `<div class="ph43-store-banner-placeholder">${s.icon || '🏪'}</div>`}
      <div class="ph43-store-card-avatar">
        ${s.logoBase64 ? `<img src="${s.logoBase64}" alt="">` : (s.icon || '🏪')}
      </div>
    </div>
    <div class="ph43-store-card-body">
      <div class="ph43-store-name">${escHtml(s.name)}</div>
      ${s.desc ? `<div class="ph43-store-desc">${escHtml(s.desc)}</div>` : ''}
      <div class="ph43-store-meta">
        <span>📦 ${prodCount} منتج</span>
        ${s.deliveryTime ? `<span>🚗 ${escHtml(s.deliveryTime)}</span>` : '<span>🚗 توصيل متاح</span>'}
      </div>
      <button class="btn btn-primary ph43-store-btn">تسوق الآن ←</button>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────────────
// SECTION 5 — Customer: Individual Store Page
// ───────────────────────────────────────────────────────
window.ph43_renderStorePage = function () {
  const { storeId } = State.params;
  const store = (AppData.stores || []).find(s => s.id === storeId);
  if (!store) return `<div id="app-content"><div class="empty-state"><div class="empty-icon">🏪</div><div class="empty-title">المتجر غير موجود</div></div></div>`;

  const cats      = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeCat = State.storeActiveCat || null;
  let products    = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.active !== false);
  if (activeCat) products = products.filter(p => p.catId === activeCat);

  const cartCount = ph43_cartCount();
  const u         = State.currentUser;

  // Refresh cart badges after render
  setTimeout(() => {
    ph43_getCart().forEach(item => {
      const baseId = item.productId.split('_')[0];
      ph43_refreshProductBtn(baseId);
    });
    ph43_updateCartBadge();
  }, 80);

  return `<div id="app-content">
    <!-- Store Hero -->
    <div class="ph43-store-hero">
      ${store.bannerBase64
        ? `<img src="${store.bannerBase64}" class="ph43-store-hero-img" alt="">`
        : `<div class="ph43-store-hero-placeholder">${store.icon || '🏪'}</div>`}
      <div class="ph43-store-hero-info" style="display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; text-align:center; padding:24px 20px;">
        <button class="back-btn" style="position:absolute; right:20px; top:20px; margin:0; padding:6px 12px; font-size:12px;" onclick="State.storeActiveCat=null;navigate('listing',{section:'stores'})">→ رجوع</button>
        
        <div class="ph43-store-hero-avatar" style="width:64px; height:64px; font-size:32px; margin-bottom:12px;">
          ${store.logoBase64 ? `<img src="${store.logoBase64}" alt="">` : (store.icon || '🏪')}
        </div>
        <div>
          <div class="ph43-store-hero-name" style="font-size:20px;">${escHtml(store.name)}</div>
          ${store.desc ? `<div class="ph43-store-hero-desc" style="font-size:14px; margin-top:6px; max-width:400px; margin-inline:auto;">${escHtml(store.desc)}</div>` : ''}
        </div>
        
        ${cartCount > 0 ? `
        <button class="ph43-cart-hero-btn" onclick="ph43_showCart()" style="position:absolute; left:20px; top:20px;">
          🛒 <strong>${cartCount}</strong> | ${(ph43_cartTotal()+15).toLocaleString('ar-SA')} ريال
        </button>` : ''}
      </div>
    </div>

    <!-- Sticky Cart Bar -->
    ${cartCount > 0 ? `
    <div class="ph43-sticky-cart" onclick="ph43_showCart()">
      <span>🛒 <strong>${cartCount}</strong> منتج في السلة</span>
      <span style="font-weight:800">${(ph43_cartTotal() + 15).toLocaleString('ar-SA')} ريال ←</span>
    </div>` : ''}

    <!-- Store Body -->
    <div class="ph43-store-layout">
      ${cats.length ? `
      <aside class="ph43-store-sidebar">
        <div class="ph43-sidebar-title">📂 الأقسام</div>
        <button class="ph43-sidebar-btn${!activeCat ? ' active' : ''}" onclick="State.storeActiveCat=null;render()">
          <span>🛍️</span>
          <span style="flex:1;text-align:right">الكل</span>
          <span class="ph43-sidebar-count">${(AppData.storeProducts || []).filter(p => p.storeId === storeId && p.active !== false).length}</span>
        </button>
        ${cats.map(c => {
          const cnt = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id && p.active !== false).length;
          return `<button class="ph43-sidebar-btn${activeCat === c.id ? ' active' : ''}" onclick="State.storeActiveCat='${c.id}';render()">
            <span>${c.icon || '📦'}</span>
            <span style="flex:1;text-align:right">${escHtml(c.name)}</span>
            <span class="ph43-sidebar-count">${cnt}</span>
          </button>`;
        }).join('')}
      </aside>` : ''}

      <main class="ph43-products-area">
        <div class="ph43-products-header">
          <div style="font-weight:700;font-size:16px">
            ${activeCat ? escHtml(cats.find(c => c.id === activeCat)?.name || 'المنتجات') : 'جميع المنتجات'}
            <span style="color:var(--text-muted);font-size:14px;font-weight:400;margin-inline-start:6px">(${products.length})</span>
          </div>
          <div class="search-wrap" style="margin:0; max-width:220px; width:100%">
            <div class="search-box" style="padding:0; border:none; background:transparent; position:relative">
              <input class="search-input" style="padding:8px 12px; padding-right:32px; font-size:13px; border-radius:10px" id="prod-search" oninput="ph43_filterProducts()" placeholder="ابحث في المنتجات...">
              <span class="search-icon" style="right:10px; font-size:16px; top:50%; transform:translateY(-50%)">🔍</span>
            </div>
          </div>
        </div>
        ${products.length ? `
        <div class="ph43-product-grid" id="ph43-prod-grid">
          ${products.map(p => ph43_renderProductCard(p, storeId, u)).join('')}
        </div>` : `
        <div class="empty-state" style="padding:60px 0">
          <div class="empty-icon">📦</div>
          <div class="empty-title">لا توجد منتجات ${activeCat ? 'في هذا القسم' : ''}</div>
        </div>`}
      </main>
    </div>
  </div>`;
};

function ph43_renderProductCard(p, storeId, u) {
  const hasTiers = p.tiers && p.tiers.length > 0;
  const cartItems = ph43_getCart().filter(i => i.productId === p.id || i.productId.startsWith(p.id + '_'));
  const inCartQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  
  let priceHtml = '';
  if (hasTiers) {
    const minPrice = Math.min(...p.tiers.map(t => t.price || 0));
    priceHtml = `<span style="font-size:11px;font-weight:600;color:var(--text-muted)">يبدأ من </span>${minPrice.toLocaleString('ar-SA')} <span style="font-size:11px;font-weight:600;color:var(--text-muted)">ريال</span>`;
  } else {
    priceHtml = `${(p.price || 0).toLocaleString('ar-SA')} <span style="font-size:11px;font-weight:600;color:var(--text-muted)">ريال</span>`;
  }

  let btnHtml = '';
  if (u?.role === 'customer') {
    if (hasTiers) {
      btnHtml = `<button class="ph43-add-cart-btn${inCartQty > 0 ? ' in-cart' : ''}" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9)" onclick="ph43_showProductDetails('${p.id}','${storeId}')">
        🛒 <span>${inCartQty > 0 ? `${inCartQty} في السلة` : 'اختر الفئة'}</span>
      </button>`;
    } else {
      btnHtml = `<button class="ph43-add-cart-btn${inCartQty > 0 ? ' in-cart' : ''}" data-ph43-pid="${p.id}" onclick="ph43_addToCart('${p.id}','${storeId}')">
        🛒 <span>${inCartQty > 0 ? `${inCartQty} في السلة` : 'أضف للسلة'}</span>
      </button>`;
    }
  } else if (u?.role === 'guest') {
    btnHtml = `<button class="ph43-add-cart-btn" onclick="navigate('login')">سجل للشراء</button>`;
  }

  const waNumStore = (AppData.platformSettings?.whatsappNumber || '').replace(/\D/g,'');
  const waUrlStore = waNumStore
    ? `https://wa.me/${waNumStore}?text=${encodeURIComponent('أهلاً، أريد الاستفسار عن المنتج: ' + p.name)}`
    : '';

  return `
  <div class="ph43-product-card">
    <div onclick="ph43_showProductDetails('${p.id}', '${storeId}')" style="cursor:pointer">
      ${p.imageBase64
        ? `<img src="${p.imageBase64}" class="ph43-product-img" alt="${escAttr(p.name)}">`
        : `<div class="ph43-product-img-placeholder">📦</div>`}
      <div class="ph43-product-body" style="padding-bottom:8px">
        <div class="ph43-product-name">${escHtml(p.name)}</div>
        ${p.sku ? `<div style="display:inline-block;font-family:monospace;font-size:10px;font-weight:700;background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:4px;padding:1px 5px;margin-top:3px;margin-bottom:3px;letter-spacing:0.5px;">#${escHtml(p.sku)}</div>` : ''}
        ${p.desc ? `<div class="ph43-product-desc">${escHtml(p.desc)}</div>` : ''}
        ${p.unit ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escHtml(p.unit)}</div>` : ''}
      </div>
    </div>
    <div class="ph43-product-footer" style="padding: 0 12px 12px 12px;">
      <div class="ph43-product-price">${priceHtml}</div>
      ${btnHtml}
    </div>
    ${waUrlStore ? `<div style="padding:0 12px 12px">
      <a class="btn-wa-inquiry btn-wa-inquiry--full" href="${waUrlStore}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span>استفسر عن المنتج</span>
      </a>
    </div>` : ''}
  </div>`;
}

window.ph43_filterProducts = function () {
  const q = document.getElementById('prod-search')?.value.toLowerCase() || '';
  document.querySelectorAll('.ph43-product-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

window.ph43_showProductDetails = function(pid, storeId) {
  const p = (AppData.storeProducts || []).find(x => x.id === pid);
  if (!p) return;
  const u = State.currentUser;
  const hasTiers = p.tiers && p.tiers.length > 0;
  
  if (hasTiers) {
    window.__ph43_selectedProductTier = { idx: 0, price: p.tiers[0].price, name: p.tiers[0].name };
  } else {
    window.__ph43_selectedProductTier = null;
  }

  const priceBlock = hasTiers ? '' : `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(59,130,246,0.05); padding:16px; border-radius:12px; margin-bottom:20px;">
      <div>
        <div style="font-size:13px; color:var(--text-muted)">السعر</div>
        <div style="font-size:24px; font-weight:800; color:var(--primary)">${(p.price || 0).toLocaleString('ar-SA')} <span style="font-size:14px">ريال</span></div>
      </div>
      ${p.unit ? `<div><div style="font-size:13px; color:var(--text-muted)">الوحدة</div><div style="font-size:16px; font-weight:600">${escHtml(p.unit)}</div></div>` : ''}
    </div>`;

  const selectorBlock = hasTiers ? ph43_renderProductTierSelector(p) : '';
  const cartItem = ph43_getCart().find(i => i.productId === p.id);

  let btnActionStr = '';
  if (hasTiers) {
    btnActionStr = `ph43_addToCart('${p.id}','${storeId}', window.__ph43_selectedProductTier); closeModal()`;
  } else {
    btnActionStr = `ph43_addToCart('${p.id}','${storeId}'); closeModal()`;
  }

  let btnLabel = hasTiers ? '🛒 أضف الفئة المختارة للسلة' : (cartItem ? '🛒 إضافة المزيد للكمية الموجودة بالسلة' : '🛒 أضف للسلة');

  openModal(`
    <div style="text-align:center; margin-bottom:16px">
      ${p.imageBase64 
        ? `<img src="${p.imageBase64}" style="max-width:100%; max-height:250px; border-radius:12px; object-fit:contain; background:#f9fafb; padding:8px;">`
        : `<div style="font-size:64px; padding:32px; background:#f3f4f6; border-radius:12px; width:100px; height:100px; margin:0 auto; display:flex; align-items:center; justify-content:center">📦</div>`}
    </div>
    <div style="font-size:22px; font-weight:800; margin-bottom:6px; text-align:right; display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end">
      <span>${escHtml(p.name)}</span>
      ${p.sku ? `<span style="font-family:monospace;font-size:13px;font-weight:700;background:rgba(139,92,246,0.12);color:#8b5cf6;border:1px solid rgba(139,92,246,0.25);border-radius:6px;padding:3px 8px;letter-spacing:0.5px;">#${escHtml(p.sku)}</span>` : ''}
    </div>
    ${p.desc ? `<div style="font-size:15px; line-height:1.6; color:var(--text-secondary); margin-bottom:16px; white-space:pre-wrap; text-align:right">${escHtml(p.desc)}</div>` : ''}
    
    ${priceBlock}
    ${selectorBlock}
    
    ${u?.role === 'customer'
      ? `<button class="btn btn-primary btn-block btn-lg" style="display:flex; justify-content:center; gap:8px" onclick="${btnActionStr}">
           <span>${btnLabel}</span>
         </button>`
      : u?.role === 'guest'
      ? `<button class="btn btn-primary btn-block btn-lg" onclick="closeModal(); navigate('login')">سجل للشراء</button>`
      : ''}
  `);
};

// ───────────────────────────────────────────────────────
// SECTION 6 — Admin: Store Management
// ───────────────────────────────────────────────────────
window.ph43_renderAdminStores = function () {
  if (State.adminStoreView) return ph43_renderAdminStoreDetail(State.adminStoreView);

  const stores = AppData.stores || [];
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <h2 style="margin:0">🏪 إدارة المتاجر</h2>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-stores-search" placeholder="🔍 ابحث عن متجر..." oninput="ph43_filterAdminStores()" style="width:240px">
      <button class="btn btn-primary" onclick="ph43_showAddStoreModal()">➕ إضافة متجر</button>
    </div>
  </div>
  ${stores.length ? `
  <div class="ph43-admin-store-grid">
    ${stores.map(s => {
      const prodCount = (AppData.storeProducts || []).filter(p => p.storeId === s.id).length;
      const catCount  = (AppData.storeCats || []).filter(c => c.storeId === s.id).length;
      return `
      <div class="ph43-admin-store-card">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
          <div style="font-size:40px;flex-shrink:0">${s.icon || '🏪'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:16px;margin-bottom:4px">${escHtml(s.name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">👤 ${escHtml(s.vendorName || '—')}</div>
            ${s.desc ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(s.desc)}</div>` : ''}
          </div>
          <span class="badge ${s.active !== false ? 'badge-teal' : 'badge-rose'}">${s.active !== false ? '✅ نشط' : '⏸️ معطّل'}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted);margin-bottom:14px;padding:10px;background:var(--bg-secondary);border-radius:10px">
          <span>📦 ${prodCount} منتج</span>
          <span>📂 ${catCount} قسم</span>
          <span>${s.regionId ? '📍 منطقة محددة' : '🌍 جميع المناطق'}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="State.adminStoreView='${s.id}';State.adminStoreCat=null;render()">⚙️ إدارة المنتجات</button>
          <button class="btn btn-sm btn-secondary" onclick="ph43_showEditStoreModal('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteStore('${s.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : `
  <div class="empty-state">
    <div class="empty-icon">🏪</div>
    <div class="empty-title">لا توجد متاجر بعد</div>
    <div class="empty-sub">أضف أول متجر لبدء عرض المنتجات</div>
    <button class="btn btn-primary" style="margin-top:20px" onclick="ph43_showAddStoreModal()">➕ إضافة متجر</button>
  </div>`}`;
};

// ─── Store Detail (categories + products) ─────────────
function ph43_renderAdminStoreDetail(storeId) {
  const store = (AppData.stores || []).find(s => s.id === storeId);
  if (!store) return '<div class="empty-state"><div class="empty-title">المتجر غير موجود</div></div>';

  const cats      = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeCat = State.adminStoreCat || null;
  const products  = (AppData.storeProducts || []).filter(p => p.storeId === storeId && (!activeCat || p.catId === activeCat));

  return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <button class="btn btn-secondary btn-sm" onclick="State.adminStoreView=null;State.adminStoreCat=null;State.adminSearch='';render()">← رجوع للمتاجر</button>
    <span style="font-size:22px">${store.icon || '🏪'}</span>
    <h2 style="margin:0;font-size:20px">${escHtml(store.name)}</h2>
    <div style="display:flex;gap:12px;margin-inline-start:auto;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-prods-search" placeholder="🔍 ابحث عن منتج..." oninput="ph43_filterAdminProducts()" style="width:200px">
      <button class="btn btn-secondary btn-sm" onclick="ph43_showManageCatsModal('${storeId}')">📂 إدارة الأقسام</button>
      <button class="btn btn-primary btn-sm" onclick="ph43_showAddProductModal('${storeId}')">➕ إضافة منتج</button>
    </div>
  </div>

  <div style="display:flex;gap:20px;align-items:flex-start">
    <div style="width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;padding:0 4px">الأقسام</div>
      <button class="au-sidebar-btn${!activeCat ? ' active' : ''}" onclick="State.adminStoreCat=null;render()">
        <span>🛍️</span><span style="flex:1">الكل</span>
        <span class="au-sidebar-count">${(AppData.storeProducts || []).filter(p => p.storeId === storeId).length}</span>
      </button>
      ${cats.map(c => {
        const cnt = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id).length;
        return `<button class="au-sidebar-btn${activeCat === c.id ? ' active' : ''}" onclick="State.adminStoreCat='${c.id}';render()">
          <span>${c.icon || '📦'}</span>
          <span style="flex:1;text-align:right">${escHtml(c.name)}</span>
          <span class="au-sidebar-count">${cnt}</span>
        </button>`;
      }).join('')}
    </div>

    <div style="flex:1;min-width:0">
      ${products.length ? `
      <div class="table-wrap" style="max-height: calc(100vh - 220px); overflow-y: auto; -webkit-overflow-scrolling: touch;">
        <table class="admin-table">
          <thead><tr><th>الصورة</th><th>المنتج</th><th>القسم</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const cat = cats.find(c => c.id === p.catId);
              return `<tr class="ph43-admin-prod-row">
                <td>${p.imageBase64
                  ? `<img src="${p.imageBase64}" style="width:42px;height:42px;border-radius:10px;object-fit:cover">`
                  : '<span style="font-size:26px">📦</span>'}</td>
                <td>
                  <div style="font-weight:600">${escHtml(p.name)}</div>
                  ${p.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(p.desc).slice(0,60)}${p.desc.length>60?'...':''}</div>` : ''}
                  ${p.unit ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(p.unit)}</div>` : ''}
                </td>
                <td>${cat ? `<span class="badge badge-purple">${cat.icon || '📦'} ${escHtml(cat.name)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-weight:700;color:var(--primary)">${(p.price || 0).toLocaleString('ar-SA')} ريال</td>
                <td><span class="badge ${p.active !== false ? 'badge-teal' : 'badge-rose'}">${p.active !== false ? '✅ نشط' : '⏸️'}</span></td>
                <td>
                  <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff" onclick="ph43_showProductTiersModal('${p.id}','${storeId}')" title="فئات المنتج">🏷️</button>
                  <button class="btn btn-sm btn-secondary" onclick="ph43_showEditProductModal('${p.id}','${storeId}')">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="ph43_deleteProduct('${p.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted)">${products.length} منتج</div>` : `
      <div class="empty-state" style="padding:60px">
        <div class="empty-icon">📦</div>
        <div class="empty-title">لا توجد منتجات${activeCat ? ' في هذا القسم' : ''}</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="ph43_showAddProductModal('${storeId}')">➕ إضافة منتج</button>
      </div>`}
    </div>
  </div>`;
}

window.ph43_filterAdminStores = function() {
  const q = (document.getElementById('admin-stores-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph43-admin-store-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
};

window.ph43_filterAdminProducts = function() {
  const q = (document.getElementById('admin-prods-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph43-admin-prod-row').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
};

window.ph43_readStoreImage = function (input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('st-logo-b64').value = e.target.result;
    document.getElementById('st-logo-preview').src = e.target.result;
    document.getElementById('st-logo-preview').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
};

// ─── Add/Edit Store Modals ────────────────────────────
window.ph43_showAddStoreModal = function () {
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const regions = AppData.regions || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة متجر جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">🏪 اسم المتجر *</label><input class="form-control" id="st-name" placeholder="مثال: صيدلية الأمل"></div>
    <div class="form-group"><label class="form-label">أيقونة (إيموجي)</label><input class="form-control" id="st-icon" value="🏪"></div>
    <div class="form-group">
      <label class="form-label">صورة المتجر (شعار)</label>
      <input type="file" class="form-control" accept="image/*" onchange="ph43_readStoreImage(this)">
      <input type="hidden" id="st-logo-b64" value="">
      <img id="st-logo-preview" style="display:none;width:64px;height:64px;margin-top:10px;border-radius:12px;object-fit:cover;border:2px solid var(--border)">
    </div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="st-desc" placeholder="وصف مختصر عن المتجر..." style="resize:vertical"></textarea></div>
    <div class="form-group">
      <label class="form-label">🚗 وقت التوصيل</label>
      <input class="form-control" id="st-delivery" placeholder="مثال: 30-60 دقيقة">
    </div>
    ${_renderVendorPicker()}
    <div class="form-group">
      <label class="form-label">📍 المنطقة</label>
      <select class="form-control" id="st-region">
        <option value="">🌍 جميع المناطق</option>
        ${regions.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-top:12px">
      <label class="toggle-switch"><input type="checkbox" id="st-active" checked><span class="toggle-slider"></span></label>
      <span>متجر نشط (مرئي للعملاء)</span>
    </div>
    <button class="btn btn-primary btn-block" onclick="ph43_saveNewStore()">💾 حفظ المتجر</button>
  `);
};

window.ph43_saveNewStore = async function () {
  const name         = document.getElementById('st-name')?.value.trim();
  const icon         = document.getElementById('st-icon')?.value.trim() || '🏪';
  const desc         = document.getElementById('st-desc')?.value.trim();
  const deliveryTime = document.getElementById('st-delivery')?.value.trim();
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const regionId     = document.getElementById('st-region')?.value || null;
  const active       = document.getElementById('st-active')?.checked !== false;
  const logoBase64   = document.getElementById('st-logo-b64')?.value || null;

  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  if (!assignedVendors.length) { toast('يجب اختيار مزود واحد على الأقل لهذا المتجر', 'error'); return; }

  showLoader('جاري الحفظ...');
  try {
    await fsAdd('stores', { name, icon, desc, deliveryTime, assignedVendors, regionId, active, logoBase64 });
    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم إضافة المتجر', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_showEditStoreModal = function (storeId) {
  const s       = (AppData.stores || []).find(x => x.id === storeId);
  if (!s) return;
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const regions = AppData.regions || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المتجر</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">اسم المتجر *</label><input class="form-control" id="st-name" value="${escAttr(s.name)}"></div>
    <div class="form-group"><label class="form-label">أيقونة (إيموجي)</label><input class="form-control" id="st-icon" value="${escAttr(s.icon || '🏪')}"></div>
    <div class="form-group">
      <label class="form-label">صورة المتجر (شعار)</label>
      <input type="file" class="form-control" accept="image/*" onchange="ph43_readStoreImage(this)">
      <input type="hidden" id="st-logo-b64" value="${s.logoBase64 ? escAttr(s.logoBase64) : ''}">
      <img id="st-logo-preview" src="${s.logoBase64 ? s.logoBase64 : ''}" style="${s.logoBase64 ? 'display:block;' : 'display:none;'}width:64px;height:64px;margin-top:10px;border-radius:12px;object-fit:cover;border:2px solid var(--border)">
    </div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="st-desc">${escHtml(s.desc || '')}</textarea></div>
    <div class="form-group"><label class="form-label">🚗 وقت التوصيل</label><input class="form-control" id="st-delivery" value="${escAttr(s.deliveryTime || '')}"></div>
    ${_renderVendorPicker(s.assignedVendors || (s.vendorId ? [s.vendorId] : []))}
    <div class="form-group">
      <label class="form-label">📍 المنطقة</label>
      <select class="form-control" id="st-region">
        <option value="">🌍 جميع المناطق</option>
        ${regions.map(r => `<option value="${r.id}"${s.regionId === r.id ? ' selected' : ''}>${escHtml(r.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-top:12px">
      <label class="toggle-switch"><input type="checkbox" id="st-active"${s.active !== false ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <span>متجر نشط</span>
    </div>
    <button class="btn btn-primary btn-block" onclick="ph43_updateStore('${storeId}')">💾 حفظ التعديلات</button>
  `);
};

window.ph43_updateStore = async function (storeId) {
  const name         = document.getElementById('st-name')?.value.trim();
  const icon         = document.getElementById('st-icon')?.value.trim() || '🏪';
  const desc         = document.getElementById('st-desc')?.value.trim();
  const deliveryTime = document.getElementById('st-delivery')?.value.trim();
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const regionId     = document.getElementById('st-region')?.value || null;
  const active       = document.getElementById('st-active')?.checked !== false;
  const logoBase64   = document.getElementById('st-logo-b64')?.value || null;

  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  if (!assignedVendors.length) { toast('يجب اختيار مزود واحد على الأقل لهذا المتجر', 'error'); return; }
  showLoader();
  try {
    await fsUpdate('stores', storeId, { name, icon, desc, deliveryTime, assignedVendors, regionId, active, logoBase64 });
    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم التعديل', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_deleteStore = async function (storeId) {
  if (!confirm('هل تريد حذف هذا المتجر وجميع أقسامه ومنتجاته؟')) return;
  showLoader('جاري الحذف...');
  try {
    await fsDelete('stores', storeId);
    const cats  = (AppData.storeCats || []).filter(c => c.storeId === storeId);
    const prods = (AppData.storeProducts || []).filter(p => p.storeId === storeId);
    await Promise.all([...cats.map(c => fsDelete('store_cats', c.id)), ...prods.map(p => fsDelete('store_products', p.id))]);
    await ph43_reloadStoreData();
    hideLoader();
    toast('✅ تم حذف المتجر', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

// ─── Manage Categories Modal ──────────────────────────
window.ph43_showManageCatsModal = function (storeId) {
  const renderList = () => {
    const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
    return cats.length
      ? cats.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px">
          <span style="font-size:20px">${c.icon || '📦'}</span>
          <span style="flex:1;font-weight:600">${escHtml(c.name)}</span>
          <span style="font-size:12px;color:var(--text-muted)">${(AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id).length} منتج</span>
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteCat('${c.id}','${storeId}')">🗑️</button>
        </div>`).join('')
      : '<div style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد أقسام بعد</div>';
  };

  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">📂 إدارة أقسام المتجر</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="store-cats-list" style="margin-bottom:20px;max-height:300px;overflow-y:auto">
      ${renderList()}
    </div>
    <div style="background:var(--bg-secondary);border-radius:14px;padding:16px">
      <div style="font-weight:700;margin-bottom:12px">➕ إضافة قسم جديد</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-control" id="new-cat-icon" value="📦" style="width:70px;flex-shrink:0;text-align:center;font-size:18px">
        <input class="form-control" id="new-cat-name" placeholder="اسم القسم (مثال: مستلزمات طبية)">
      </div>
      <button class="btn btn-primary btn-block" onclick="ph43_addStoreCat('${storeId}')">➕ إضافة</button>
    </div>
  `);
};

window.ph43_addStoreCat = async function (storeId) {
  const name = document.getElementById('new-cat-name')?.value.trim();
  const icon = document.getElementById('new-cat-icon')?.value.trim() || '📦';
  if (!name) { toast('أدخل اسم القسم', 'error'); return; }
  try {
    const order = (AppData.storeCats || []).filter(c => c.storeId === storeId).length;
    await fsAdd('store_cats', { storeId, name, icon, order });
    await ph43_reloadStoreData();
    toast('✅ تم إضافة القسم', 'success');
    ph43_showManageCatsModal(storeId);
  } catch (e) { toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_deleteCat = async function (catId, storeId) {
  if (!confirm('حذف هذا القسم؟ ستظل المنتجات المرتبطة به بدون قسم.')) return;
  await fsDelete('store_cats', catId);
  await ph43_reloadStoreData();
  toast('✅ تم حذف القسم', 'success');
  ph43_showManageCatsModal(storeId);
};

// ─── Add/Edit Product Modals ──────────────────────────
window.ph43_showAddProductModal = function (storeId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بالإضافة المباشرة لقسم المتاجر والحجوزات. يرجى إرسال طلب إضافة خدمة للمراجعة.', 'warning');
    return;
  }

  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  const activeItems = (AppData.catalogItems || []).filter(item => item.status === 'active' && (item.sectionId === 'stores' || item.sectionId === 'digital'));
  const providers = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));

  const modalHtml = `
    <div class="modal-header">
      <h2 class="modal-title">🏪 ربط وإضافة منتجات من الكتالوج الموحد</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="ph46-modal-body-scroll" style="max-height: 75vh; overflow-y: auto; padding: 12px; direction: rtl; text-align: right; color: #ffffff;">
      
      <!-- اختيار القسم المحلي للتنزيل فيه -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-weight: 700;">📂 اختر فئة المتجر المحلية المستهدفة *</label>
        <select class="form-control" id="ph46-local-store-cat-select" onchange="window.__ph46_selectedStoreCatId = this.value;">
          <option value="">-- بدون فئة (عام) --</option>
          ${cats.map(c => `<option value="${c.id}" ${State.adminStoreCat === c.id ? 'selected' : ''}>${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-top: 16px;">
        <!-- العمود الأيسر: قائمة المنتجات في الكتالوج -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">📋 1. اختر المنتجات من الكتالوج الموحد (يمكن اختيار متعدد)</h4>
          
          <div class="search-input-wrap" style="margin-bottom:12px;">
            <input type="text" class="form-control" placeholder="🔍 بحث بالاسم..." oninput="window.ph46_filterStoreCatalogList(this.value)">
          </div>

          <div id="ph46-store-catalog-items-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${activeItems.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد منتجات نشطة في الكتالوج للمتاجر</div>
            ` : activeItems.map(item => `
              <label class="ph46-store-catalog-item-row" data-name="${item.name.toLowerCase()}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); border:1px solid transparent; transition:all 0.2s; cursor:pointer;">
                <input type="checkbox" class="ph46-store-catalog-cb" value="${item.id}" style="width:18px; height:18px;">
                ${item.mainImage ? `<img src="${item.mainImage}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">` : `<div style="width:36px; height:36px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">📦</div>`}
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(item.name)} ${item.sectionId === 'digital' ? '<span style="color:#3b82f6; font-size:10px;">🔑 رقمي</span>' : ''}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${item.price ? item.price + ' ريال' : ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- العمود الأيمن: قائمة مزودي الخدمة المتاحين للربط -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">👤 2. اختر الشركاء/المزودين المربوطين بها</h4>
          
          <div id="ph46-store-providers-list" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${providers.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا يوجد مزودون مسجلون</div>
            ` : providers.map(p => `
              <label style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); cursor:pointer;">
                <input type="checkbox" class="ph46-store-provider-cb" value="${p.uid}" style="width:18px; height:18px;">
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(p.name)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${p.phone || ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- قسم العروض والخصومات -->
      <div style="margin-top:20px;border:1px solid rgba(239,68,68,0.25);background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(245,158,11,0.03));border-radius:16px;padding:16px">
        <div style="font-weight:800;font-size:15px;color:#ef4444;margin-bottom:12px">🏷️ قسم العروض والخصومات</div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 14px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:12px;margin-bottom:12px">
          <input type="checkbox" id="ph46-add-to-offers" onchange="ph46_toggleOfferFields(this.checked)" style="width:20px;height:20px;accent-color:#ef4444">
          <div>
            <div style="font-weight:700;font-size:13px">إضافة هذه المنتجات إلى قسم العروض والخصومات</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">ستظهر المنتجات للعملاء في قسم العروض بسعر مخفض</div>
          </div>
        </label>
        <div id="ph46-offer-fields" style="display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">نسبة الخصم (%) *</label>
              <input class="form-control" id="ph46-offer-pct" type="number" min="1" max="99" placeholder="مثال: 20">
            </div>
            <div class="form-group">
              <label class="form-label">تاريخ الانتهاء (فارغ = دائم)</label>
              <input class="form-control" id="ph46-offer-expires" type="date">
            </div>
          </div>
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 14px;font-size:12px;color:#10b981">
            💡 سيُطبَّق نفس الخصم على جميع المنتجات المحددة
          </div>
        </div>
      </div>

      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="window.ph46_saveAdminStoreProducts('${storeId}')">💾 حفظ وربط المنتجات</button>
      </div>
    </div>
  `;

  openModal(modalHtml);
  window.__ph46_selectedStoreCatId = State.adminStoreCat || null;
};

window.ph46_toggleOfferFields = function (show) {
  const el = document.getElementById('ph46-offer-fields');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.ph46_filterStoreCatalogList = function(q) {
  const lowercase = q.toLowerCase().trim();
  const rows = document.querySelectorAll('.ph46-store-catalog-item-row');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = name.includes(lowercase) ? 'flex' : 'none';
  });
};

window.ph46_saveAdminStoreProducts = async function(storeId) {
  const catId = window.__ph46_selectedStoreCatId;
  const checkedItems = Array.from(document.querySelectorAll('.ph46-store-catalog-cb:checked')).map(cb => cb.value);
  const checkedProviders = Array.from(document.querySelectorAll('.ph46-store-provider-cb:checked')).map(cb => cb.value);

  if (checkedItems.length === 0) { toast('يرجى اختيار منتج واحد على الأقل من الكتالوج الموحد', 'warning'); return; }
  if (checkedProviders.length === 0) { toast('يرجى اختيار شريك/مزود واحد على الأقل', 'warning'); return; }

  showLoader();
  try {
    let addCount = 0;
    for (const itemId of checkedItems) {
      const item = (AppData.catalogItems || []).find(i => i.id === itemId);
      if (!item) continue;

      const productData = {
        storeId: storeId,
        catId: catId || null,
        name: item.name,
        desc: item.desc || '',
        price: item.price || 0,
        unit: 'حبة',
        imageBase64: item.mainImage || null,
        active: true,
        isDigital: item.sectionId === 'digital',
        sku: item.sku || null,
        assignedVendors: checkedProviders
      };

      const prodId = await fsAdd('store_products', productData);
      addCount++;

      // إضافة للعروض إن طُلب ذلك
      const addToOffers = document.getElementById('ph46-add-to-offers')?.checked;
      if (addToOffers && typeof ph_saveOfferFromSource === 'function') {
        const offerPct  = parseFloat(document.getElementById('ph46-offer-pct')?.value) || 0;
        const expStr    = document.getElementById('ph46-offer-expires')?.value || '';
        if (offerPct > 0 && item.price > 0) {
          await ph_saveOfferFromSource({
            title: item.name, desc: item.desc || '',
            sourceType: 'store_product', sourceId: prodId,
            sourceSection: 'stores', originalPrice: item.price,
            discountPercent: offerPct, imageBase64: item.mainImage || null,
            expiresStr: expStr
          });
        }
      }
    }

    if (typeof ph43_reloadStoreData === 'function') await ph43_reloadStoreData();
    closeModal();
    const addedToOffers = document.getElementById('ph46-add-to-offers')?.checked && parseFloat(document.getElementById('ph46-offer-pct')?.value) > 0;
    toast(`تمت إضافة وربط ${addCount} منتج بنجاح 🎉${addedToOffers ? ' وتمت إضافتها للعروض 🏷️' : ''}`, 'success');
    await render();
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

window.ph43_showEditProductModal = function (productId, storeId) {
  const p    = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  window.__ph43_pendingImg = null;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المنتج</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">القسم</label>
      <select class="form-control" id="prod-cat">
        <option value="">— بدون قسم —</option>
        ${cats.map(c => `<option value="${c.id}"${p.catId === c.id ? ' selected' : ''}>${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">اسم المنتج *</label><input class="form-control" id="prod-name" value="${escAttr(p.name)}"></div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="prod-desc">${escHtml(p.desc || '')}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">السعر (ريال)</label><input class="form-control" id="prod-price" type="number" value="${p.price || ''}"></div>
      <div class="form-group"><label class="form-label">الوحدة</label><input class="form-control" id="prod-unit" value="${escAttr(p.unit || '')}"></div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px 16px;margin-top:4px">
      <label class="toggle-switch"><input type="checkbox" id="prod-is-digital"${p.isDigital ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <div><div style="font-weight:700;font-size:14px">🔑 منتج رقمي (أكواد)</div><div style="font-size:12px;color:var(--text-muted)">كروت شبكة، شرائح، قسائم رقمية</div></div>
    </div>
    ${_renderVendorPicker(p.assignedVendors||[])}
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">صورة المنتج</label>
      ${p.imageBase64 ? `<img src="${p.imageBase64}" style="width:70px;height:70px;border-radius:12px;object-fit:cover;display:block;margin-bottom:8px;border:2px solid var(--primary)">` : ''}
      <input type="file" class="form-control" id="prod-img" accept="image/*" onchange="ph43_previewImg(this)">
      <div id="prod-img-preview"></div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px">
      <label class="toggle-switch"><input type="checkbox" id="prod-active"${p.active !== false ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <span>منتج نشط</span>
    </div>

    <!-- قسم العروض -->
    <div style="border:1px solid rgba(239,68,68,0.25);background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(245,158,11,0.03));border-radius:14px;padding:14px;margin-top:12px">
      <div style="font-weight:800;font-size:14px;color:#ef4444;margin-bottom:10px">🏷️ قسم العروض والخصومات</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:10px;margin-bottom:10px">
        <input type="checkbox" id="prod-add-to-offers" onchange="ph43_toggleEditOfferFields(this.checked)" style="width:18px;height:18px;accent-color:#ef4444" ${p.offerId ? 'checked' : ''}>
        <div>
          <div style="font-weight:700;font-size:13px">إضافة هذا المنتج إلى قسم العروض</div>
          <div style="font-size:11px;color:var(--text-muted)">يظهر للعملاء في صفحة العروض بسعر مخفض</div>
        </div>
      </label>
      <div id="prod-offer-fields" style="display:${p.offerId ? 'block' : 'none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">نسبة الخصم (%)</label>
            <input class="form-control" id="prod-offer-pct" type="number" min="1" max="99" value="${p.offerDiscountPct || ''}" placeholder="مثال: 25">
          </div>
          <div class="form-group">
            <label class="form-label">تاريخ الانتهاء (فارغ = دائم)</label>
            <input class="form-control" id="prod-offer-expires" type="date" value="${p.offerExpiresAt ? (p.offerExpiresAt.toDate ? p.offerExpiresAt.toDate() : new Date(p.offerExpiresAt)).toISOString().split('T')[0] : ''}">
          </div>
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="ph43_updateProduct('${productId}','${storeId}')">💾 حفظ</button>
  `);
};

window.ph43_toggleEditOfferFields = function (show) {
  const el = document.getElementById('prod-offer-fields');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.ph43_updateProduct = async function (productId, storeId) {
  const catId  = document.getElementById('prod-cat')?.value || null;
  const name   = document.getElementById('prod-name')?.value.trim();
  const desc   = document.getElementById('prod-desc')?.value.trim();
  const price  = parseFloat(document.getElementById('prod-price')?.value) || 0;
  const unit   = document.getElementById('prod-unit')?.value.trim();
  const active = document.getElementById('prod-active')?.checked !== false;
  const isDigital = document.getElementById('prod-is-digital')?.checked === true;
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const upd = { catId, name, desc, price, unit, active, isDigital, assignedVendors };
  if (window.__ph43_pendingImg) upd.imageBase64 = window.__ph43_pendingImg;
  showLoader();
  try {
    await fsUpdate('store_products', productId, upd);
    window.__ph43_pendingImg = null;

    // معالجة العروض
    const addToOffers = document.getElementById('prod-add-to-offers')?.checked;
    if (addToOffers && typeof ph_saveOfferFromSource === 'function') {
      const offerPct = parseFloat(document.getElementById('prod-offer-pct')?.value) || 0;
      const expStr   = document.getElementById('prod-offer-expires')?.value || '';
      const p = (AppData.storeProducts || []).find(x => x.id === productId);
      if (offerPct > 0 && price > 0) {
        const img = window.__ph43_pendingImg || p?.imageBase64 || null;
        await ph_saveOfferFromSource({
          title: name, desc,
          sourceType: 'store_product', sourceId: productId,
          sourceSection: 'stores', originalPrice: price,
          discountPercent: offerPct, imageBase64: img,
          expiresStr: expStr
        });
      }
    }

    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم التعديل', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_deleteProduct = async function (productId) {
  if (!confirm('حذف هذا المنتج؟')) return;
  await fsDelete('store_products', productId);
  await ph43_reloadStoreData();
  toast('✅ تم الحذف', 'success');
  await render();
};

// ─── Phase 43: Store Products Booking Tiers ───────────
window.ph43_showProductTiersModal = function (productId, storeId) {
  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const tiers = p.tiers || [];

  const renderTierRow = (tier, idx) => `
    <div class="ph40-tier-row" id="ph43-tier-${idx}">
      <div class="ph40-tier-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${tier.icon || '🏷️'}</span>
          <div>
            <div class="ph40-tier-name">${escHtml(tier.name)}</div>
            <div class="ph40-tier-price">${(tier.price || 0).toLocaleString('ar-SA')} ريال</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteProductTier('${productId}', '${storeId}', ${idx})">🗑️ حذف</button>
        </div>
      </div>
      ${tier.desc ? `<div class="ph40-tier-desc">${escHtml(tier.desc)}</div>` : ''}
      ${tier.features && tier.features.length ? `
        <div class="ph40-tier-features">
          ${tier.features.map(f => `<span class="ph40-feature-tag">✓ ${escHtml(f)}</span>`).join('')}
        </div>` : ''}
    </div>`;

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🏷️ فئات المنتج — ${escHtml(p.name)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div class="ph40-info-box">
      💡 أضف فئات ومميزات مختلفة لهذا المنتج/الخدمة بالمتجر (مثال: سرير واحد بـ 5000 وسريرين بـ 8000). سيختار العميل منها عند الطلب.
    </div>

    <div id="ph43-tiers-list">
      ${tiers.length ? tiers.map(renderTierRow).join('') : `
        <div class="empty-state" style="padding:28px 20px">
          <div class="empty-icon">🏷️</div>
          <div class="empty-title">لا توجد فئات بعد</div>
          <div class="empty-sub">أضف الفئة الأولى للمنتج أدناه</div>
        </div>`}
    </div>

    <div class="ph40-add-tier-form">
      <h3 style="margin-bottom:14px;font-size:15px;font-weight:700">➕ إضافة فئة جديدة للمنتج</h3>
      <div class="ph40-form-grid">
        <div class="form-group">
          <label class="form-label">اسم الفئة *</label>
          <input class="form-control" id="ph43-t-name" placeholder="مثال: جناح عائلي">
        </div>
        <div class="form-group">
          <label class="form-label">السعر (ريال) *</label>
          <input class="form-control" id="ph43-t-price" type="number" min="0" placeholder="مثال: 5000">
        </div>
        <div class="form-group">
          <label class="form-label">أيقونة (اختياري)</label>
          <input class="form-control" id="ph43-t-icon" placeholder="مثال: 🛏️ أو 👑">
        </div>
        <div class="form-group">
          <label class="form-label">وصف مختصر</label>
          <input class="form-control" id="ph43-t-desc" placeholder="وصف الفئة...">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">المميزات (افصل بفاصلة)</label>
          <input class="form-control" id="ph43-t-features" placeholder="مثال: واي فاي مجاني, سريرين, إفطار مجاني">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="ph43_addProductTier('${productId}', '${storeId}')">➕ إضافة الفئة</button>
    </div>`);
};

window.ph43_addProductTier = async function (productId, storeId) {
  const name    = document.getElementById('ph43-t-name')?.value.trim();
  const price   = parseFloat(document.getElementById('ph43-t-price')?.value) || 0;
  const icon    = document.getElementById('ph43-t-icon')?.value.trim() || '🏷️';
  const desc    = document.getElementById('ph43-t-desc')?.value.trim() || '';
  const featStr = document.getElementById('ph43-t-features')?.value.trim() || '';
  const features = featStr ? featStr.split(',').map(f => f.trim()).filter(Boolean) : [];

  if (!name)          { toast('اسم الفئة مطلوب', 'error'); return; }
  if (!price || price <= 0) { toast('يجب إدخال سعر صحيح أكبر من صفر', 'error'); return; }

  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;

  const tiers = [...(p.tiers || []), { name, price, icon, desc, features }];
  showLoader('جاري حفظ الفئات...');
  try {
    await fsUpdate('store_products', productId, { tiers });
    p.tiers = tiers;
    await ph43_reloadStoreData();
    hideLoader();
    toast('✅ تمت إضافة الفئة بنجاح', 'success');
    ph43_showProductTiersModal(productId, storeId);
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph43_deleteProductTier = async function (productId, storeId, idx) {
  if (!confirm('حذف هذه الفئة نهائياً؟')) return;
  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const tiers = (p.tiers || []).filter((_, i) => i !== idx);
  showLoader('جاري الحذف...');
  try {
    await fsUpdate('store_products', productId, { tiers });
    p.tiers = tiers;
    await ph43_reloadStoreData();
    hideLoader();
    toast('تم حذف الفئة', 'success');
    ph43_showProductTiersModal(productId, storeId);
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحذف: ' + (e.message || e), 'error');
  }
};

window.ph43_renderProductTierSelector = function (product) {
  const tiers = product.tiers;
  if (!tiers || !tiers.length) return '';
  return `
    <div class="ph40-tier-selector">
      <label class="form-label" style="font-size:15px;font-weight:700;margin-bottom:10px;display:block">
        🏷️ اختر الفئة المناسبة
      </label>
      <div class="ph40-tier-cards" id="ph43-tier-cards">
        ${tiers.map((tier, idx) => `
          <div class="ph40-tier-card${idx === 0 ? ' selected' : ''}" id="ph43-tc-${idx}"
               onclick="ph43_selectProductTier(${idx}, ${tier.price || 0}, '${escAttr(tier.name)}')">
            <div class="ph40-tc-header">
              <span class="ph40-tc-icon">${tier.icon || '🏷️'}</span>
              <div class="ph40-tc-info">
                <div class="ph40-tc-name">${escHtml(tier.name)}</div>
                ${tier.desc ? `<div class="ph40-tc-desc-inline">${escHtml(tier.desc)}</div>` : ''}
              </div>
              <div class="ph40-tc-price-wrap">
                <div class="ph40-tc-price">${(tier.price || 0).toLocaleString('ar-SA')}</div>
                <div class="ph40-tc-currency">ريال</div>
              </div>
              <span class="ph40-tc-check" id="ph43-check-${idx}">${idx === 0 ? '✅' : ''}</span>
            </div>
            ${tier.features && tier.features.length ? `
              <div class="ph40-tc-features">
                ${tier.features.map(f => `<span class="ph40-tc-feat">✓ ${escHtml(f)}</span>`).join('')}
              </div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
};

window.ph43_selectProductTier = function (idx, price, name) {
  document.querySelectorAll('#ph43-tier-cards .ph40-tier-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const chk = document.getElementById('ph43-check-' + i);
    if (chk) chk.textContent = i === idx ? '✅' : '';
  });
  window.__ph43_selectedProductTier = { idx, price, name };
};

window.__ph43_selectedProductTier = null;

// ─── Data Reload ──────────────────────────────────────
window.ph43_reloadStoreData = async function () {
  const [stores, storeCats, storeProducts] = await Promise.all([
    fsGetAll('stores').catch(() => []),
    fsGetAll('store_cats').catch(() => []),
    fsGetAll('store_products').catch(() => []),
  ]);
  AppData.stores       = stores;
  AppData.storeCats    = storeCats;
  AppData.storeProducts = storeProducts;
};

// ─── Periodically refresh cart badge ─────────────────
setInterval(ph43_updateCartBadge, 1000);

// ───────────────────────────────────────────────────────
// SECTION 7 — Styles
// ───────────────────────────────────────────────────────
(function () {
  if (window.__ph43Styles) return;
  window.__ph43Styles = true;
  const s = document.createElement('style');
  s.textContent = `
    /* ── View Toggle ── */
    .ph43-view-toggle { display:flex; gap:4px; background:var(--bg-secondary); border-radius:12px; padding:4px; border:1px solid var(--border); }
    .ph43-vtbtn { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:9px; border:none; background:transparent; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-muted); font-family:inherit; transition:all 0.18s; }
    .ph43-vtbtn:hover { background:var(--bg-card); color:var(--text-main); }
    .ph43-vtbtn.active { background:var(--bg-card); color:var(--primary); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
    @media(max-width:480px) { .ph43-vtbtn span:not(svg) { display:none; } .ph43-vtbtn { padding:7px 10px; } }

    /* ── Store Listing Grid ── */
    .ph43-stores-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
    .ph43-store-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:18px; overflow:hidden; cursor:pointer; transition:all 0.22s; }
    .ph43-store-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:rgba(139,92,246,0.4); }
    .ph43-store-card-header { position:relative; height:110px; overflow:hidden; background:var(--bg-secondary); }
    .ph43-store-banner { width:100%; height:100%; object-fit:cover; }
    .ph43-store-banner-placeholder { height:100%; display:flex; align-items:center; justify-content:center; font-size:46px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02)); }
    .ph43-store-card-avatar { position:absolute; bottom:-16px; right:14px; width:44px; height:44px; border-radius:11px; border:3px solid var(--bg-card); background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:22px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.12); }
    .ph43-store-card-avatar img { width:100%; height:100%; object-fit:cover; }
    .ph43-store-card-body { padding:22px 14px 14px; }
    .ph43-store-name { font-size:16px; font-weight:800; margin-bottom:4px; }
    .ph43-store-desc { font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:9px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ph43-store-meta { display:flex; gap:10px; font-size:11px; color:var(--text-muted); margin-bottom:12px; flex-wrap:wrap; }
    .ph43-store-btn { width:100%; border-radius:11px !important; padding:9px !important; font-size:13px !important; }

    /* ── List View ── */
    .ph43-stores-list { display:flex; flex-direction:column; gap:10px; }
    .ph43-store-list-item { display:flex; align-items:center; gap:14px; background:var(--bg-card); border:1px solid var(--glass-border); border-radius:14px; padding:14px 16px; cursor:pointer; transition:all 0.2s; }
    .ph43-store-list-item:hover { border-color:rgba(139,92,246,0.35); box-shadow:0 4px 14px rgba(0,0,0,0.08); transform:translateX(-2px); }
    .ph43-list-logo { width:52px; height:52px; border-radius:13px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border:1px solid var(--border); }
    .ph43-list-info { flex:1; min-width:0; }
    .ph43-list-name { font-weight:800; font-size:15px; margin-bottom:3px; }
    .ph43-list-desc { font-size:12px; color:var(--text-secondary); margin-bottom:5px; line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ph43-list-meta { display:flex; gap:10px; font-size:11px; color:var(--text-muted); flex-wrap:wrap; }
    .ph43-list-arrow { font-size:18px; color:var(--primary); flex-shrink:0; padding:0 4px; }

    /* ── Slideshow View ── */
    .ph43-slideshow-view { display:flex; flex-direction:column; gap:16px; }
    .ph43-slide-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:18px; overflow:hidden; }
    .ph43-slide-hero { position:relative; height:130px; cursor:pointer; overflow:hidden; background:var(--bg-secondary); }
    .ph43-slide-banner-img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s; }
    .ph43-slide-hero:hover .ph43-slide-banner-img { transform:scale(1.04); }
    .ph43-slide-banner-ph { height:100%; display:flex; align-items:center; justify-content:center; font-size:56px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02)); }
    .ph43-slide-overlay { position:absolute; bottom:0; inset-inline:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.1) 80%,transparent 100%); padding:10px 14px; display:flex; align-items:flex-end; gap:10px; }
    .ph43-slide-avatar { width:38px; height:38px; border-radius:10px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; overflow:hidden; border:2px solid rgba(255,255,255,0.3); }
    .ph43-slide-name { font-weight:800; font-size:15px; color:#fff; line-height:1.3; }
    .ph43-slide-subdesc { font-size:11px; color:rgba(255,255,255,0.7); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ph43-slide-showall-btn { background:rgba(255,255,255,0.15); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.25); color:#fff; border-radius:9px; padding:6px 11px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; flex-shrink:0; transition:all 0.2s; }
    .ph43-slide-showall-btn:hover { background:rgba(255,255,255,0.25); }
    .ph43-slide-cats-row { padding:12px 14px 14px; }
    .ph43-slide-cats-label { font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.4px; }
    .ph43-slide-cats-scroll { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
    .ph43-slide-cats-scroll::-webkit-scrollbar { height:3px; }
    .ph43-slide-cats-scroll::-webkit-scrollbar-thumb { background:rgba(139,92,246,0.3); border-radius:99px; }
    .ph43-slide-chip { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:20px; border:1px solid var(--glass-border); background:var(--bg-secondary); cursor:pointer; font-size:12px; font-weight:600; color:var(--text-main); font-family:inherit; white-space:nowrap; transition:all 0.18s; flex-shrink:0; }
    .ph43-slide-chip:hover { background:rgba(139,92,246,0.1); border-color:rgba(139,92,246,0.35); color:var(--primary); }
    .ph43-chip-cnt { background:var(--bg-card); border-radius:9px; padding:1px 6px; font-size:10px; font-weight:800; color:var(--text-muted); }

    /* ── Store Hero ── */
    .ph43-store-hero { background:var(--bg-card); border-radius:20px; overflow:hidden; margin-bottom:20px; border:1px solid var(--glass-border); }
    .ph43-store-hero-img { width:100%; height:180px; object-fit:cover; display:block; }
    .ph43-store-hero-placeholder { height:100px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02)); display:flex; align-items:center; justify-content:center; font-size:52px; }
    .ph43-store-hero-info { display:flex; align-items:center; gap:14px; padding:14px 20px; flex-wrap:wrap; }
    .ph43-store-hero-avatar { width:48px; height:48px; border-radius:12px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:26px; overflow:hidden; flex-shrink:0; border:2px solid var(--glass-border); }
    .ph43-store-hero-avatar img { width:100%; height:100%; object-fit:cover; }
    .ph43-store-hero-name { font-size:18px; font-weight:800; }
    .ph43-store-hero-desc { font-size:13px; color:var(--text-secondary); margin-top:2px; }
    .ph43-cart-hero-btn { background:var(--gradient-main); color:#fff; border:none; border-radius:12px; padding:9px 16px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
    .ph43-cart-hero-btn:hover { transform:scale(1.05); }

    /* ── Store Layout ── */
    .ph43-store-layout { display:flex; gap:20px; align-items:flex-start; }
    .ph43-store-sidebar { width:196px; flex-shrink:0; display:flex; flex-direction:column; gap:4px; position:sticky; top:76px; }
    .ph43-sidebar-title { font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:8px; padding:0 4px; text-transform:uppercase; letter-spacing:.5px; }
    .ph43-sidebar-btn { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; border:1px solid transparent; background:transparent; cursor:pointer; font-size:14px; font-family:inherit; font-weight:600; color:var(--text-secondary); width:100%; text-align:right; transition:all 0.2s ease; }
    .ph43-sidebar-btn:hover { background:var(--bg-secondary); color:var(--text-main); border-color:var(--border); }
    .ph43-sidebar-btn.active { background:var(--primary); border-color:var(--primary); color:#fff; font-weight:700; box-shadow:0 4px 12px rgba(139,92,246,0.25); }
    .ph43-sidebar-count { margin-inline-start:auto; font-size:11px; background:var(--bg-secondary); border-radius:12px; padding:2px 7px; font-weight:700; color:var(--text-muted); transition:all 0.2s ease; }
    .ph43-sidebar-btn.active .ph43-sidebar-count { background:rgba(255,255,255,0.25); color:#fff; }

    /* ── Products Area ── */
    .ph43-products-area { flex:1; min-width:0; }
    .ph43-products-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
    .ph43-product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(185px,1fr)); gap:16px; }
    .ph43-product-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:16px; overflow:hidden; transition:all 0.2s; }
    .ph43-product-card:hover { box-shadow:var(--shadow-lg); transform:translateY(-3px); }
    .ph43-product-img { width:100%; height:148px; object-fit:cover; display:block; }
    .ph43-product-img-placeholder { width:100%; height:148px; background:linear-gradient(135deg,rgba(139,92,246,0.05),rgba(139,92,246,0.02)); display:flex; align-items:center; justify-content:center; font-size:44px; }
    .ph43-product-body { padding:12px; }
    .ph43-product-name { font-weight:700; font-size:14px; margin-bottom:4px; line-height:1.4; }
    .ph43-product-desc { font-size:12px; color:var(--text-secondary); margin-bottom:6px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ph43-product-footer { display:flex; align-items:center; justify-content:space-between; margin-top:10px; gap:6px; }
    .ph43-product-price { font-size:15px; font-weight:800; color:var(--primary); }
    .ph43-add-cart-btn { display:flex; align-items:center; gap:5px; padding:7px 11px; border-radius:10px; border:none; background:var(--gradient-main); color:#fff; cursor:pointer; font-size:11px; font-weight:700; transition:all 0.15s; white-space:nowrap; flex-shrink:0; }
    .ph43-add-cart-btn:hover { transform:scale(1.06); box-shadow:0 4px 10px rgba(139,92,246,0.3); }
    .ph43-add-cart-btn.in-cart { background:linear-gradient(135deg,#10b981,#059669); }

    /* ── Cart Nav Button ── */
    .ph43-cart-nav-btn { position:relative; display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04)); color:var(--primary); border:1px solid rgba(139,92,246,0.25); border-radius:14px; padding:8px 14px; cursor:pointer; font-size:13px; font-weight:800; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 4px 12px rgba(0,0,0,0.03); overflow:visible; }
    .ph43-cart-nav-btn:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(139,92,246,0.18); background:linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.08)); border-color:rgba(139,92,246,0.4); }
    .ph43-cart-nav-btn:active { transform:translateY(0) scale(0.96); }
    .ph43-cart-nav-btn svg { width:20px; height:20px; stroke-width:2; transition:all 0.3s; }
    .ph43-cart-nav-btn:hover svg { transform:rotate(-8deg) scale(1.1); }
    #ph43-cart-badge { background:linear-gradient(135deg, #ef4444, #dc2626); color:#fff; border-radius:50%; min-width:20px; height:20px; padding:0 4px; font-size:11px; display:none; align-items:center; justify-content:center; font-weight:800; position:absolute; top:-8px; right:-8px; border:2px solid var(--bg-card); box-shadow:0 4px 10px rgba(239,68,68,0.4); z-index:2; transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
    
    .cart-bump { animation: cartBumpAnim 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
    @keyframes cartBumpAnim { 
      0% { transform: scale(1); } 
      40% { transform: scale(1.15) translateY(-3px); } 
      100% { transform: scale(1) translateY(0); } 
    }

    /* ── Sticky Cart Bar ── */
    .ph43-sticky-cart { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--gradient-main); color:#fff; border-radius:99px; padding:14px 28px; display:flex; align-items:center; justify-content:space-between; gap:24px; min-width:300px; cursor:pointer; z-index:200; box-shadow:0 8px 28px rgba(139,92,246,0.55); font-size:14px; font-weight:700; transition:all 0.2s; animation:ph43CartPop 0.35s ease; }
    .ph43-sticky-cart:hover { transform:translateX(-50%) scale(1.04); }
    @keyframes ph43CartPop { from { opacity:0; transform:translateX(-50%) translateY(20px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

    /* ── Admin Store Cards ── */
    .ph43-admin-store-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; }
    .ph43-admin-store-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:18px; padding:20px; transition:all 0.2s; }
    .ph43-admin-store-card:hover { box-shadow:var(--shadow-lg); }

    /* ── Responsive ── */
    @media(max-width:660px) {
      .ph43-store-layout { flex-direction:column; }
      .ph43-store-sidebar { width:100%; position:static; flex-direction:row; flex-wrap:wrap; gap:6px; }
      .ph43-sidebar-btn { width:auto; flex:1 1 auto; min-width:90px; justify-content:center; }
      .ph43-product-grid { grid-template-columns:repeat(2,1fr); gap:10px; }
      .ph43-stores-grid { grid-template-columns:1fr; }
      .ph43-sticky-cart { min-width:unset; left:12px; right:12px; transform:none; bottom:12px; border-radius:16px; }
      .ph43-sticky-cart:hover { transform:none; }
    }

    /* ── Product Tiers (فئات الحجز والمميزات) ── */
    .ph40-info-box { background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.15); padding:12px 16px; border-radius:12px; font-size:13px; color:var(--primary); line-height:1.6; margin-bottom:20px; text-align:right; }
    .ph40-tier-row { background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:14px; padding:14px; margin-bottom:12px; text-align:right; }
    .ph40-tier-header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .ph40-tier-name { font-weight:700; font-size:14px; }
    .ph40-tier-price { font-weight:800; color:var(--primary); font-size:13px; margin-top:2px; }
    .ph40-tier-desc { font-size:12px; color:var(--text-secondary); margin-top:6px; line-height:1.5; }
    .ph40-tier-features { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; justify-content:flex-start; }
    .ph40-feature-tag { font-size:11px; background:rgba(16,185,129,0.08); color:#10b981; border:1px solid rgba(16,185,129,0.15); border-radius:6px; padding:2px 8px; font-weight:600; }
    .ph40-add-tier-form { background:var(--bg-secondary); border:1.5px dashed var(--glass-border); border-radius:16px; padding:18px; margin-top:24px; text-align:right; }
    .ph40-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
    
    .ph40-tier-selector { margin-bottom:20px; text-align:right; }
    .ph40-tier-cards { display:flex; flex-direction:column; gap:10px; }
    .ph40-tier-card { background:var(--bg-card); border:1.5px solid var(--glass-border); border-radius:14px; padding:14px; cursor:pointer; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); position:relative; overflow:hidden; text-align:right; }
    .ph40-tier-card:hover { border-color:rgba(139,92,246,0.3); background:var(--bg-secondary); }
    .ph40-tier-card.selected { border-color:var(--primary); background:linear-gradient(135deg,rgba(139,92,246,0.06),rgba(139,92,246,0.02)); box-shadow:0 6px 18px rgba(139,92,246,0.08); }
    .ph40-tc-header { display:flex; align-items:center; gap:12px; width:100%; }
    .ph40-tc-icon { font-size:24px; flex-shrink:0; }
    .ph40-tc-info { flex:1; min-width:0; }
    .ph40-tc-name { font-weight:700; font-size:14px; color:var(--text-main); }
    .ph40-tc-desc-inline { font-size:11px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ph40-tc-price-wrap { text-align:left; flex-shrink:0; margin-inline-start:auto; display:flex; flex-direction:column; align-items:flex-end; }
    .ph40-tc-price { font-size:18px; font-weight:800; color:var(--primary); }
    .ph40-tc-currency { font-size:10px; color:var(--text-muted); font-weight:600; }
    .ph40-tc-check { font-size:16px; margin-inline-start:8px; flex-shrink:0; min-width:20px; text-align:center; }
    .ph40-tc-features { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--glass-border); justify-content:flex-start; }
    .ph40-tc-feat { font-size:11px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:6px; padding:2px 8px; font-weight:500; }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 43] Store & Shopping Cart System loaded');
