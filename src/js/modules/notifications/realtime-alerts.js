/* ============================================================
   Phase 19 — Real-time admin alerts (live order/recharge feed)
   ------------------------------------------------------------
   Adds true real-time notifications for admins/staff using
   Firestore onSnapshot on `orders` and `recharge_requests`.

   - Fires ph8_alert (banner + chime + vibrate) for every truly
     new doc that arrives AFTER the listener is attached
     (initial snapshot is ignored to avoid replay on login).
   - Shows a desktop browser notification (if permission granted)
     so the admin sees alerts even when the tab is in background.
   - Maintains an unseen counter shown as a floating red badge
     on a "live alerts" pill in the navbar; clicking it opens a
     dropdown with the latest 12 events (clears the counter).
   - Persists a sound on/off preference per-admin in localStorage
     (`ph19_sound_off`) — surfaced as a toggle in the dropdown.
   - Re-attaches listeners on auth/role change; detaches on
     logout to avoid leaking subscriptions.
   ============================================================ */
(function () {
  'use strict';

  const PH19 = {
    unsubOrders: null,
    unsubRecharge: null,
    boundUid: null,
    attachedAt: 0,
    seenIds: new Set(),
    feed: [],
    unseen: 0,
    soundOff: localStorage.getItem('ph19_sound_off') === '1',
  };
  window.PH19 = PH19;

  function isAdminUser(u) {
    return !!u && (u.role === 'admin' || u.role === 'staff');
  }

  function fmtTime(ts) {
    try {
      const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
      return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function ensureStyles() {
    if (document.getElementById('ph19-styles')) return;
    const css = document.createElement('style');
    css.id = 'ph19-styles';
    css.textContent = `
      .ph19-pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 10px; border-radius: 999px;
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        color: #fff; font-weight: 700; font-size: 12px;
        cursor: pointer; user-select: none;
        box-shadow: 0 4px 14px rgba(124,58,237,.25);
        transition: transform .18s ease, box-shadow .18s ease;
      }
      .ph19-pill:not(.in-nav) {
        position: fixed; top: 12px; left: 12px; z-index: 9998;
      }
      .ph19-pill.in-nav {
        padding: 5px 10px; font-size: 12px;
      }
      .ph19-pill.in-nav .ph19-text-label {
        display: none;
      }
      .ph19-pill:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,.35); }
      .ph19-pill .ph19-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.6);
        animation: ph19-pulse 1.6s infinite;
      }
      @keyframes ph19-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.6); }
        70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
        100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
      }
      .ph19-pill .ph19-badge {
        background: #ef4444; color: #fff; font-size: 11px; font-weight: 800;
        min-width: 18px; height: 18px; border-radius: 9px; padding: 0 5px;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .ph19-pill .ph19-badge.zero { display: none; }
      
      @media (max-width: 600px) {
        .ph19-pill .ph19-text-label { display: none; }
        .ph19-pill { padding: 6px 10px !important; gap: 4px; }
      }

      .ph19-panel {
        position: fixed; top: 64px; left: 12px; z-index: 9999;
        width: 340px; max-width: calc(100vw - 24px);
        max-height: 70vh; overflow: auto;
        background: #1f2937; color: #f3f4f6;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0,0,0,.45);
        opacity: 0; transform: translateY(-6px); pointer-events: none;
        transition: opacity .18s, transform .18s;
        direction: rtl;
      }
      .ph19-panel.on { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .ph19-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08);
        font-weight: 700; font-size: 14px;
      }
      .ph19-panel-actions { display: flex; gap: 6px; }
      .ph19-panel-actions button {
        background: rgba(255,255,255,.08); color: #f3f4f6;
        border: 0; padding: 5px 9px; border-radius: 8px;
        font-size: 11px; cursor: pointer; font-weight: 600;
      }
      .ph19-panel-actions button:hover { background: rgba(255,255,255,.15); }
      .ph19-feed { padding: 6px 0; }
      .ph19-feed-empty { padding: 20px; text-align: center; opacity: .65; font-size: 13px; }
      .ph19-item {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.05);
        cursor: pointer; transition: background .12s;
      }
      .ph19-item:hover { background: rgba(255,255,255,.04); }
      .ph19-item:last-child { border-bottom: 0; }
      .ph19-item .ph19-icon { font-size: 22px; line-height: 1; margin-top: 2px; }
      .ph19-item .ph19-text { flex: 1; min-width: 0; }
      .ph19-item .ph19-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
      .ph19-item .ph19-sub { font-size: 12px; opacity: .8; word-break: break-word; }
      .ph19-item .ph19-time { font-size: 10px; opacity: .55; margin-top: 3px; }
    `;
    document.head.appendChild(css);
  }

  function ensurePill() {
    window.__unifiedNotif?.update('live', PH19.feed, PH19.unseen);
  }

  function removePillUI() {
    window.__unifiedNotif?.update('live', [], 0);
  }

  function refreshSoundButton() {
    const b = document.getElementById('ph19-sound-toggle');
    if (!b) return;
    b.textContent = PH19.soundOff ? '🔇 الصوت' : '🔔 الصوت';
  }

  function toggleSound() {
    PH19.soundOff = !PH19.soundOff;
    localStorage.setItem('ph19_sound_off', PH19.soundOff ? '1' : '0');
    refreshSoundButton();
  }

  function togglePanel() {
    if (typeof window.toggleUnifiedNotif === 'function') {
      window.toggleUnifiedNotif();
    }
    PH19.unseen = 0;
    updateBadge();
  }

  function clearFeed() {
    PH19.feed = [];
    PH19.unseen = 0;
    updateBadge();
  }

  function updateBadge() {
    window.__unifiedNotif?.update('live', PH19.feed, PH19.unseen);
  }

  function renderFeed() {
    window.__unifiedNotif?.update('live', PH19.feed, PH19.unseen);
  }

  function pushFeed(entry) {
    PH19.feed.unshift(entry);
    if (PH19.feed.length > 50) PH19.feed.length = 50;
    PH19.unseen += 1;
    window.__unifiedNotif?.update('live', PH19.feed, PH19.unseen);
  }

  function fireDesktopNotification(title, body) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(title, { body, icon: '/icon-192.png', tag: 'mahjooz-' + Date.now() });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch (e) {}
  }

  function announce(title, sub, opts) {
    try {
      if (!PH19.soundOff && typeof window.ph8_alert === 'function') {
        window.ph8_alert(title, sub, { kind: opts.kind || 'important', icon: opts.icon });
      } else if (typeof window.toast === 'function') {
        window.toast(title + ' — ' + (sub || ''), 'info');
      }
    } catch (e) {}
    fireDesktopNotification(title, sub || '');
  }

  function handleOrderDoc(doc) {
    if (PH19.seenIds.has(doc.id)) return;
    PH19.seenIds.add(doc.id);
    const d = doc.data() || {};
    const created = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
    if (created && created < PH19.attachedAt - 500) return;
    if (PH19.currentUser && d.customerId === PH19.currentUser.uid) return;

    const title = '🆕 طلب جديد';
    const sub = `${d.customerName || 'عميل'} • ${d.svcName || 'خدمة'}` +
      (d.total ? ` • ${d.total} ﷼` : '');
    announce(title, sub, { kind: 'important', icon: '🆕' });
    pushFeed({
      icon: '🆕', title, sub, time: fmtTime(d.createdAt),
      nav: 'admin',
    });
  }

  function handleRechargeDoc(doc) {
    const key = 'r:' + doc.id;
    if (PH19.seenIds.has(key)) return;
    PH19.seenIds.add(key);
    const d = doc.data() || {};
    const created = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
    if (created && created < PH19.attachedAt - 500) return;
    if (PH19.currentUser && d.userId === PH19.currentUser.uid) return;

    const title = '💰 طلب شحن جديد';
    const sub = `${d.userName || 'مستخدم'} • ${d.amount || 0} ﷼`;
    announce(title, sub, { kind: 'important', icon: '💰' });
    pushFeed({
      icon: '💰', title, sub, time: fmtTime(d.createdAt),
      nav: 'admin',
    });
  }

  function detach() {
    try { PH19.unsubOrders && PH19.unsubOrders(); } catch (e) {}
    try { PH19.unsubRecharge && PH19.unsubRecharge(); } catch (e) {}
    PH19.unsubOrders = null;
    PH19.unsubRecharge = null;
    PH19.seenIds = new Set();
    PH19.boundUid = null;
    PH19.feed = [];
    PH19.unseen = 0;
    removePillUI();
  }

  function attach(user) {
    if (typeof db === 'undefined' || !db || !db.collection) return;
    if (PH19.boundUid === user.uid) return;
    detach();
    PH19.currentUser = user;
    PH19.boundUid = user.uid;
    PH19.attachedAt = Date.now();
    ensurePill();
    renderFeed();
    updateBadge();

    try {
      PH19.unsubOrders = db.collection('orders').onSnapshot(
        snap => {
          let needsRender = false;
          snap.docChanges().forEach(ch => {
            if (ch.type === 'added') {
              handleOrderDoc(ch.doc);
              if (window.AppData && window.AppData.orders) {
                const docData = { id: ch.doc.id, ...ch.doc.data() };
                if (!window.AppData.orders.find(o => o.id === docData.id)) {
                  window.AppData.orders.unshift(docData);
                  needsRender = true;
                }
              }
            } else if (ch.type === 'modified') {
              if (window.AppData && window.AppData.orders) {
                const docData = { id: ch.doc.id, ...ch.doc.data() };
                const idx = window.AppData.orders.findIndex(o => o.id === docData.id);
                if (idx >= 0) {
                  window.AppData.orders[idx] = docData;
                } else {
                  window.AppData.orders.unshift(docData);
                }
                needsRender = true;
              }
            } else if (ch.type === 'removed') {
              if (window.AppData && window.AppData.orders) {
                window.AppData.orders = window.AppData.orders.filter(o => o.id !== ch.doc.id);
                needsRender = true;
              }
            }
          });
          if (needsRender && typeof window.render === 'function') window.render();
        },
        err => console.warn('[Phase19] orders listener', err)
      );
    } catch (e) { console.warn('[Phase19] failed to attach orders listener', e); }

    try {
      PH19.unsubRecharge = db.collection('recharge_requests').onSnapshot(
        snap => {
          let needsRender = false;
          snap.docChanges().forEach(ch => {
            if (ch.type === 'added') {
              handleRechargeDoc(ch.doc);
              if (window.AppData && window.AppData.rechargeReqs) {
                const docData = { id: ch.doc.id, ...ch.doc.data() };
                if (!window.AppData.rechargeReqs.find(r => r.id === docData.id)) {
                  window.AppData.rechargeReqs.unshift(docData);
                  needsRender = true;
                }
              }
            } else if (ch.type === 'modified') {
              if (window.AppData && window.AppData.rechargeReqs) {
                const docData = { id: ch.doc.id, ...ch.doc.data() };
                const idx = window.AppData.rechargeReqs.findIndex(r => r.id === docData.id);
                if (idx >= 0) {
                  window.AppData.rechargeReqs[idx] = docData;
                } else {
                  window.AppData.rechargeReqs.unshift(docData);
                }
                needsRender = true;
              }
            } else if (ch.type === 'removed') {
              if (window.AppData && window.AppData.rechargeReqs) {
                window.AppData.rechargeReqs = window.AppData.rechargeReqs.filter(r => r.id !== ch.doc.id);
                needsRender = true;
              }
            }
          });
          if (needsRender && typeof window.render === 'function') window.render();
        },
        err => console.warn('[Phase19] recharge listener', err)
      );
    } catch (e) { console.warn('[Phase19] failed to attach recharge listener', e); }

    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {}
  }

  // Watch State.currentUser and (de)attach when role changes
  setInterval(() => {
    try {
      const u = (typeof State !== 'undefined') ? State.currentUser : null;
      if (isAdminUser(u)) {
        if (PH19.boundUid !== u.uid) attach(u);
      } else if (PH19.boundUid) {
        detach();
      }
    } catch (e) {}
  }, 1500);

  console.log('[Phase 19] Real-time admin alerts loaded.');
})();
