// ═══════════════════════════════════════════════════════
//  محجوز v3.0 — Phase 10 (Live Order Tracking)
//  - خريطة Leaflet/OpenStreetMap (مجاناً، بلا API key)
//  - بث موقع المندوب لحظياً عبر Firestore
//  - حساب المسافة + الوقت المتوقع للوصول (ETA)
//  - إشعار العميل تلقائياً عند تغيّر حالة الطلب
//  - زر "🗺️ تتبع الطلب" للعميل، "🛰️ بدء البث" للمندوب
// ═══════════════════════════════════════════════════════
'use strict';

// ── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('track_order',         '🗺️ تتبع الطلب',                  '🗺️ Track order');
  add('tracking_title',      'تتبّع التوصيل لحظياً',           'Live delivery tracking');
  add('start_broadcast',     '🛰️ بدء بث موقعي',                 '🛰️ Start broadcasting');
  add('stop_broadcast',      '⏹️ إيقاف البث',                  '⏹️ Stop broadcasting');
  add('eta_label',           'الوصول المتوقع',                  'Estimated arrival');
  add('distance_label',      'المسافة المتبقية',                'Distance left');
  add('driver_label',        'المندوب',                         'Driver'),
  add('last_seen',           'آخر تحديث',                       'Last update');
  add('waiting_driver_loc',  'بانتظار موقع المندوب…',            'Waiting for driver location…');
  add('order_status_lbl',    'حالة الطلب',                      'Order status');
  add('call_driver',         '📞 اتصال',                         '📞 Call');
  add('whatsapp_driver',     '💬 واتساب',                        '💬 WhatsApp');
  add('center_map',          '🎯 توسيط',                         '🎯 Center');
  add('broadcast_on',        '✅ البث المباشر مفعّل — موقعك يُحدّث كل بضع ثوانٍ', '✅ Live broadcast on — your location updates every few seconds');
  add('broadcast_off',       '❌ البث متوقف',                    '❌ Broadcast stopped');
  add('geo_denied',          'لم يتم منح إذن الموقع',            'Location permission denied');
  add('geo_unavailable',     'تحديد الموقع غير متاح',            'Geolocation unavailable');
  add('order_arrived',       '✅ تم التوصيل!',                    '✅ Delivered!');
  add('order_eta_now',       'وصل تقريباً',                      'Almost there');
  add('km_short',            'كم',                               'km'),
  add('m_short',             'م',                                'm');
  add('min_short',           'د',                                'min');
})();

// ════════════════════════════════════════════════════════════
//  1) Capture customer location during booking
// ════════════════════════════════════════════════════════════
(function patchConfirmBooking() {
  const __orig = window.confirmBooking;
  if (typeof __orig !== 'function') { setTimeout(patchConfirmBooking, 600); return; }
  window.confirmBooking = async function (svcId) {
    let coords = null;
    try {
      coords = await new Promise((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => res(null),
          { timeout: 4500, maximumAge: 60000 }
        );
      });
    } catch (e) {}
    if (coords) {
      window.__ph10_pendingCoords = coords;
      // Wrap fsAdd one time to inject coords into the new order
      const __origAdd = window.fsAdd;
      window.fsAdd = async function (col, data) {
        if (col === 'orders' && window.__ph10_pendingCoords) {
          data = { ...data, customerLat: coords.lat, customerLng: coords.lng };
          window.__ph10_pendingCoords = null;
          window.fsAdd = __origAdd;
        }
        return __origAdd.call(this, col, data);
      };
    }
    return __orig.apply(this, arguments);
  };
})();

// ════════════════════════════════════════════════════════════
//  2) Driver-side broadcast: GPS watch → fsUpdate every ~6s
// ════════════════════════════════════════════════════════════
window.__ph10_broadcast = { watchId: null, orderId: null, lastSent: 0 };

window.ph10_startBroadcast = async function (orderId) {
  if (!navigator.geolocation) { toast(t('geo_unavailable'), 'error'); return; }
  if (window.__ph10_broadcast.watchId !== null) ph10_stopBroadcast();
  window.__ph10_broadcast.orderId = orderId;
  const wid = navigator.geolocation.watchPosition(
    async (p) => {
      const now = Date.now();
      if (now - window.__ph10_broadcast.lastSent < 5500) return; // throttle 5.5s
      window.__ph10_broadcast.lastSent = now;
      try {
        await fsUpdate('orders', orderId, {
          driverLat: p.coords.latitude,
          driverLng: p.coords.longitude,
          driverAccuracy: p.coords.accuracy || null,
          driverHeading: p.coords.heading || null,
          driverSpeed: p.coords.speed || null,
          lastLocationAt: firebase.firestore.FieldValue.serverTimestamp(),
          isBroadcasting: true,
        });
      } catch (e) { console.warn('[Phase10] broadcast failed', e); }
    },
    (err) => {
      toast(err.code === 1 ? t('geo_denied') : t('geo_unavailable'), 'error');
      ph10_stopBroadcast();
    },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
  );
  window.__ph10_broadcast.watchId = wid;
  toast(t('broadcast_on'), 'success');
  if (typeof render === 'function') await render();
};

window.ph10_stopBroadcast = async function () {
  const b = window.__ph10_broadcast;
  if (b.watchId !== null) {
    try { navigator.geolocation.clearWatch(b.watchId); } catch (e) {}
    if (b.orderId) {
      try { await fsUpdate('orders', b.orderId, { isBroadcasting: false }); } catch (e) {}
    }
  }
  b.watchId = null; b.orderId = null; b.lastSent = 0;
  toast(t('broadcast_off'), 'info');
  if (typeof render === 'function') await render();
};

// Auto-stop broadcast when order moves past `with_driver`
(function watchBroadcastForCompletion() {
  setInterval(() => {
    const b = window.__ph10_broadcast;
    if (!b.orderId) return;
    const o = AppData.orders.find(x => x.id === b.orderId);
    if (o && (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled')) {
      ph10_stopBroadcast();
    }
  }, 4000);
})();

// ════════════════════════════════════════════════════════════
//  3) Inject driver buttons into driver dashboard
//    (Wrap renderDriverDashboard to add broadcast controls)
// ════════════════════════════════════════════════════════════
(function patchDriverDashboard() {
  const __orig = window.renderDriverDashboard;
  if (typeof __orig !== 'function') { setTimeout(patchDriverDashboard, 600); return; }
  window.renderDriverDashboard = function () {
    let html = __orig.apply(this, arguments);
    // Inject a broadcast button next to each "في الطريق / تم التوصيل" set.
    // We append after the existing buttons via a safe regex on the with_driver row.
    const b = window.__ph10_broadcast;
    html = html.replace(
      /(updateDeliveryStatus\('([^']+)','delivered'\)[^>]*>[^<]*<\/button>)/g,
      (m, btn, oid) => {
        const isThis = b.orderId === oid;
        const broadcastBtn = isThis
          ? `<button class="btn btn-sm btn-warn" onclick="ph10_stopBroadcast()">${t('stop_broadcast')}</button>`
          : `<button class="btn btn-sm btn-info" onclick="ph10_startBroadcast('${oid}')">${t('start_broadcast')}</button>`;
        return `${btn} ${broadcastBtn}`;
      }
    );
    return html;
  };
})();

// ════════════════════════════════════════════════════════════
//  4) Customer-side: inject "🗺️ تتبع الطلب" button into order cards
// ════════════════════════════════════════════════════════════
(function patchCustomerOrders() {
  const __orig = window.renderMyOrders;
  if (typeof __orig !== 'function') { setTimeout(patchCustomerOrders, 600); return; }
  window.renderMyOrders = function () {
    let html = __orig.apply(this, arguments);
    // For each order with status accepted/with_driver/delivered, add a track button if not present.
    // Inject inside .order-actions, after the invoice button.
    const trackable = (AppData.orders || []).filter(o =>
      o.customerId === State.currentUser?.uid &&
      ['accepted','with_driver','delivered'].includes(o.status)
    );
    trackable.forEach(o => {
      const btn = `<button class="btn btn-primary btn-sm" onclick="ph10_openTracker('${o.id}')">${t('track_order')}</button>`;
      // Use a marker — find the `showInvoice('<o.id>')` button line and append the track button after its closing </button>.
      const re = new RegExp(`(showInvoice\\('${o.id}'\\)[^>]*>[^<]*</button>)`);
      html = html.replace(re, `$1 ${btn}`);
    });
    return html;
  };
})();

// ════════════════════════════════════════════════════════════
//  5) Tracker modal (Leaflet map)
// ════════════════════════════════════════════════════════════
window.__ph10_tracker = { map: null, driverM: null, customerM: null, line: null, unsub: null, orderId: null };

window.ph10_openTracker = async function (orderId) {
  if (typeof L === 'undefined') {
    toast('جاري تحميل الخريطة، حاول مرة أخرى بعد ثانيتين', 'info');
    return;
  }
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) { toast('الطلب غير موجود', 'error'); return; }

  const html = `
    <div class="ph10-tracker">
      <div class="ph10-trk-header">
        <div>
          <div class="ph10-trk-title">${t('tracking_title')}</div>
          <div class="ph10-trk-sub">${o.svcIcon||'🔷'} ${escHtml(o.svcName||'')} — <span style="opacity:.8">${escHtml(o.orderId||'')}</span></div>
        </div>
        <button class="ph10-trk-close" onclick="ph10_closeTracker()" aria-label="إغلاق">✕</button>
      </div>

      <div id="ph10-map" class="ph10-map"></div>

      <div class="ph10-trk-info">
        <div class="ph10-info-cell">
          <div class="ph10-info-k">${t('order_status_lbl')}</div>
          <div class="ph10-info-v" id="ph10-status">—</div>
        </div>
        <div class="ph10-info-cell">
          <div class="ph10-info-k">${t('distance_label')}</div>
          <div class="ph10-info-v" id="ph10-dist">—</div>
        </div>
        <div class="ph10-info-cell">
          <div class="ph10-info-k">${t('eta_label')}</div>
          <div class="ph10-info-v" id="ph10-eta">—</div>
        </div>
        <div class="ph10-info-cell">
          <div class="ph10-info-k">${t('last_seen')}</div>
          <div class="ph10-info-v" id="ph10-lastseen">—</div>
        </div>
      </div>

      <div class="ph10-trk-driver" id="ph10-driver-row">
        <div class="ph10-driver-name">${t('driver_label')}: <strong>${escHtml(o.driverName||'—')}</strong></div>
        <div class="ph10-driver-actions">
          <button class="ph10-mini-btn" onclick="ph10_centerMap()">${t('center_map')}</button>
          ${o.driverPhone ? `
            <a class="ph10-mini-btn" href="tel:${escAttr(o.driverPhone)}">${t('call_driver')}</a>
            <a class="ph10-mini-btn ph10-mini-wa" target="_blank" href="https://wa.me/${encodeURIComponent(String(o.driverPhone).replace(/[^0-9]/g,''))}">${t('whatsapp_driver')}</a>
          ` : ''}
        </div>
      </div>
    </div>`;

  // Use openModal but with a wider variant
  if (typeof openModal === 'function') openModal(html, { wide: true });
  // Backup: ensure modal-content is wide
  const mc = document.querySelector('.modal-content');
  if (mc) mc.classList.add('ph10-modal-wide');

  // Init map after the next tick (let DOM settle)
  setTimeout(() => ph10_initMap(orderId), 60);
};

window.ph10_closeTracker = function () {
  const t = window.__ph10_tracker;
  if (t.unsub) { try { t.unsub(); } catch (e) {} t.unsub = null; }
  if (t.map) { try { t.map.remove(); } catch (e) {} }
  t.map = null; t.driverM = null; t.customerM = null; t.line = null; t.orderId = null;
  if (typeof closeModal === 'function') closeModal();
};

// Hook closeModal so map cleans up if user closes via overlay/backdrop
(function hookCloseModal() {
  const __orig = window.closeModal;
  if (typeof __orig !== 'function') { setTimeout(hookCloseModal, 600); return; }
  window.closeModal = function () {
    const t = window.__ph10_tracker;
    if (t.unsub) { try { t.unsub(); } catch (e) {} t.unsub = null; }
    if (t.map) { try { t.map.remove(); } catch (e) {} t.map = null; }
    t.driverM = null; t.customerM = null; t.line = null; t.orderId = null;
    return __orig.apply(this, arguments);
  };
})();

window.ph10_initMap = function (orderId) {
  const T = window.__ph10_tracker;
  T.orderId = orderId;
  const el = document.getElementById('ph10-map');
  if (!el || typeof google === 'undefined') return;

  const o = AppData.orders.find(x => x.id === orderId);
  const customerC = (o?.customerLat && o?.customerLng) ? { lat: o.customerLat, lng: o.customerLng } : null;
  const driverC   = (o?.driverLat   && o?.driverLng)   ? { lat: o.driverLat,   lng: o.driverLng }   : null;

  // Default center: Sana'a/Yemen as fallback
  const center = driverC || customerC || { lat: 15.3694, lng: 44.1910 };
  T.map = new google.maps.Map(el, {
    center: center,
    zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  if (customerC) {
    T.customerM = new google.maps.Marker({
      position: customerC,
      map: T.map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'),
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 36)
      },
      title: 'موقعك'
    });
  }

  if (driverC) {
    T.driverM = new google.maps.Marker({
      position: driverC,
      map: T.map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237c3aed" width="40" height="40"><circle cx="12" cy="12" r="10" fill="%237c3aed" fill-opacity="0.2"/><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="%237c3aed"/></svg>'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      title: 'المندوب'
    });
  }

  if (customerC && driverC) {
    T.line = new google.maps.Polyline({
      path: [driverC, customerC],
      geodesic: true,
      strokeColor: '#a855f7',
      strokeOpacity: 0.7,
      strokeWeight: 4,
      map: T.map
    });
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(customerC);
    bounds.extend(driverC);
    T.map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }

  ph10_refreshInfoPanel(o);

  // Subscribe to live order updates from Firestore
  try {
    T.unsub = db.collection('orders').doc(orderId).onSnapshot(snap => {
      if (!snap.exists) return;
      const data = { id: snap.id, ...snap.data() };
      // Sync local cache
      const idx = AppData.orders.findIndex(x => x.id === orderId);
      if (idx >= 0) AppData.orders[idx] = data;
      ph10_applyLiveUpdate(data);
    });
  } catch (e) { console.warn('[Phase10] onSnapshot failed', e); }
};

window.ph10_applyLiveUpdate = function (o) {
  const T = window.__ph10_tracker;
  if (!T.map || typeof google === 'undefined') return;
  const customerC = (o.customerLat && o.customerLng) ? { lat: o.customerLat, lng: o.customerLng } : null;
  const driverC   = (o.driverLat   && o.driverLng)   ? { lat: o.driverLat,   lng: o.driverLng }   : null;

  if (customerC) {
    if (!T.customerM) {
      T.customerM = new google.maps.Marker({ position: customerC, map: T.map });
    } else {
      T.customerM.setPosition(customerC);
    }
  }
  if (driverC) {
    if (!T.driverM) {
      T.driverM = new google.maps.Marker({ position: driverC, map: T.map });
    } else {
      T.driverM.setPosition(driverC);
    }
  }
  if (customerC && driverC) {
    if (!T.line) {
      T.line = new google.maps.Polyline({ path: [driverC, customerC], map: T.map, strokeColor: '#a855f7' });
    } else {
      T.line.setPath([driverC, customerC]);
    }
  }
  ph10_refreshInfoPanel(o);
};

window.ph10_centerMap = function () {
  const T = window.__ph10_tracker;
  if (!T.map || typeof google === 'undefined') return;
  const o = AppData.orders.find(x => x.id === T.orderId);
  const c = (o?.customerLat && o?.customerLng) ? { lat: o.customerLat, lng: o.customerLng } : null;
  const d = (o?.driverLat && o?.driverLng) ? { lat: o.driverLat, lng: o.driverLng } : null;
  if (c && d) {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(c);
    bounds.extend(d);
    T.map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  } else if (d) {
    T.map.setCenter(d);
    T.map.setZoom(15);
  } else if (c) {
    T.map.setCenter(c);
    T.map.setZoom(15);
  }
};

window.ph10_refreshInfoPanel = function (o) {
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
  const sLabel = {
    pending:'⏳ بانتظار القبول', accepted:'✅ تم القبول',
    with_driver:'🚗 في الطريق إليك', delivered:'📦 تم التوصيل',
    completed:'🎉 مكتمل', cancelled:'❌ ملغي'
  };
  setTxt('ph10-status', sLabel[o.status] || o.status || '—');

  const cC = (o.customerLat && o.customerLng) ? { lat:o.customerLat, lng:o.customerLng } : null;
  const dC = (o.driverLat && o.driverLng) ? { lat:o.driverLat, lng:o.driverLng } : null;

  if (cC && dC) {
    const km = ph10_haversine(cC.lat, cC.lng, dC.lat, dC.lng);
    const distTxt = km < 1 ? `${Math.round(km*1000)} ${t('m_short')}` : `${km.toFixed(1)} ${t('km_short')}`;
    setTxt('ph10-dist', distTxt);
    // ETA: assume 30 km/h average urban speed
    const minutes = Math.max(1, Math.round((km / 30) * 60));
    setTxt('ph10-eta', km < 0.15 ? t('order_eta_now') : `~${minutes} ${t('min_short')}`);
  } else if (o.status === 'delivered' || o.status === 'completed') {
    setTxt('ph10-dist', '—');
    setTxt('ph10-eta', t('order_arrived'));
  } else {
    setTxt('ph10-dist', '—');
    setTxt('ph10-eta', dC ? '—' : t('waiting_driver_loc'));
  }

  if (o.lastLocationAt) {
    let date = null;
    try { date = o.lastLocationAt.toDate ? o.lastLocationAt.toDate() : new Date(o.lastLocationAt); } catch (e) {}
    if (date) {
      const diff = Math.round((Date.now() - date.getTime()) / 1000);
      setTxt('ph10-lastseen', diff < 60 ? `قبل ${diff} ث` : diff < 3600 ? `قبل ${Math.round(diff/60)} د` : '—');
    }
  } else {
    setTxt('ph10-lastseen', '—');
  }
};

// ── Haversine (km)
window.ph10_haversine = function (lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// ════════════════════════════════════════════════════════════
//  6) Status notifications — push to customer on each transition
// ════════════════════════════════════════════════════════════
(function patchUpdateStatusFns() {
  const STATUS_TXT = {
    accepted: { title:'✅ تم قبول طلبك', body:'صاحب الخدمة قبل طلبك وسيبدأ التحضير قريباً.' },
    with_driver: { title:'🚗 المندوب في الطريق', body:'مندوبك انطلق نحوك. تتبّعه من زر "تتبع الطلب".' },
    delivered: { title:'📦 تم توصيل طلبك', body:'وصلك الطلب! لا تنسَ تقييم الخدمة.' },
    completed: { title:'🎉 طلبك مكتمل', body:'شكراً لاستخدامك محجوز.' },
    cancelled: { title:'❌ تم إلغاء طلبك', body:'تواصل مع الدعم إذا كان هذا غير متوقع.' },
  };

  function pushIfChanged(orderId, newStatus) {
    const o = AppData.orders.find(x => x.id === orderId);
    if (!o || !o.customerId) return;
    const tx = STATUS_TXT[newStatus]; if (!tx) return;
    try {
      // Use existing notification helper if available
      if (typeof addUserNotification === 'function') {
        addUserNotification(o.customerId, tx.title, tx.body, { kind:'order', orderId });
      } else if (typeof db !== 'undefined') {
        db.collection('user_notifications').add({
          uid: o.customerId, title: tx.title, body: tx.body,
          read: false, kind: 'order', orderId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {}
  }

  function wrap(name) {
    const __orig = window[name];
    if (typeof __orig !== 'function') return false;
    window[name] = async function (orderId, status) {
      const r = await __orig.apply(this, arguments);
      pushIfChanged(orderId, status);
      return r;
    };
    return true;
  }

  function tryWrap() {
    let ok = true;
    if (!window.__ph10_wrapped_uos) window.__ph10_wrapped_uos = wrap('updateOrderStatus');
    if (!window.__ph10_wrapped_uds) window.__ph10_wrapped_uds = wrap('updateDeliveryStatus');
    if (!window.__ph10_wrapped_uos || !window.__ph10_wrapped_uds) setTimeout(tryWrap, 700);
  }
  tryWrap();
})();

console.log('[Phase 10] Live tracking loaded — Leaflet ' + (typeof L !== 'undefined' ? L.version : 'pending'));
