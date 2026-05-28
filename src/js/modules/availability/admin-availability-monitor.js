/* ============================================================
   Admin Availability Monitor — مراقبة حالة الإتاحة للإدارة
   ------------------------------------------------------------
   يعرض للمدير حالة جميع المزودين والمندوبين (في الخدمة / خارجها)
   مع تنبيهات للمستخدمين الذين غادروا الخدمة لفترة طويلة
   ============================================================ */
(function () {
  'use strict';

  /* ── CSS ──────────────────────────────────────────── */
  const css = `
  .aam-wrap {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
    font-family: 'Cairo', sans-serif;
  }

  .aam-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 22px;
  }

  .aam-title {
    font-size: 20px;
    font-weight: 900;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .aam-refresh-btn {
    background: var(--card-bg, #1e1e2e);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .aam-refresh-btn:hover { background: var(--hover-bg, #2a2a3e); }

  /* ─── أدوات الفلترة والبحث ─── */
  .aam-controls {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
    align-items: center;
  }

  .aam-search {
    flex: 1;
    min-width: 200px;
    background: var(--card-bg, #1e1e2e);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 14px;
    color: var(--text);
    font-size: 13px;
    font-family: 'Cairo', sans-serif;
    outline: none;
  }
  .aam-search::placeholder { color: var(--text-muted); }

  .aam-filter-btn {
    background: var(--card-bg, #1e1e2e);
    border: 1.5px solid var(--border);
    color: var(--text-muted);
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: all 0.2s;
  }
  .aam-filter-btn.active { border-color: #7c3aed; color: #7c3aed; background: rgba(124,58,237,0.08); }
  .aam-filter-btn.warn-active { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.08); }

  /* ─── بطاقات الملخص ─── */
  .aam-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 22px;
  }

  .aam-stat-card {
    background: var(--card-bg, #1e1e2e);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    text-align: center;
    transition: border-color 0.2s;
  }
  .aam-stat-card.online  { border-color: rgba(16,185,129,0.4); }
  .aam-stat-card.offline { border-color: rgba(239,68,68,0.4); }
  .aam-stat-card.warning { border-color: rgba(251,191,36,0.5); }

  .aam-stat-num {
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 4px;
  }
  .aam-stat-card.online  .aam-stat-num { color: #10b981; }
  .aam-stat-card.offline .aam-stat-num { color: #ef4444; }
  .aam-stat-card.warning .aam-stat-num { color: #fbbf24; }
  .aam-stat-card.total   .aam-stat-num { color: #7c3aed; }

  .aam-stat-label {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
  }

  /* ─── تنبيهات الغياب الطويل ─── */
  .aam-alerts-box {
    background: rgba(239,68,68,0.05);
    border: 1.5px solid rgba(239,68,68,0.2);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 20px;
  }
  .aam-alerts-title {
    font-size: 14px;
    font-weight: 800;
    color: #ef4444;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .aam-alert-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(239,68,68,0.06);
    border-radius: 10px;
    margin-bottom: 8px;
    font-size: 12.5px;
  }
  .aam-alert-item:last-child { margin-bottom: 0; }
  .aam-alert-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(239,68,68,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .aam-alert-name { font-weight: 800; color: var(--text); }
  .aam-alert-sub  { color: #ef4444; font-size: 11px; margin-top: 1px; }
  .aam-alert-badge {
    margin-right: auto;
    background: rgba(239,68,68,0.15);
    color: #ef4444;
    border-radius: 8px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  /* ─── قسم المزودين / المندوبين ─── */
  .aam-section-title {
    font-size: 14px;
    font-weight: 800;
    color: var(--text);
    margin: 20px 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .aam-section-count {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px 9px;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 700;
  }

  /* ─── قائمة المستخدمين ─── */
  .aam-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .aam-card {
    background: var(--card-bg, #1e1e2e);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
    overflow: hidden;
  }
  .aam-card.is-online  { border-color: rgba(16,185,129,0.35); }
  .aam-card.is-offline { border-color: rgba(239,68,68,0.25); }
  .aam-card.is-warning { border-color: rgba(251,191,36,0.45); box-shadow: 0 0 0 1px rgba(251,191,36,0.15); }

  .aam-card-avatar {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--hover-bg, #2a2a3e);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
    position: relative;
  }
  .aam-card-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    object-fit: cover;
  }

  /* نقطة الحالة */
  .aam-status-dot {
    position: absolute;
    bottom: -2px;
    left: -2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid var(--card-bg, #1e1e2e);
  }
  .aam-card.is-online  .aam-status-dot { background: #10b981; }
  .aam-card.is-offline .aam-status-dot { background: #6b7280; }
  .aam-card.is-warning .aam-status-dot { background: #fbbf24; }

  .aam-card-info { flex: 1; min-width: 0; }
  .aam-card-name {
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .aam-card-role {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 1px;
  }
  .aam-card-time {
    font-size: 11px;
    margin-top: 4px;
    font-weight: 600;
  }
  .aam-card.is-online  .aam-card-time { color: #10b981; }
  .aam-card.is-offline .aam-card-time { color: #9ca3af; }
  .aam-card.is-warning .aam-card-time { color: #fbbf24; }

  .aam-card-status {
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .aam-card.is-online  .aam-card-status { background: rgba(16,185,129,0.12); color: #10b981; }
  .aam-card.is-offline .aam-card-status { background: rgba(107,114,128,0.12); color: #9ca3af; }
  .aam-card.is-warning .aam-card-status { background: rgba(251,191,36,0.12); color: #fbbf24; }

  /* شريط الوقت */
  .aam-offline-bar {
    position: absolute;
    bottom: 0;
    right: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(to left, #fbbf24, #ef4444);
    opacity: 0.5;
  }

  /* حالة فارغة */
  .aam-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 14px;
    grid-column: 1/-1;
  }

  /* Real-time نبضة */
  @keyframes aam-live-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .aam-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
    animation: aam-live-pulse 1.5s infinite;
    margin-left: 6px;
  }

  @media (max-width: 600px) {
    .aam-wrap { padding: 12px; }
    .aam-list { grid-template-columns: 1fr; }
    .aam-summary { grid-template-columns: repeat(2, 1fr); }
  }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'aam-styles';
  if (!document.getElementById('aam-styles')) {
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  /* ── ثوابت ──────────────────────────────────────── */
  const WARN_HOURS  = 3;   // ساعات الغياب التي تُطلق التنبيه
  const WARN_MS     = WARN_HOURS * 60 * 60 * 1000;

  /* ── حساب مدة الغياب ────────────────────────────── */
  function _getOfflineMs(user) {
    if (user.isOnline !== false) return 0;
    const ts = user.onlineUpdatedAt;
    if (!ts) return 0;
    let d;
    if (ts.toDate)   d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d)) return 0;
    return Date.now() - d.getTime();
  }

  function _fmtDuration(ms) {
    if (!ms || ms <= 0) return '';
    const totalMins = Math.floor(ms / 60000);
    if (totalMins < 60) return `منذ ${totalMins} دقيقة`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `منذ ${hrs} س ${mins} د` : `منذ ${hrs} ساعة`;
  }

  function _fmtLastSeen(user) {
    if (user.isOnline !== false) {
      const ts = user.onlineUpdatedAt;
      if (!ts) return 'في الخدمة';
      let d;
      if (ts.toDate) d = ts.toDate();
      else if (ts.seconds) d = new Date(ts.seconds * 1000);
      else d = new Date(ts);
      if (isNaN(d)) return 'في الخدمة';
      return `متصل منذ ${d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const ms = _getOfflineMs(user);
    return ms ? _fmtDuration(ms) : 'خارج الخدمة';
  }

  /* ── بناء بطاقة مستخدم ───────────────────────────── */
  function _buildCard(user, type) {
    const isOnline  = user.isOnline !== false;
    const offlineMs = _getOfflineMs(user);
    const isWarning = !isOnline && offlineMs >= WARN_MS;
    const cls       = isOnline ? 'is-online' : (isWarning ? 'is-warning' : 'is-offline');
    const name      = user.displayName || user.name || user.email || '—';
    const roleLabel = type === 'driver' ? '🚗 مندوب توصيل' : '🏪 مزود خدمة';
    const timeLabel = _fmtLastSeen(user);
    const statusLabel = isOnline ? 'في الخدمة' : (isWarning ? 'غائب طويلاً' : 'خارج الخدمة');
    const avatar = user.photoURL
      ? `<img src="${user.photoURL}" alt="${name}" onerror="this.parentElement.innerHTML='${type === 'driver' ? '🚗' : '🏪'}'"/>`
      : (type === 'driver' ? '🚗' : '🏪');

    return `
    <div class="aam-card ${cls}" title="${name}">
      <div class="aam-card-avatar">
        ${avatar}
        <span class="aam-status-dot"></span>
      </div>
      <div class="aam-card-info">
        <div class="aam-card-name">${name}</div>
        <div class="aam-card-role">${roleLabel}</div>
        <div class="aam-card-time">${timeLabel}</div>
      </div>
      <div class="aam-card-status">${statusLabel}</div>
      ${isWarning ? '<div class="aam-offline-bar"></div>' : ''}
    </div>`;
  }

  /* ── إنشاء قسم التنبيهات ─────────────────────────── */
  function _buildAlerts(vendors, drivers) {
    const all = [
      ...vendors.map(u => ({ ...u, _type: 'vendor' })),
      ...drivers.map(u => ({ ...u, _type: 'driver' }))
    ];
    const warned = all.filter(u => {
      if (u.isOnline !== false) return false;
      return _getOfflineMs(u) >= WARN_MS;
    }).sort((a, b) => _getOfflineMs(b) - _getOfflineMs(a));

    if (!warned.length) return '';

    const items = warned.map(u => {
      const name     = u.displayName || u.name || u.email || '—';
      const offMs    = _getOfflineMs(u);
      const duration = _fmtDuration(offMs);
      const icon     = u._type === 'driver' ? '🚗' : '🏪';
      const roleLabel = u._type === 'driver' ? 'مندوب' : 'مزود خدمة';
      return `
      <div class="aam-alert-item">
        <div class="aam-alert-avatar">${icon}</div>
        <div>
          <div class="aam-alert-name">${name}</div>
          <div class="aam-alert-sub">${roleLabel} — خارج الخدمة</div>
        </div>
        <span class="aam-alert-badge">⚠️ ${duration}</span>
      </div>`;
    }).join('');

    return `
    <div class="aam-alerts-box" id="aam-alerts-box">
      <div class="aam-alerts-title">⚠️ تنبيهات الغياب (أكثر من ${WARN_HOURS} ساعات) <span class="aam-section-count">${warned.length}</span></div>
      ${items}
    </div>`;
  }

  /* ── الدالة الرئيسية: عرض اللوحة ─────────────────── */
  window.renderAdminAvailabilityMonitor = function () {
    const users   = AppData.users || [];
    const vendors = users.filter(u => u.role === 'vendor' || u.role === 'provider');
    const drivers = users.filter(u => u.role === 'driver');

    const vendorOnline  = vendors.filter(u => u.isOnline !== false).length;
    const vendorOffline = vendors.length - vendorOnline;
    const driverOnline  = drivers.filter(u => u.isOnline !== false).length;
    const driverOffline = drivers.length - driverOnline;

    const totalWarning = [...vendors, ...drivers].filter(u => {
      return u.isOnline === false && _getOfflineMs(u) >= WARN_MS;
    }).length;

    const alertsHtml  = _buildAlerts(vendors, drivers);

    return `
    <div class="aam-wrap" id="aam-wrap">

      <!-- ─── الرأس ─── -->
      <div class="aam-header">
        <div class="aam-title">
          📡 مراقبة حالة الإتاحة
          <span class="aam-live-dot" title="تحديث فوري"></span>
        </div>
        <button class="aam-refresh-btn" onclick="aamRefresh()">🔄 تحديث</button>
      </div>

      <!-- ─── بطاقات الملخص ─── -->
      <div class="aam-summary">
        <div class="aam-stat-card online">
          <div class="aam-stat-num">${vendorOnline}</div>
          <div class="aam-stat-label">مزودون في الخدمة</div>
        </div>
        <div class="aam-stat-card offline">
          <div class="aam-stat-num">${vendorOffline}</div>
          <div class="aam-stat-label">مزودون خارج الخدمة</div>
        </div>
        <div class="aam-stat-card online">
          <div class="aam-stat-num">${driverOnline}</div>
          <div class="aam-stat-label">مندوبون في الخدمة</div>
        </div>
        <div class="aam-stat-card offline">
          <div class="aam-stat-num">${driverOffline}</div>
          <div class="aam-stat-label">مندوبون خارج الخدمة</div>
        </div>
        ${totalWarning > 0 ? `
        <div class="aam-stat-card warning">
          <div class="aam-stat-num">${totalWarning}</div>
          <div class="aam-stat-label">غائبون +${WARN_HOURS} ساعات</div>
        </div>` : ''}
      </div>

      <!-- ─── أدوات البحث والفلترة ─── -->
      <div class="aam-controls">
        <input class="aam-search" id="aam-search" type="text"
               placeholder="🔍 بحث بالاسم أو البريد..."
               oninput="aamSearch(this.value)" />
        <button class="aam-filter-btn active" id="aam-f-all"    onclick="aamFilter('all')">الكل</button>
        <button class="aam-filter-btn"        id="aam-f-online" onclick="aamFilter('online')">🟢 في الخدمة</button>
        <button class="aam-filter-btn"        id="aam-f-offline" onclick="aamFilter('offline')">🔴 خارج الخدمة</button>
        ${totalWarning > 0 ? `<button class="aam-filter-btn warn-active" id="aam-f-warn" onclick="aamFilter('warning')">⚠️ غائبون طويلاً</button>` : ''}
      </div>

      <!-- ─── تنبيهات الغياب ─── -->
      ${alertsHtml}

      <!-- ─── قسم المزودين ─── -->
      <div class="aam-section-title" id="aam-vendors-title">
        🏪 مزودو الخدمة
        <span class="aam-section-count">${vendors.length}</span>
      </div>
      <div class="aam-list" id="aam-vendors-list">
        ${vendors.length
          ? vendors
              .sort((a, b) => {
                const aOn = a.isOnline !== false;
                const bOn = b.isOnline !== false;
                if (aOn !== bOn) return aOn ? -1 : 1;
                return _getOfflineMs(b) - _getOfflineMs(a);
              })
              .map(u => _buildCard(u, 'vendor'))
              .join('')
          : '<div class="aam-empty">لا يوجد مزودو خدمة مسجلون</div>'
        }
      </div>

      <!-- ─── قسم المندوبين ─── -->
      <div class="aam-section-title" id="aam-drivers-title">
        🚗 المندوبون
        <span class="aam-section-count">${drivers.length}</span>
      </div>
      <div class="aam-list" id="aam-drivers-list">
        ${drivers.length
          ? drivers
              .sort((a, b) => {
                const aOn = a.isOnline !== false;
                const bOn = b.isOnline !== false;
                if (aOn !== bOn) return aOn ? -1 : 1;
                return _getOfflineMs(b) - _getOfflineMs(a);
              })
              .map(u => _buildCard(u, 'driver'))
              .join('')
          : '<div class="aam-empty">لا يوجد مندوبون مسجلون</div>'
        }
      </div>

    </div>`;
  };

  /* ── تحديث يدوي ─────────────────────────────────── */
  window.aamRefresh = function () {
    const wrap = document.getElementById('aam-wrap');
    if (!wrap) return;
    wrap.style.opacity = '0.5';
    setTimeout(() => {
      const parent = wrap.parentElement;
      if (parent) parent.innerHTML = window.renderAdminAvailabilityMonitor();
    }, 200);
  };

  /* ── بحث ────────────────────────────────────────── */
  let _aamCurrentFilter = 'all';
  let _aamCurrentSearch = '';

  window.aamSearch = function (q) {
    _aamCurrentSearch = (q || '').trim().toLowerCase();
    _aamApplyFilter();
  };

  window.aamFilter = function (f) {
    _aamCurrentFilter = f;
    document.querySelectorAll('.aam-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`aam-f-${f}`);
    if (activeBtn) activeBtn.classList.add('active');
    _aamApplyFilter();
  };

  function _aamApplyFilter() {
    const cards = document.querySelectorAll('.aam-card');
    cards.forEach(card => {
      const name  = (card.querySelector('.aam-card-name')?.textContent || '').toLowerCase();
      const time  = (card.querySelector('.aam-card-time')?.textContent  || '').toLowerCase();

      const matchSearch = !_aamCurrentSearch ||
        name.includes(_aamCurrentSearch) ||
        time.includes(_aamCurrentSearch);

      let matchFilter = true;
      if (_aamCurrentFilter === 'online')  matchFilter = card.classList.contains('is-online');
      if (_aamCurrentFilter === 'offline') matchFilter = card.classList.contains('is-offline');
      if (_aamCurrentFilter === 'warning') matchFilter = card.classList.contains('is-warning');

      card.style.display = (matchSearch && matchFilter) ? '' : 'none';
    });
  }

  /* ── تحديث تلقائي كل دقيقة (لتحديث مدة الغياب) ─── */
  let _aamAutoTimer = null;

  function _startAutoRefresh() {
    _stopAutoRefresh();
    _aamAutoTimer = setInterval(() => {
      if (!document.getElementById('aam-wrap')) {
        _stopAutoRefresh();
        return;
      }
      aamRefresh();
    }, 60 * 1000);
  }

  function _stopAutoRefresh() {
    if (_aamAutoTimer) { clearInterval(_aamAutoTimer); _aamAutoTimer = null; }
  }

  /* نبدأ التحديث التلقائي عند أول عرض */
  const _origRender = window.renderAdminAvailabilityMonitor;
  window.renderAdminAvailabilityMonitor = function () {
    const html = _origRender();
    setTimeout(_startAutoRefresh, 500);
    return html;
  };

  console.log('[AdminAvailabilityMonitor] نظام مراقبة الإتاحة للإدارة جاهز ✅');
})();
