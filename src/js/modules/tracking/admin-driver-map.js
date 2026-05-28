/* ============================================================
   Admin Driver Map — خريطة تتبع المندوبين الحيّة
   ------------------------------------------------------------
   تُظهر للمدير جميع المندوبين النشطين على خريطة Google Maps
   مع تحديث تلقائي كل 5 ثوانٍ من AppData.orders (المُحدَّثة
   بالفعل عبر onSnapshot في realtime-alerts.js).

   كل مندوب له marker ملوّن:
     🟢 مع_المندوب  (with_driver  — في الطريق للتسليم)
     🟠 مقبول       (accepted      — متجه لنقطة الاستلام)
     🔵 يبث         (isBroadcasting)

   الإجراءات المتاحة في الـ popup:
     📨 مراسلة المندوب (يستدعي adminSendDriverMessage)
     🗺️ Google Maps    (رابط خارجي للموقع)
   ============================================================ */
(function () {
  'use strict';

  /* ── حالة داخلية ────────────────────────────────── */
  const ADM = {
    map:        null,
    markers:    {},   // orderId → google.maps.Marker
    infoWindows:{},   // orderId → google.maps.InfoWindow
    openInfo:   null, // InfoWindow المفتوح حالياً
    timer:      null,
    unsub:      null,
  };
  window._ADM = ADM;

  /* ── أدوات مساعدة ─────────────────────────────── */
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
    );
  }

  function fmtAgo(ts) {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const s = Math.round((Date.now() - d.getTime()) / 1000);
      if (s <  60) return `منذ ${s} ث`;
      if (s < 3600) return `منذ ${Math.round(s/60)} د`;
      return `منذ ${Math.round(s/3600)} س`;
    } catch (e) { return '—'; }
  }

  const STATUS_LABEL = {
    accepted:   '🟠 متجه للاستلام',
    with_driver:'🟢 في الطريق للتسليم',
    pending:    '⏳ انتظار',
    delivered:  '📦 تم التسليم',
    completed:  '✅ مكتمل',
  };

  /* ── SVG markers ──────────────────────────────── */
  function svgUrl(color, emoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
      <ellipse cx="22" cy="48" rx="10" ry="4" fill="rgba(0,0,0,0.2)"/>
      <path d="M22 2 C11.5 2 3 10.5 3 21 C3 34 22 50 22 50 C22 50 41 34 41 21 C41 10.5 32.5 2 22 2Z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="22" y="27" text-anchor="middle" font-size="16">${emoji}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function markerIcon(order) {
    if (order.isBroadcasting && order.status === 'with_driver')
      return svgUrl('#10b981', '🚗');
    if (order.status === 'with_driver')
      return svgUrl('#0d9488', '🚚');
    if (order.isBroadcasting)
      return svgUrl('#f59e0b', '📡');
    return svgUrl('#8b5cf6', '🚗');
  }

  /* ── HTML popup ────────────────────────────────── */
  function popupHTML(o) {
    const driverEntry = (AppData.ddbEntries || []).find(e => e.linkedUserId === o.driverId);
    const driverName  = o.driverName || driverEntry?.name || 'مندوب';
    const driverPhone = driverEntry?.phone || o.driverPhone || '';
    const status      = STATUS_LABEL[o.status] || o.status || '—';
    const lastUpd     = fmtAgo(o.lastLocationAt);
    const lat         = o.driverLat?.toFixed(5);
    const lng         = o.driverLng?.toFixed(5);
    const mapsLink    = `https://www.google.com/maps?q=${o.driverLat},${o.driverLng}`;

    const linkedUid = driverEntry?.linkedUserId || o.driverId || '';

    return `
    <div style="font-family:'Cairo',sans-serif;direction:rtl;min-width:220px;max-width:260px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;flex-shrink:0">
          ${esc(driverName.charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-size:14px;font-weight:900;color:#111">${esc(driverName)}</div>
          <div style="font-size:11px;color:#6b7280">${esc(status)}</div>
        </div>
      </div>

      <div style="background:#f9fafb;border-radius:8px;padding:8px 10px;font-size:12px;color:#374151;display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
        <div>📦 طلب: <strong>#${esc(o.orderId || o.id?.slice(-6) || '—')}</strong></div>
        ${o.customerName ? `<div>👤 ${esc(o.customerName)}</div>` : ''}
        ${o.customerAddr ? `<div>📍 ${esc(o.customerAddr)}</div>` : ''}
        <div>🕐 آخر تحديث: <strong>${lastUpd}</strong></div>
        <div>📡 ${o.isBroadcasting ? '<span style="color:#10b981;font-weight:700">يبث موقعه الآن ●</span>' : '<span style="color:#9ca3af">البث متوقف</span>'}</div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a href="${mapsLink}" target="_blank" rel="noopener"
           style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;background:#1a73e8;color:#fff;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;text-decoration:none;font-family:'Cairo',sans-serif">
          🗺️ خرائط
        </a>
        ${driverPhone ? `
        <a href="tel:${esc(driverPhone)}"
           style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;text-decoration:none;font-family:'Cairo',sans-serif">
          📞 اتصال
        </a>` : ''}
        ${linkedUid ? `
        <button onclick="adminSendDriverMessage('${esc(linkedUid)}','${esc(driverName)}')"
                style="flex:1;background:rgba(124,58,237,0.1);color:#7c3aed;border:1px solid rgba(124,58,237,0.3);border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
          📨 راسله
        </button>` : ''}
      </div>
    </div>`;
  }

  /* ── تهيئة الخريطة ─────────────────────────────── */
  window.adminDriverMap_init = function () {
    const el = document.getElementById('adm-map');
    if (!el || typeof google === 'undefined') {
      setTimeout(adminDriverMap_init, 600);
      return;
    }

    // مركز افتراضي: اليمن
    ADM.map = new google.maps.Map(el, {
      center: { lat: 15.3694, lng: 44.1910 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    adminDriverMap_refresh();
    clearInterval(ADM.timer);
    ADM.timer = setInterval(adminDriverMap_refresh, 5000);
  };

  /* ── تحديث الـ markers ──────────────────────────── */
  window.adminDriverMap_refresh = function () {
    if (!ADM.map) return;

    const activeOrders = (AppData.orders || []).filter(o =>
      ['accepted','with_driver'].includes(o.status) &&
      o.driverId && o.driverLat && o.driverLng
    );

    const seen = new Set();

    activeOrders.forEach(o => {
      seen.add(o.id);
      const pos = { lat: o.driverLat, lng: o.driverLng };

      if (ADM.markers[o.id]) {
        ADM.markers[o.id].setPosition(pos);
        ADM.markers[o.id].setIcon({ url: markerIcon(o), scaledSize: new google.maps.Size(44, 52), anchor: new google.maps.Point(22, 50) });
        if (ADM.infoWindows[o.id]) ADM.infoWindows[o.id].setContent(popupHTML(o));
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: ADM.map,
          icon: { url: markerIcon(o), scaledSize: new google.maps.Size(44, 52), anchor: new google.maps.Point(22, 50) },
          title: o.driverName || `طلب #${o.orderId || o.id.slice(-6)}`,
          animation: google.maps.Animation.DROP,
        });
        const iw = new google.maps.InfoWindow({ content: popupHTML(o), maxWidth: 280 });
        marker.addListener('click', () => {
          if (ADM.openInfo) ADM.openInfo.close();
          iw.open(ADM.map, marker);
          ADM.openInfo = iw;
          iw.setContent(popupHTML(o));
        });
        ADM.markers[o.id]     = marker;
        ADM.infoWindows[o.id] = iw;
      }
    });

    // أزل markers الطلبات المنتهية
    Object.keys(ADM.markers).forEach(id => {
      if (!seen.has(id)) {
        ADM.markers[id].setMap(null);
        try { ADM.infoWindows[id]?.close(); } catch (e) {}
        delete ADM.markers[id];
        delete ADM.infoWindows[id];
      }
    });

    // اضبط المنظور ليشمل جميع المندوبين
    if (activeOrders.length > 0 && Object.keys(ADM.markers).length > 0) {
      const bounds = new google.maps.LatLngBounds();
      activeOrders.forEach(o => bounds.extend({ lat: o.driverLat, lng: o.driverLng }));
      if (activeOrders.length === 1) {
        ADM.map.setCenter({ lat: activeOrders[0].driverLat, lng: activeOrders[0].driverLng });
        ADM.map.setZoom(14);
      } else {
        ADM.map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    }

    // حدّث اللوحة الجانبية
    _refreshSidePanel(activeOrders);
  };

  /* ── اللوحة الجانبية ───────────────────────────── */
  function _refreshSidePanel(activeOrders) {
    const panel = document.getElementById('adm-side-panel');
    if (!panel) return;

    if (activeOrders.length === 0) {
      panel.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:#9ca3af">
          <div style="font-size:36px;margin-bottom:10px">🚗</div>
          <div style="font-size:13px">لا يوجد مندوبون نشطون حالياً</div>
        </div>`;
      return;
    }

    panel.innerHTML = activeOrders.map(o => {
      const driverEntry = (AppData.ddbEntries || []).find(e => e.linkedUserId === o.driverId);
      const name   = o.driverName || driverEntry?.name || 'مندوب';
      const phone  = driverEntry?.phone || o.driverPhone || '';
      const status = STATUS_LABEL[o.status] || o.status;
      const linked = driverEntry?.linkedUserId || o.driverId || '';

      return `
      <div onclick="adminDriverMap_focusOrder('${o.id}')"
           style="padding:12px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background 0.15s;display:flex;gap:12px;align-items:flex-start"
           onmouseover="this.style.background='rgba(139,92,246,0.05)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0">
          ${esc(name.charAt(0).toUpperCase())}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800;color:#111;font-family:'Cairo',sans-serif">${esc(name)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;font-family:'Cairo',sans-serif">${esc(status)}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:1px;font-family:'Cairo',sans-serif">طلب #${esc(o.orderId || o.id.slice(-6))}</div>
          ${o.isBroadcasting ? `<div style="font-size:10px;color:#10b981;margin-top:2px;font-family:'Cairo',sans-serif">● يبث موقعه الآن</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${phone ? `<a href="tel:${esc(phone)}" onclick="event.stopPropagation()" style="font-size:11px;color:#10b981;text-decoration:none">📞</a>` : ''}
          ${linked ? `<button onclick="event.stopPropagation();adminSendDriverMessage('${esc(linked)}','${esc(name)}')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0" title="مراسلة">📨</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  window.adminDriverMap_focusOrder = function (orderId) {
    const o = (AppData.orders || []).find(x => x.id === orderId);
    if (!o || !o.driverLat || !ADM.map) return;
    ADM.map.setCenter({ lat: o.driverLat, lng: o.driverLng });
    ADM.map.setZoom(15);
    const marker = ADM.markers[orderId];
    const iw     = ADM.infoWindows[orderId];
    if (marker && iw) {
      if (ADM.openInfo) ADM.openInfo.close();
      iw.open(ADM.map, marker);
      ADM.openInfo = iw;
    }
  };

  /* ── cleanup ────────────────────────────────────── */
  window.adminDriverMap_destroy = function () {
    clearInterval(ADM.timer);
    ADM.timer = null;
    Object.values(ADM.markers).forEach(m => m.setMap(null));
    ADM.markers     = {};
    ADM.infoWindows = {};
    ADM.openInfo    = null;
    try { ADM.map && ADM.map.unbindAll && ADM.map.unbindAll(); } catch (e) {}
    ADM.map = null;
  };

  /* ══════════════════════════════════════════════════
     renderAdminLiveTracking — يُستدعى من dashboards.js
  ══════════════════════════════════════════════════ */
  const STYLE_ID = 'adm-map-styles';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #adm-wrap {
        display: flex; gap: 0; height: calc(100vh - 110px); min-height: 500px;
        border-radius: 18px; overflow: hidden;
        border: 1.5px solid var(--border, #e5e7eb);
        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        font-family: 'Cairo', sans-serif; direction: rtl;
      }
      #adm-side {
        width: 280px; flex-shrink: 0;
        background: var(--bg-card, #fff);
        border-left: 1.5px solid var(--border, #e5e7eb);
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      #adm-side-header {
        padding: 14px 16px 10px;
        border-bottom: 1.5px solid var(--border, #e5e7eb);
        background: var(--bg-card, #fff);
        flex-shrink: 0;
      }
      #adm-side-title {
        font-size: 14px; font-weight: 900;
        color: var(--text-main, #111);
        display: flex; align-items: center; justify-content: space-between;
      }
      #adm-side-sub {
        font-size: 11px; color: var(--text-muted, #9ca3af); margin-top: 3px;
      }
      #adm-side-panel { flex: 1; overflow-y: auto; }
      #adm-map-wrap   { flex: 1; position: relative; }
      #adm-map        { width: 100%; height: 100%; }
      #adm-refresh-badge {
        position: absolute; top: 12px; right: 12px; z-index: 10;
        background: rgba(0,0,0,0.6); color: #fff; border-radius: 20px;
        padding: 4px 10px; font-size: 11px; font-family: 'Cairo',sans-serif;
        pointer-events: none;
      }
      #adm-no-map {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; background: var(--bg-card,#fff);
        color: var(--text-muted,#9ca3af); text-align: center; padding: 20px;
      }
      @media (max-width: 640px) {
        #adm-wrap { flex-direction: column; height: auto; }
        #adm-side { width: 100%; border-left: none; border-top: 1.5px solid var(--border,#e5e7eb); max-height: 260px; }
        #adm-map-wrap { min-height: 300px; }
      }
    `;
    document.head.appendChild(s);
  }

  window.renderAdminLiveTracking = function () {
    ensureStyles();
    adminDriverMap_destroy();

    const activeOrders = (AppData.orders || []).filter(o =>
      ['accepted','with_driver'].includes(o.status) && o.driverId
    );
    const broadcasting = activeOrders.filter(o => o.isBroadcasting).length;
    const withLoc      = activeOrders.filter(o => o.driverLat && o.driverLng).length;

    // حدد ما إذا كانت Google Maps محملة
    const mapsAvailable = typeof google !== 'undefined' && typeof google.maps !== 'undefined';

    setTimeout(() => {
      if (mapsAvailable) adminDriverMap_init();
    }, 200);

    return `
    <div style="padding:20px 20px 8px;max-width:1200px;margin:0 auto">
      <!-- رأس الصفحة -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:900;color:var(--text-main)">🗺️ التتبع المباشر للمندوبين</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0">مواقع المندوبين تتحدث تلقائياً كل 5 ثوانٍ</p>
        </div>
        <button onclick="adminDriverMap_refresh()"
                style="display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.1);border:1.5px solid rgba(139,92,246,0.3);color:#7c3aed;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
          🔄 تحديث الآن
        </button>
      </div>

      <!-- إحصائيات سريعة -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        ${[
          ['🚗', 'مندوبون نشطون', activeOrders.length, '#8b5cf6'],
          ['📡', 'يبثون الآن',    broadcasting,        '#10b981'],
          ['📍', 'بموقع محدد',    withLoc,             '#0d9488'],
        ].map(([ic, label, val, color]) => `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:10px 16px;min-width:120px;flex:1">
          <div style="font-size:20px;margin-bottom:4px">${ic}</div>
          <div style="font-size:22px;font-weight:900;color:${color}">${val}</div>
          <div style="font-size:12px;color:var(--text-muted)">${label}</div>
        </div>`).join('')}
      </div>

      <!-- الخريطة + اللوحة الجانبية -->
      <div id="adm-wrap">
        <!-- اللوحة الجانبية -->
        <aside id="adm-side">
          <div id="adm-side-header">
            <div id="adm-side-title">
              <span>قائمة المندوبين</span>
              <span style="background:rgba(139,92,246,0.1);color:#8b5cf6;border-radius:99px;padding:2px 8px;font-size:11px">${activeOrders.length}</span>
            </div>
            <div id="adm-side-sub">اضغط على مندوب للتركيز عليه في الخريطة</div>
          </div>
          <div id="adm-side-panel">
            ${activeOrders.length === 0 ? `
            <div style="text-align:center;padding:40px 16px;color:var(--text-muted,#9ca3af)">
              <div style="font-size:36px;margin-bottom:10px">🚗</div>
              <div style="font-size:13px">لا يوجد مندوبون نشطون حالياً</div>
              <div style="font-size:11px;margin-top:6px;color:#d1d5db">الطلبات المقبولة وقيد التوصيل تظهر هنا</div>
            </div>` : ''}
          </div>
        </aside>

        <!-- الخريطة -->
        <div id="adm-map-wrap">
          <div id="adm-map"></div>
          <div id="adm-refresh-badge">🔄 تحديث تلقائي كل 5 ث</div>

          ${!mapsAvailable ? `
          <div id="adm-no-map">
            <div style="font-size:48px;margin-bottom:16px">🗺️</div>
            <h3 style="font-family:'Cairo',sans-serif;font-size:16px;font-weight:800;margin-bottom:8px;color:var(--text-secondary,#374151)">جاري تحميل خرائط Google...</h3>
            <p style="font-size:13px;font-family:'Cairo',sans-serif">ستظهر الخريطة خلال ثوانٍ</p>
            <button onclick="adminDriverMap_init()"
                    style="margin-top:14px;background:rgba(139,92,246,0.1);border:1.5px solid rgba(139,92,246,0.3);color:#7c3aed;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
              🔄 إعادة المحاولة
            </button>
          </div>` : ''}
        </div>
      </div>

      <!-- تلميح للمندوب -->
      <div style="margin-top:12px;background:rgba(13,148,136,0.05);border:1px solid rgba(13,148,136,0.2);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--text-secondary);line-height:1.6">
        💡 <strong>تلميح:</strong> لظهور المندوب على الخريطة يجب أن يبدأ ببث موقعه من لوحته الخاصة (زر 🛰️ في تفاصيل الطلب). تتجدد المواقع تلقائياً كل 5–6 ثوانٍ.
      </div>
    </div>`;
  };

  /* ── تنظيف تلقائي عند مغادرة تبويب التتبع ──────── */
  (function patchSetAdminTab() {
    const __orig = window.setAdminTab;
    if (typeof __orig !== 'function') { setTimeout(patchSetAdminTab, 600); return; }
    window.setAdminTab = async function (tab) {
      if (tab !== 'live_tracking') adminDriverMap_destroy();
      return __orig.apply(this, arguments);
    };
  })();

  console.log('[AdminDriverMap] خريطة تتبع المندوبين جاهزة 🗺️');
})();
