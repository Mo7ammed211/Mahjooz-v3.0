/* ============================================================
   wishlist.js — نظام المفضلة الاحترافي
   - زر قلب متحرك على كل بطاقة خدمة
   - صفحة مفضلة متكاملة مع فلاتر وترتيب
   - مزامنة فورية مع Firestore
   - رابط في الـ navbar مع عداد
   ============================================================ */

(function () {
  'use strict';

  // ── CSS ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `

  /* ── Heart Button ─────────────────────────────────────────────── */
  .fav-heart-btn {
    position: absolute;
    top: 12px;
    inset-inline-end: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(255,255,255,0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .fav-heart-btn:hover {
    transform: scale(1.15);
    box-shadow: 0 4px 16px rgba(239,68,68,0.3);
  }
  .fav-heart-btn.active {
    background: rgba(239,68,68,0.15);
    box-shadow: 0 4px 16px rgba(239,68,68,0.3);
  }
  .fav-heart-btn svg {
    width: 18px;
    height: 18px;
    transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  .fav-heart-btn.active svg path {
    fill: #ef4444;
    stroke: #ef4444;
  }
  .fav-heart-btn:not(.active) svg path {
    fill: none;
    stroke: var(--text-muted);
    stroke-width: 2;
  }
  @keyframes favPop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.4); }
    70%  { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
  .fav-heart-btn.pop { animation: favPop 0.4s cubic-bezier(0.34,1.56,0.64,1); }

  /* ── Nav Fav Badge ────────────────────────────────────────────── */
  .fav-nav-badge {
    position: absolute;
    top: -4px;
    inset-inline-end: -4px;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    line-height: 1;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .fav-nav-btn {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 20px;
    transition: var(--transition);
    display: flex;
    align-items: center;
  }
  .fav-nav-btn:hover, .fav-nav-btn.active {
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }

  /* ── Favorites Page ───────────────────────────────────────────── */
  .fav-page-hero {
    background: linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(139,92,246,0.06) 100%);
    border: 1px solid rgba(239,68,68,0.15);
    border-radius: 20px;
    padding: 32px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  .fav-page-hero-icon {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #ec4899);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
    box-shadow: 0 8px 24px rgba(239,68,68,0.3);
    flex-shrink: 0;
  }
  .fav-page-hero-text { flex: 1; min-width: 180px; }
  .fav-page-hero-text h2 {
    font-size: 26px; font-weight: 800;
    background: linear-gradient(135deg, #ef4444, #ec4899);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 4px;
  }
  .fav-page-hero-text p { color: var(--text-secondary); font-size: 14px; margin: 0; }
  .fav-page-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }

  .fav-filters {
    display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; align-items: center;
  }
  .fav-filter-btn {
    padding: 8px 18px; border-radius: 99px; border: 1px solid var(--border);
    background: var(--bg-card); color: var(--text-muted);
    font-family: var(--font); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: var(--transition);
    display: flex; align-items: center; gap: 6px;
  }
  .fav-filter-btn:hover { border-color: var(--primary); color: var(--text-main); }
  .fav-filter-btn.active {
    background: var(--primary); color: #fff;
    border-color: var(--primary); box-shadow: 0 4px 12px rgba(139,92,246,0.3);
  }
  .fav-filter-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; border-radius: 9px;
    background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700;
    padding: 0 4px;
  }
  .fav-filter-btn:not(.active) .fav-filter-count {
    background: var(--bg-hover);
  }

  .fav-sort-select {
    margin-inline-start: auto;
    padding: 8px 14px; border-radius: 99px;
    border: 1px solid var(--border); background: var(--bg-card);
    color: var(--text-main); font-family: var(--font); font-size: 13px;
    cursor: pointer; outline: none;
  }

  .fav-card-wrap {
    position: relative;
  }
  .fav-card-date {
    position: absolute;
    bottom: 8px;
    inset-inline-start: 12px;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-card);
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    pointer-events: none;
    z-index: 5;
  }
  .fav-remove-btn {
    position: absolute;
    bottom: 8px;
    inset-inline-end: 12px;
    padding: 4px 10px; font-size: 12px;
    border-radius: 8px; border: 1px solid rgba(239,68,68,0.3);
    background: rgba(239,68,68,0.08); color: #ef4444;
    cursor: pointer; font-family: var(--font); font-weight: 600;
    transition: var(--transition);
    z-index: 5;
  }
  .fav-remove-btn:hover { background: #ef4444; color: #fff; }

  /* ── Empty State ──────────────────────────────────────────────── */
  .fav-empty {
    text-align: center;
    padding: 80px 24px;
  }
  .fav-empty-anim {
    width: 120px; height: 120px; margin: 0 auto 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(139,92,246,0.06));
    border: 2px dashed rgba(239,68,68,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 52px;
    animation: fav-pulse 2.5s ease-in-out infinite;
  }
  @keyframes fav-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.15); }
    50%       { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(239,68,68,0); }
  }
  .fav-empty h3 { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
  .fav-empty p  { color: var(--text-secondary); font-size: 15px; max-width: 320px; margin: 0 auto 24px; line-height: 1.6; }

  /* ── Fav Grid extras ──────────────────────────────────────────── */
  .fav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }
  .fav-grid .service-card { padding-bottom: 44px; }

  /* ── Drawer fav link ──────────────────────────────────────────── */
  .fav-drawer-counter {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; border-radius: 9px;
    background: #ef4444; color: #fff;
    font-size: 11px; font-weight: 800; padding: 0 4px;
    margin-inline-start: 6px;
  }
  `;
  document.head.appendChild(style);

  // ── Helpers ────────────────────────────────────────────────────────
  function meDoc() {
    const me = State.currentUser; if (!me) return null;
    return (AppData.users || []).find(u => u.uid === me.uid || u.id === me.uid) || null;
  }
  function getFavIds() {
    const me = meDoc();
    return (me && Array.isArray(me.favorites)) ? me.favorites : [];
  }
  function getFavServices(section, sortBy) {
    const ids = getFavIds();
    let items = ids
      .map(id => (AppData.services || []).find(s => s.id === id))
      .filter(Boolean);
    if (section && section !== 'all') {
      const catIds = (AppData.cats || []).filter(c => c.section === section).map(c => c.id);
      items = items.filter(s => catIds.includes(s.catId));
    }
    if (sortBy === 'price_asc')  items.sort((a,b) => (a.price||0) - (b.price||0));
    if (sortBy === 'price_desc') items.sort((a,b) => (b.price||0) - (a.price||0));
    if (sortBy === 'name')       items.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'ar'));
    return items;
  }

  // ── Core toggle (uses same storage as phase18) ────────────────────
  window.favToggle = async function (svcId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const me = meDoc();
    if (!me) { toast('سجّل الدخول أولاً لإضافة للمفضلة', 'info'); return; }

    const cur = getFavIds().slice();
    const idx = cur.indexOf(svcId);
    const adding = idx < 0;
    if (adding) cur.push(svcId); else cur.splice(idx, 1);

    await fsUpdate('users', me.id, { favorites: cur });
    me.favorites = cur;

    // Animate the button without full re-render
    const btn = document.querySelector(`.fav-heart-btn[data-svc="${svcId}"]`);
    if (btn) {
      btn.classList.toggle('active', adding);
      btn.classList.add('pop');
      btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
    }

    // Update nav badge count
    _updateFavNavBadge();

    toast(adding ? '❤️ أُضيف للمفضلة' : '💔 أُزيل من المفضلة', adding ? 'success' : 'info');

    // If on favorites page, refresh
    if (State.currentPage === 'favorites') {
      await render();
    }
  };

  window.favIsFav = function (svcId) {
    return getFavIds().includes(svcId);
  };

  // ── Heart button HTML ─────────────────────────────────────────────
  window.favHeartBtn = function (svcId) {
    const isFav = favIsFav(svcId);
    return `<button
      class="fav-heart-btn${isFav ? ' active' : ''}"
      data-svc="${svcId}"
      title="${isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}"
      onclick="favToggle('${svcId}', event)">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
                 C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
                 c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke-linejoin="round"/>
      </svg>
    </button>`;
  };

  // ── Nav badge updater ─────────────────────────────────────────────
  function _updateFavNavBadge() {
    const count = getFavIds().length;
    document.querySelectorAll('.fav-nav-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count ? '' : 'none';
    });
    document.querySelectorAll('.fav-drawer-counter').forEach(el => {
      el.textContent = count;
      el.style.display = count ? '' : 'none';
    });
  }

  // ── Patch renderServiceCard — add heart ON TOP of gallery.js card ──
  // gallery.js (loaded before wishlist.js) defines a full renderServiceCard with
  // image cover, onclick→detail page, open/closed badge, distance badge, etc.
  // We MUST preserve that and only inject the heart button into it.
  const _origCard = window.renderServiceCard;
  window.renderServiceCard = function (s) {
    if (!s) return '';
    const u = State.currentUser;

    // Get the complete card HTML from gallery.js (or pages.js fallback)
    let html = typeof _origCard === 'function' ? _origCard(s) : '';
    if (!html) return '';

    // Only inject heart for customer / guest
    if (u && (u.role === 'customer' || u.role === 'guest')) {
      const heartBtn = favHeartBtn(s.id);
      // Insert heart inside the card's opening div, and ensure position:relative
      html = html.replace(
        /(<div class="service-card"[^>]*>)/,
        (match) => {
          let m = match;
          if (m.includes('style=')) {
            m = m.replace(/style="([^"]*)"/, (_, inner) => `style="${inner};position:relative"`);
          } else {
            m = m.slice(0, -1) + ' style="position:relative">';
          }
          return m + heartBtn;
        }
      );
    }

    return html;
  };

  // ── Patch _navItemsForRole to add Favorites link ──────────────────
  const _origNavItems = window._navItemsForRole;
  window._navItemsForRole = function (u) {
    const items = typeof _origNavItems === 'function' ? _origNavItems(u) : [];
    if (u && u.role === 'customer') {
      items.push({ page: 'favorites', icon: '❤️', label: 'مفضلتي' });
    }
    return items;
  };

  // ── Favorites Page ────────────────────────────────────────────────
  window.ExtraPages = window.ExtraPages || {};
  window.ExtraPages['favorites'] = function renderFavoritesPage() {
    const u = State.currentUser;
    if (!u || u.role === 'guest') {
      return `<div id="app-content"><div class="fav-empty">
        <div class="fav-empty-anim">🔒</div>
        <h3>تسجيل الدخول مطلوب</h3>
        <p>سجّل دخولك لتتمكن من حفظ خدماتك المفضلة والوصول إليها في أي وقت</p>
        <button class="btn btn-primary" onclick="navigate('login')">تسجيل الدخول</button>
      </div></div>`;
    }

    const activeSection = State.params?.favSection || 'all';
    const activeSort    = State.params?.favSort    || 'default';

    const sections = [
      { key: 'all',      label: 'الكل',       icon: '✨' },
      { key: 'bookings', label: 'الحجوزات',   icon: '📅' },
      { key: 'services', label: 'الخدمات',    icon: '🔧' },
      { key: 'stores',   label: 'المتاجر',    icon: '🏪' },
    ];

    // Build count per section
    const allIds = getFavIds();
    const allServices = allIds.map(id => (AppData.services || []).find(s => s.id === id)).filter(Boolean);
    function sectionCount(key) {
      if (key === 'all') return allServices.length;
      const catIds = (AppData.cats || []).filter(c => c.section === key).map(c => c.id);
      return allServices.filter(s => catIds.includes(s.catId)).length;
    }

    const items = getFavServices(activeSection, activeSort);
    const total = allIds.length;

    if (total === 0) {
      return `
      <div id="app-content">
        <div class="fav-page-hero">
          <div class="fav-page-hero-icon">❤️</div>
          <div class="fav-page-hero-text">
            <h2>المفضلة فارغة</h2>
            <p>لم تقم بإضافة أي خدمات بعد</p>
          </div>
        </div>
        <div class="fav-empty">
          <div class="fav-empty-anim">🤍</div>
          <h3>أضف خدماتك المفضلة</h3>
          <p>تصفّح الخدمات واضغط على زر ❤️ لحفظها هنا وتجدها دائماً في متناول يدك</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="navigate('listing',{section:'bookings'})">📅 الحجوزات</button>
            <button class="btn btn-secondary" onclick="navigate('listing',{section:'services'})">🔧 الخدمات</button>
            <button class="btn btn-secondary" onclick="navigate('listing',{section:'stores'})">🏪 المتاجر</button>
          </div>
        </div>
      </div>`;
    }

    return `
    <div id="app-content">

      <!-- Hero -->
      <div class="fav-page-hero">
        <div class="fav-page-hero-icon">❤️</div>
        <div class="fav-page-hero-text">
          <h2>مفضلتي (${total})</h2>
          <p>جميع الخدمات التي أضفتها للمفضلة في مكان واحد</p>
        </div>
        <div class="fav-page-hero-actions">
          <button class="btn btn-secondary btn-sm" onclick="favShare()" style="gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            مشاركة القائمة
          </button>
          <button class="btn btn-danger btn-sm" onclick="favClearAll()" style="gap:6px">
            🗑 مسح الكل
          </button>
        </div>
      </div>

      <!-- Filters + Sort -->
      <div class="fav-filters">
        ${sections.map(sec => {
          const cnt = sectionCount(sec.key);
          if (sec.key !== 'all' && cnt === 0) return '';
          return `<button
            class="fav-filter-btn${activeSection === sec.key ? ' active' : ''}"
            onclick="navigate('favorites',{favSection:'${sec.key}',favSort:'${activeSort}'})">
            ${sec.icon} ${sec.label}
            <span class="fav-filter-count">${cnt}</span>
          </button>`;
        }).join('')}

        <select class="fav-sort-select" onchange="navigate('favorites',{favSection:'${activeSection}',favSort:this.value})">
          <option value="default" ${activeSort==='default'?'selected':''}>الترتيب الافتراضي</option>
          <option value="price_asc" ${activeSort==='price_asc'?'selected':''}>السعر: الأقل أولاً</option>
          <option value="price_desc" ${activeSort==='price_desc'?'selected':''}>السعر: الأعلى أولاً</option>
          <option value="name" ${activeSort==='name'?'selected':''}>الاسم: أبجدي</option>
        </select>
      </div>

      <!-- Empty filter result -->
      ${items.length === 0 ? `
      <div class="fav-empty" style="padding:40px">
        <div style="font-size:48px;margin-bottom:16px">🔍</div>
        <h3 style="font-size:18px">لا توجد نتائج في هذا القسم</h3>
        <p>لم تضف خدمات من هذا القسم للمفضلة بعد</p>
        <button class="btn btn-secondary btn-sm" onclick="navigate('favorites',{favSection:'all',favSort:'${activeSort}'})">عرض الكل</button>
      </div>` : `

      <!-- Cards Grid -->
      <div class="fav-grid">
        ${items.map(s => `
        <div class="fav-card-wrap">
          ${renderServiceCard(s)}
          <button class="fav-remove-btn" onclick="favToggle('${s.id}', event)">✕ إزالة</button>
        </div>`).join('')}
      </div>`}

    </div>`;
  };

  // ── Share Wishlist ────────────────────────────────────────────────
  window.favShare = async function () {
    const items = getFavServices('all', 'default');
    const lines = items.map(s => `• ${s.icon || '🔷'} ${s.name}${s.price ? ' — ' + s.price + ' ريال' : ''}`).join('\n');
    const text  = `❤️ قائمة مفضلتي على محجوز:\n\n${lines}\n\n🔗 ${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'مفضلتي على محجوز', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast('✅ تم نسخ القائمة للحافظة', 'success');
      }
    } catch (e) {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast('تم نسخ القائمة', 'success');
    }
  };

  // ── Clear All Favorites ───────────────────────────────────────────
  window.favClearAll = function () {
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">🗑 مسح المفضلة</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px;line-height:1.7">
        هل تريد مسح جميع الخدمات من مفضلتك؟<br>
        <span style="color:#ef4444;font-weight:700">لا يمكن التراجع عن هذا الإجراء.</span>
      </p>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-danger" onclick="_favDoClear()">🗑 مسح الكل</button>
      </div>`);
  };
  window._favDoClear = async function () {
    const me = meDoc(); if (!me) return;
    await fsUpdate('users', me.id, { favorites: [] });
    me.favorites = [];
    closeModal();
    toast('تم مسح المفضلة', 'info');
    await render();
  };

  // ── Remove old phase18 heart injection interval (avoid conflict) ──
  // We overwrite the ph18_toggleFav to use our logic seamlessly
  window.ph18_isFav    = window.favIsFav;
  window.ph18_toggleFav = window.favToggle;

  // ── On render: update nav badge ───────────────────────────────────
  const _origRender = window.render;
  if (typeof _origRender === 'function') {
    window.render = async function () {
      await _origRender.apply(this, arguments);
      setTimeout(_updateFavNavBadge, 50);
    };
  }

  console.log('[Wishlist] نظام المفضلة الاحترافي جاهز ❤️');
})();
