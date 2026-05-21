// ═══════════════════════════════════════════════════════
//  محجوز v2.8 — Phase 8 (Polish layer)
//  - Lightbox للمعرض داخل صفحة تفاصيل الخدمة
//  - إرسال فوري للفاتورة لحظة الحجز (واتساب/إيميل/مشاركة)
//  - بحث ذكي مع آخر عمليات البحث + اقتراحات لحظية
//  - صوت + تنبيه بصري مميز للأحداث المهمة
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('lb_close',          'إغلاق',                      'Close');
  add('lb_prev',           'السابق',                     'Previous');
  add('lb_next',           'التالي',                     'Next');
  add('purchase_send_ask', '🎉 تم الحجز! هل تريد إرسال نسخة من الفاتورة لك الآن؟', '🎉 Order placed! Send a copy of the invoice now?');
  add('purchase_send_yes', 'إرسال الفاتورة',             'Send invoice');
  add('purchase_send_no',  'لا، شكراً',                  'No, thanks');
  add('search_recent',     'آخر عمليات البحث',           'Recent searches');
  add('search_clear',      'مسح',                        'Clear');
  add('search_suggest',    'اقتراحات',                   'Suggestions');
  add('search_in_cat',     'في التصنيفات',               'In categories');
  add('search_in_svc',     'في الخدمات',                 'In services');
})();

// ════════════════════════════════════════════════════════════
//  1) LIGHTBOX للمعرض
// ════════════════════════════════════════════════════════════
window.ph8_openLightbox = function (images, startIdx = 0) {
  if (!Array.isArray(images) || !images.length) return;
  let idx = Math.max(0, Math.min(startIdx, images.length - 1));

  // Reuse existing if open
  document.getElementById('ph8-lb')?.remove();

  const lb = document.createElement('div');
  lb.id = 'ph8-lb';
  lb.className = 'ph8-lb';
  lb.innerHTML = `
    <button class="ph8-lb-close" aria-label="${t('lb_close')}">✕</button>
    <button class="ph8-lb-arrow ph8-lb-prev" aria-label="${t('lb_prev')}">‹</button>
    <div class="ph8-lb-stage">
      <img class="ph8-lb-img" alt="">
      <div class="ph8-lb-counter"></div>
    </div>
    <button class="ph8-lb-arrow ph8-lb-next" aria-label="${t('lb_next')}">›</button>
    <div class="ph8-lb-strip"></div>
  `;
  document.body.appendChild(lb);

  const imgEl = lb.querySelector('.ph8-lb-img');
  const counter = lb.querySelector('.ph8-lb-counter');
  const strip = lb.querySelector('.ph8-lb-strip');

  function update() {
    imgEl.src = images[idx];
    counter.textContent = `${idx + 1} / ${images.length}`;
    strip.querySelectorAll('img').forEach((el, i) => el.classList.toggle('on', i === idx));
    const active = strip.querySelector('img.on');
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  function close() {
    lb.classList.add('closing');
    setTimeout(() => lb.remove(), 180);
    document.removeEventListener('keydown', onKey);
  }
  function next() { idx = (idx + 1) % images.length; update(); }
  function prev() { idx = (idx - 1 + images.length) % images.length; update(); }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft')  (document.dir === 'rtl' ? next() : prev());
    else if (e.key === 'ArrowRight') (document.dir === 'rtl' ? prev() : next());
  }

  // Build strip
  if (images.length > 1) {
    strip.innerHTML = images.map((src, i) =>
      `<img src="${src}" data-i="${i}" class="${i === idx ? 'on' : ''}">`
    ).join('');
    strip.querySelectorAll('img').forEach(el => {
      el.addEventListener('click', () => { idx = +el.dataset.i; update(); });
    });
  } else {
    strip.style.display = 'none';
    lb.querySelector('.ph8-lb-prev').style.display = 'none';
    lb.querySelector('.ph8-lb-next').style.display = 'none';
  }

  lb.querySelector('.ph8-lb-close').addEventListener('click', close);
  lb.querySelector('.ph8-lb-prev').addEventListener('click', prev);
  lb.querySelector('.ph8-lb-next').addEventListener('click', next);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });

  // Touch swipe
  let tx = 0;
  imgEl.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  imgEl.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) < 40) return;
    // RTL: swipe right = previous; LTR opposite
    if (document.dir === 'rtl') (dx > 0 ? prev() : next());
    else                        (dx > 0 ? next() : prev());
  }, { passive: true });

  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => lb.classList.add('on'));
  update();
};

// Delegate clicks on existing gallery elements (.gal-main / .gal-thumbs img)
document.addEventListener('click', (e) => {
  const main  = e.target.closest('.gal-main');
  const thumb = e.target.closest('.gal-thumbs img');
  if (!main && !thumb) return;
  // Only fire on the service detail page
  const gal = (main || thumb).closest('.svc-gallery');
  if (!gal) return;
  const imgs = Array.from(gal.querySelectorAll('.gal-thumbs img')).map(i => i.src);
  // If there are no thumbs (single image), use main
  let images = imgs;
  if (!images.length) {
    const m = gal.querySelector('.gal-main');
    if (m?.src) images = [m.src];
  }
  if (!images.length) return;
  let startIdx = 0;
  if (thumb) {
    startIdx = imgs.indexOf(thumb.src);
    if (startIdx < 0) startIdx = 0;
    e.stopPropagation(); // don't also bubble to .gal-main click
  } else if (main) {
    // Use the currently displayed src as start
    const cur = gal.querySelector('#gal-main')?.src;
    startIdx = Math.max(0, imgs.indexOf(cur));
  }
  ph8_openLightbox(images, startIdx);
});

// ════════════════════════════════════════════════════════════
//  2) إرسال فوري للفاتورة لحظة الحجز
// ════════════════════════════════════════════════════════════
(function wrapBooking() {
  const __orig = window.confirmBooking;
  if (typeof __orig !== 'function') return;
  window.confirmBooking = async function (svcId) {
    // Snapshot of order ids before
    const before = new Set((AppData.orders || []).map(o => o.id));
    await __orig(svcId);
    // Find newly-created order belonging to current user
    setTimeout(() => {
      const u = State.currentUser;
      if (!u) return;
      const fresh = (AppData.orders || [])
        .filter(o => o.customerId === u.uid && !before.has(o.id))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      if (!fresh) return;
      ph8_promptInvoiceAfterPurchase(fresh);
    }, 800);
  };
})();

window.ph8_promptInvoiceAfterPurchase = function (order) {
  if (!order) return;
  const id = 'ph8-purchase-prompt';
  document.getElementById(id)?.remove();

  const u = State.currentUser;
  const hasEmail = !!u?.email;
  const hasPhone = !!u?.phone;
  const canShare = !!(navigator.canShare && navigator.share);

  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'ph8-purchase-prompt';
  wrap.innerHTML = `
    <div class="ph8-pp-card">
      <button class="ph8-pp-x" onclick="document.getElementById('${id}').remove()">✕</button>
      <div class="ph8-pp-emoji">🎉</div>
      <div class="ph8-pp-title">${t('purchase_send_ask')}</div>
      <div class="ph8-pp-meta">طلب #${order.orderId || order.id} • ${order.svcName || ''}</div>
      <div class="ph8-pp-actions">
        ${canShare ? `<button class="btn btn-primary btn-block" onclick="ph8_sendNow('${order.id}','share')">📲 مشاركة</button>` : ''}
        <button class="btn btn-block" style="background:#25d366;color:#fff" onclick="ph8_sendNow('${order.id}','whatsapp')" ${hasPhone?'':'disabled'}>💬 واتساب</button>
        <button class="btn btn-secondary btn-block" onclick="ph8_sendNow('${order.id}','email')" ${hasEmail?'':'disabled'}>📧 بريد إلكتروني</button>
        <button class="btn btn-secondary btn-block" onclick="ph8_sendNow('${order.id}','download')">⬇️ تنزيل فقط</button>
      </div>
      <button class="ph8-pp-skip" onclick="document.getElementById('${id}').remove()">${t('purchase_send_no')}</button>
    </div>
  `;
  document.body.appendChild(wrap);
  setTimeout(() => wrap.classList.add('on'), 20);
  // Auto-dismiss after 25s
  setTimeout(() => document.getElementById(id)?.remove(), 25000);
};

// Sends to the *current customer* (self) — uses ph7 dispatcher with a tweaked customer
window.ph8_sendNow = async function (orderId, method) {
  document.getElementById('ph8-purchase-prompt')?.remove();
  if (typeof ph7_doSend !== 'function' || typeof ph7_buildInvoiceFile !== 'function') {
    toast('خدمة الإرسال غير متاحة الآن', 'error'); return;
  }
  // ph7_doSend looks up the order's customerId, which IS the current user — so re-use directly
  await ph7_doSend(orderId, method);
};

// ════════════════════════════════════════════════════════════
//  3) بحث ذكي مع آخر عمليات البحث + اقتراحات
// ════════════════════════════════════════════════════════════
const PH8_RECENT_KEY = 'mahjooz_recent_search';
const PH8_RECENT_MAX = 8;

function ph8_getRecent() {
  try { return JSON.parse(localStorage.getItem(PH8_RECENT_KEY) || '[]'); } catch (e) { return []; }
}
function ph8_pushRecent(q) {
  q = (q || '').trim();
  if (!q || q.length < 2) return;
  let list = ph8_getRecent().filter(x => x.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  list = list.slice(0, PH8_RECENT_MAX);
  localStorage.setItem(PH8_RECENT_KEY, JSON.stringify(list));
}
window.ph8_clearRecent = function () {
  localStorage.removeItem(PH8_RECENT_KEY);
  ph8_renderSuggestPanel('');
};

function ph8_buildSuggestions(q) {
  q = (q || '').trim().toLowerCase();
  const cats = AppData.cats || [];
  const svcs = AppData.services || [];
  if (!q) return { cats: [], svcs: [] };
  const cmatch = cats.filter(c => (c.name || '').toLowerCase().includes(q)).slice(0, 5);
  const smatch = svcs.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.provider || '').toLowerCase().includes(q) ||
    (s.desc || '').toLowerCase().includes(q)
  ).slice(0, 6);
  return { cats: cmatch, svcs: smatch };
}

window.ph8_renderSuggestPanel = function (q) {
  const panel = document.getElementById('ph8-search-panel');
  if (!panel) return;
  const recents = ph8_getRecent();
  const { cats, svcs } = ph8_buildSuggestions(q);
  let html = '';

  if (!q && recents.length) {
    html += `
      <div class="ph8-sp-section">
        <div class="ph8-sp-head">
          <span>🕘 ${t('search_recent')}</span>
          <button class="ph8-sp-clear" onclick="ph8_clearRecent()">${t('search_clear')}</button>
        </div>
        <div class="ph8-sp-chips">
          ${recents.map(r => `<button class="ph8-chip" onclick="ph8_applySearch('${r.replace(/'/g, "\\'")}')">${escHtml(r)}</button>`).join('')}
        </div>
      </div>`;
  }
  if (q && cats.length) {
    html += `
      <div class="ph8-sp-section">
        <div class="ph8-sp-head"><span>📂 ${t('search_in_cat')}</span></div>
        ${cats.map(c => `
          <div class="ph8-sp-row" onclick="navigate('cat',{id:'${c.id}'})">
            <span class="ph8-sp-icon">${c.icon || '📁'}</span>
            <div><div class="ph8-sp-title">${escHtml(c.name)}</div>
            ${c.description ? `<div class="ph8-sp-sub">${escHtml(c.description.slice(0, 60))}</div>` : ''}</div>
          </div>`).join('')}
      </div>`;
  }
  if (q && svcs.length) {
    html += `
      <div class="ph8-sp-section">
        <div class="ph8-sp-head"><span>🔷 ${t('search_in_svc')}</span></div>
        ${svcs.map(s => `
          <div class="ph8-sp-row" onclick="ph8_pickSvc('${s.id}')">
            <span class="ph8-sp-icon">${s.images?.[0] ? `<img src="${s.images[0]}" style="width:34px;height:34px;border-radius:8px;object-fit:cover">` : (s.icon || '🔷')}</span>
            <div><div class="ph8-sp-title">${escHtml(s.name)}</div>
            <div class="ph8-sp-sub">${s.price ? `${s.price} ريال` : ''}</div></div>
          </div>`).join('')}
      </div>`;
  }
  if (q && !cats.length && !svcs.length) {
    html += `<div class="ph8-sp-empty">${t('no_results')}</div>`;
  }
  panel.innerHTML = html;
  panel.style.display = html ? 'block' : 'none';
};

window.ph8_pickSvc = function (svcId) {
  const inp = document.getElementById('global-search');
  if (inp) ph8_pushRecent(inp.value);
  document.getElementById('ph8-search-panel').style.display = 'none';
  navigate('service', { id: svcId });
};

window.ph8_applySearch = function (q) {
  const inp = document.getElementById('global-search');
  if (!inp) return;
  inp.value = q;
  ph8_pushRecent(q);
  if (typeof globalSearch === 'function') globalSearch();
  ph8_renderSuggestPanel(q);
  inp.focus();
};

// Wire up the global search input every time renderHome runs.
// Hook by observing DOM additions.
const __ph8_searchObserver = new MutationObserver(() => {
  const inp = document.getElementById('global-search');
  if (!inp || inp.dataset.ph8wired) return;
  inp.dataset.ph8wired = '1';

  // Ensure a panel exists right after the search box
  const wrap = inp.closest('.search-bar-wrap') || inp.parentElement;
  if (wrap && !document.getElementById('ph8-search-panel')) {
    const panel = document.createElement('div');
    panel.id = 'ph8-search-panel';
    panel.className = 'ph8-sp';
    wrap.style.position = wrap.style.position || 'relative';
    wrap.appendChild(panel);
  }

  inp.addEventListener('focus', () => ph8_renderSuggestPanel(inp.value));
  inp.addEventListener('input', () => ph8_renderSuggestPanel(inp.value));
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ph8_pushRecent(inp.value);
      if (typeof globalSearch === 'function') globalSearch();
    } else if (e.key === 'Escape') {
      const p = document.getElementById('ph8-search-panel');
      if (p) p.style.display = 'none';
      inp.blur();
    }
  });
  // Hide panel on outside click
  document.addEventListener('click', (e) => {
    const p = document.getElementById('ph8-search-panel');
    if (!p) return;
    if (!p.contains(e.target) && e.target !== inp) p.style.display = 'none';
  });
});
__ph8_searchObserver.observe(document.body, { childList: true, subtree: true });

// ════════════════════════════════════════════════════════════
//  4) صوت + تنبيه بصري بارز للأحداث المهمة
// ════════════════════════════════════════════════════════════
let __ph8_audioCtx = null;
function ph8_audio() {
  if (__ph8_audioCtx) return __ph8_audioCtx;
  try { __ph8_audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { __ph8_audioCtx = null; }
  return __ph8_audioCtx;
}
// Pleasant 2-tone chime via WebAudio (no asset needed)
window.ph8_playChime = function (kind = 'success') {
  const ctx = ph8_audio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
  const tones = {
    success:  [880, 1320],
    info:     [660, 990],
    error:    [440, 330],
    important:[523, 784, 1046],
  }[kind] || [880, 1320];
  const now = ctx.currentTime;
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.16);
    osc.stop(now + i * 0.16 + 0.32);
  });
};

// Override existing playNotificationSound (it was a 1-byte silent stub)
window.playNotificationSound = function (kind) { ph8_playChime(kind || 'important'); };

// Public: a "loud" toast for important events — shows a centered banner +
// chimes + vibrates if supported.
window.ph8_alert = function (title, body, opts = {}) {
  const kind = opts.kind || 'important';
  ph8_playChime(kind);
  if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60]); } catch (e) {} }

  const id = 'ph8-alert-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'ph8-alert ' + (kind === 'error' ? 'err' : kind === 'success' ? 'ok' : 'imp');
  el.innerHTML = `
    <div class="ph8-alert-icon">${opts.icon || (kind === 'error' ? '⚠️' : kind === 'success' ? '✅' : '🔔')}</div>
    <div class="ph8-alert-body">
      <div class="ph8-alert-title">${escHtml(title || '')}</div>
      ${body ? `<div class="ph8-alert-text">${escHtml(body)}</div>` : ''}
    </div>
    <button class="ph8-alert-x" onclick="document.getElementById('${id}').remove()">✕</button>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('on'), 20);
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 240); }, opts.timeout || 6000);
};

// Wrap toast() to chime quietly on success/error (without changing signatures)
(function wrapToast() {
  const __origToast = window.toast;
  if (typeof __origToast !== 'function') return;
  window.toast = function (msg, type = 'info', ...rest) {
    try {
      // Light chime only for success/error to avoid overload
      if (type === 'success' || type === 'error') ph8_playChime(type);
    } catch (e) {}
    return __origToast(msg, type, ...rest);
  };
})();

// Hook fsAdd to fire ph8_alert for important admin events
(function wrapFsAddForAlerts() {
  const __origFsAdd = window.fsAdd;
  if (typeof __origFsAdd !== 'function') return;
  window.fsAdd = async function (col, data) {
    const res = await __origFsAdd(col, data);
    try {
      const u = State.currentUser;
      if (!u) return res;
      // Notify admin/CS roles when something important happens by another user
      const isAdmin = u.role === 'admin' || u.role === 'staff';
      if (col === 'orders' && data.customerId !== u.uid && isAdmin) {
        ph8_alert('🆕 طلب جديد', `${data.customerName || ''} • ${data.svcName || ''}`, { kind: 'important' });
      } else if (col === 'recharge_requests' && data.userId !== u.uid && isAdmin) {
        ph8_alert('💰 طلب شحن جديد', `${data.userName || ''} • ${data.amount} ريال`, { kind: 'important' });
      }
    } catch (e) {}
    return res;
  };
})();

console.log('[Phase 8] Lightbox + instant invoice + smart search + audible alerts loaded.');
