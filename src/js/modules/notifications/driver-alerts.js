/* ============================================================
   Driver Alerts — إشعارات المندوب الفورية
   ------------------------------------------------------------
   يراقب مجموعة `orders` في Firestore بـ onSnapshot مصفّاةً
   بـ driverId === currentUser.uid. عند وصول طلب جديد (أو
   تغيير حالة طلب موجود) بعد بدء الاستماع:

   1. يُشغّل صوت تنبيه (AudioContext)
   2. يعرض browser notification (إذا مُنح الإذن)
   3. يعرض شريط تنبيه داخلي بارز مع تفاصيل الطلب
   4. يحدّث badge عدد الطلبات الجديدة على تبويب "طلباتي"
   5. يستدعي render() لتحديث الواجهة فوراً

   الحياة الدورية: attach عند تسجيل دخول المندوب،
                   detach عند تسجيل الخروج.
   ============================================================ */
(function () {
  'use strict';

  /* ── الحالة الداخلية ────────────────────────────── */
  const DA = {
    unsub:      null,
    boundUid:   null,
    attachedAt: 0,
    seenIds:    new Set(),
    feed:       [],          // [{icon,title,sub,time,orderId}]
    newCount:   0,           // عدد الطلبات غير المقروءة
    soundOff:   localStorage.getItem('da_sound_off') === '1',
  };
  window.DRIVER_ALERTS = DA;

  /* ── أدوات مساعدة ──────────────────────────────── */
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  function fmtTime(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
      return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /* ── صوت التنبيه (AudioContext) ────────────────── */
  function playChime() {
    if (DA.soundOff) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523.25, 0, 0.15], [659.25, 0.15, 0.15], [783.99, 0.3, 0.2]].forEach(([freq, delay, dur]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + delay + 0.03);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + dur);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur);
      });
    } catch (e) {}
  }

  /* ── Browser Notification ───────────────────────── */
  function browserNotify(title, body) {
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icons/icon-192.png', dir: 'rtl', lang: 'ar' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body, icon: '/icons/icon-192.png', dir: 'rtl', lang: 'ar' });
        });
      }
    } catch (e) {}
  }

  /* ── الشريط المرئي ──────────────────────────────── */
  function ensureStyles() {
    if (document.getElementById('da-styles')) return;
    const s = document.createElement('style');
    s.id = 'da-styles';
    s.textContent = `
      #da-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: linear-gradient(135deg, #7c3aed 0%, #0d9488 100%);
        color: #fff; font-family: 'Cairo', sans-serif; direction: rtl;
        padding: 0; max-height: 0; overflow: hidden;
        transition: max-height 0.4s cubic-bezier(0.34,1.56,0.64,1),
                    padding 0.3s ease, box-shadow 0.3s ease;
        box-shadow: none;
      }
      #da-banner.da-open {
        max-height: 120px; padding: 12px 20px;
        box-shadow: 0 4px 24px rgba(124,58,237,0.35);
      }
      #da-banner-inner {
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      }
      #da-banner-icon { font-size: 28px; flex-shrink: 0; animation: da-pulse 1s infinite; }
      @keyframes da-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
      #da-banner-text { flex: 1; min-width: 0; }
      #da-banner-title { font-size: 15px; font-weight: 900; line-height: 1.3; }
      #da-banner-sub   { font-size: 12px; opacity: 0.85; margin-top: 2px; line-height: 1.4; }
      #da-banner-btns  { display: flex; gap: 8px; flex-shrink: 0; }
      .da-btn {
        padding: 6px 14px; border-radius: 20px; font-family: 'Cairo', sans-serif;
        font-size: 13px; font-weight: 700; cursor: pointer; border: none; line-height: 1;
      }
      .da-btn-view  { background: #fff; color: #7c3aed; }
      .da-btn-close { background: rgba(255,255,255,0.2); color: #fff; }
      #da-feed-panel {
        position: fixed; top: 64px; left: 16px; z-index: 99998;
        width: 300px; max-height: 380px; overflow-y: auto;
        background: var(--bg-card, #fff); border: 1.5px solid var(--border, #e5e7eb);
        border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        font-family: 'Cairo', sans-serif; direction: rtl;
        display: none;
      }
      .da-feed-item {
        display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px;
        border-bottom: 1px solid var(--border, #e5e7eb); cursor: default;
      }
      .da-feed-item:last-child { border-bottom: none; }
      .da-feed-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
      .da-feed-body { flex: 1; min-width: 0; }
      .da-feed-title { font-size: 13px; font-weight: 800; color: var(--text-main, #111); line-height: 1.3; }
      .da-feed-sub   { font-size: 11px; color: var(--text-muted, #6b7280); margin-top: 3px; }
      .da-feed-time  { font-size: 10px; color: var(--text-muted, #9ca3af); margin-top: 4px; }
    `;
    document.head.appendChild(s);
  }

  let bannerTimer = null;
  function showBanner(title, sub, orderId) {
    ensureStyles();
    let el = document.getElementById('da-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'da-banner';
      el.innerHTML = `<div id="da-banner-inner">
        <div id="da-banner-icon">🚚</div>
        <div id="da-banner-text">
          <div id="da-banner-title"></div>
          <div id="da-banner-sub"></div>
        </div>
        <div id="da-banner-btns">
          <button class="da-btn da-btn-view" onclick="setDriverTab('orders');DA_closeBanner()">📋 عرض الطلب</button>
          <button class="da-btn da-btn-close" onclick="DA_closeBanner()">✕</button>
        </div>
      </div>`;
      document.body.appendChild(el);
    }
    document.getElementById('da-banner-title').textContent = title;
    document.getElementById('da-banner-sub').textContent   = sub;
    el.classList.add('da-open');

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => DA_closeBanner(), 9000);
  }

  window.DA_closeBanner = function () {
    const el = document.getElementById('da-banner');
    if (el) el.classList.remove('da-open');
    clearTimeout(bannerTimer);
  };

  /* ── Feed Panel (سجل التنبيهات) ─────────────────── */
  function renderFeedPanel() {
    let panel = document.getElementById('da-feed-panel');
    if (!panel) return;
    if (DA.feed.length === 0) {
      panel.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted,#9ca3af);font-size:13px">لا توجد تنبيهات بعد</div>`;
      return;
    }
    panel.innerHTML = `
      <div style="padding:12px 14px 8px;font-size:12px;font-weight:800;color:var(--text-secondary,#6b7280);border-bottom:1px solid var(--border,#e5e7eb)">
        🔔 آخر التنبيهات
        <button onclick="document.getElementById('da-feed-panel').style.display='none'"
          style="float:left;background:none;border:none;cursor:pointer;color:var(--text-muted,#9ca3af);font-size:14px">✕</button>
      </div>
      ${DA.feed.slice(0,12).map(f=>`
      <div class="da-feed-item">
        <div class="da-feed-icon">${f.icon}</div>
        <div class="da-feed-body">
          <div class="da-feed-title">${esc(f.title)}</div>
          <div class="da-feed-sub">${esc(f.sub)}</div>
          <div class="da-feed-time">${esc(f.time)}</div>
        </div>
      </div>`).join('')}`;
  }

  window.DA_toggleFeed = function () {
    ensureStyles();
    let panel = document.getElementById('da-feed-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'da-feed-panel';
      document.body.appendChild(panel);
    }
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      renderFeedPanel();
      DA.newCount = 0;
      updateBell();
    }
  };

  /* ── Bell في الـ Navbar ─────────────────────────── */
  function updateBell() {
    const el = document.getElementById('da-bell-badge');
    if (!el) return;
    el.textContent = DA.newCount > 0 ? DA.newCount : '';
    el.style.display = DA.newCount > 0 ? 'inline-flex' : 'none';
  }

  function injectBellIfNeeded() {
    if (document.getElementById('da-bell')) return;
    const header = document.querySelector('.admin-main h2, .admin-main h1, .admin-sidebar-header');
    if (!header) return;
    const bell = document.createElement('button');
    bell.id = 'da-bell';
    bell.setAttribute('onclick', 'DA_toggleFeed()');
    bell.style.cssText = `
      position:fixed; bottom:24px; left:20px; z-index:9997;
      width:48px; height:48px; border-radius:50%;
      background:linear-gradient(135deg,#7c3aed,#0d9488);
      color:#fff; font-size:20px; border:none; cursor:pointer;
      box-shadow:0 4px 16px rgba(124,58,237,0.4);
      display:flex; align-items:center; justify-content:center;
    `;
    bell.innerHTML = `🔔<span id="da-bell-badge" style="
      display:none; position:absolute; top:-4px; left:-4px;
      background:#ef4444; color:#fff; border-radius:99px;
      font-size:10px; font-weight:900; font-family:'Cairo',sans-serif;
      min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px;
    "></span>`;
    document.body.appendChild(bell);
  }

  /* ── معالجة كل تغيير ────────────────────────────── */
  function handleChange(doc, changeType) {
    const d  = doc.data() || {};
    const id = doc.id;

    const isNew      = changeType === 'added';
    const isModified = changeType === 'modified';

    const createdMs = d.createdAt?.toMillis ? d.createdAt.toMillis() : 0;
    const tooOld    = createdMs && createdMs < DA.attachedAt - 1000;

    if (isNew) {
      if (DA.seenIds.has(id) || tooOld) { DA.seenIds.add(id); return; }
      DA.seenIds.add(id);
      const title = '🚚 طلب توصيل جديد!';
      const sub   = `طلب #${d.orderId || id.slice(-6)} · ${d.customerName || 'عميل'} · ${d.customerAddr || ''}`.trim();
      playChime();
      browserNotify(title, sub);
      showBanner(title, sub, id);
      DA.feed.unshift({ icon: '🚚', title, sub, time: fmtTime(d.createdAt) });
      DA.newCount++;
      updateBell();
    } else if (isModified) {
      const prevStatus = DA._lastStatus?.[id];
      const newStatus  = d.status;
      DA._lastStatus   = DA._lastStatus || {};
      DA._lastStatus[id] = newStatus;

      const statusLabels = {
        accepted:    'تم قبول الطلب ✅',
        cancelled:   'تم إلغاء الطلب ❌',
        completed:   'اكتمل الطلب ✅',
        delivered:   'تم التسليم 📦',
      };
      if (prevStatus && prevStatus !== newStatus && statusLabels[newStatus]) {
        const title = `${statusLabels[newStatus]}`;
        const sub   = `طلب #${d.orderId || id.slice(-6)}`;
        playChime();
        browserNotify(title, sub);
        showBanner(title, sub, id);
        DA.feed.unshift({ icon: '🔔', title, sub, time: fmtTime(d.updatedAt || d.createdAt) });
        DA.newCount++;
        updateBell();
      }
    }
  }

  /* ── Attach / Detach ─────────────────────────────── */
  function detach() {
    try { DA.unsub && DA.unsub(); } catch (e) {}
    DA.unsub       = null;
    DA.boundUid    = null;
    DA.seenIds     = new Set();
    DA._lastStatus = {};
    DA.feed        = [];
    DA.newCount    = 0;
    const bell = document.getElementById('da-bell');
    if (bell) bell.remove();
    const panel = document.getElementById('da-feed-panel');
    if (panel) panel.remove();
    window.DA_closeBanner?.();
  }

  function attach(user) {
    if (typeof db === 'undefined' || !db?.collection) return;
    if (DA.boundUid === user.uid) return;
    detach();
    DA.boundUid    = user.uid;
    DA.attachedAt  = Date.now();
    DA._lastStatus = {};
    ensureStyles();

    setTimeout(injectBellIfNeeded, 800);

    try {
      DA.unsub = db.collection('orders')
        .where('driverId', '==', user.uid)
        .onSnapshot(snap => {
          let needsRender = false;

          snap.docChanges().forEach(ch => {
            handleChange(ch.doc, ch.type);

            const docData = { id: ch.doc.id, ...ch.doc.data() };
            if (!window.AppData?.orders) return;

            if (ch.type === 'added') {
              if (!window.AppData.orders.find(o => o.id === docData.id)) {
                window.AppData.orders.unshift(docData);
                needsRender = true;
              }
            } else if (ch.type === 'modified') {
              const idx = window.AppData.orders.findIndex(o => o.id === docData.id);
              if (idx >= 0) { window.AppData.orders[idx] = docData; needsRender = true; }
            } else if (ch.type === 'removed') {
              window.AppData.orders = window.AppData.orders.filter(o => o.id !== docData.id);
              needsRender = true;
            }
          });

          if (needsRender && typeof window.render === 'function') {
            window.render().then(() => setTimeout(injectBellIfNeeded, 300));
          }
        }, err => console.warn('[DA] orders listener error:', err));
    } catch (e) { console.warn('[DA] failed to attach listener:', e); }
  }

  /* ── ربط بحالة المصادقة ─────────────────────────── */
  function onUserChanged(user) {
    if (user?.role === 'driver') {
      attach(user);
    } else {
      detach();
    }
  }

  let _lastUid = null;
  function poll() {
    const u = window.State?.currentUser;
    const uid = u?.uid || null;
    if (uid !== _lastUid) {
      _lastUid = uid;
      onUserChanged(u);
    }
  }

  setInterval(poll, 1500);
  setTimeout(poll, 2000);

  window.DA_toggleSound = function () {
    DA.soundOff = !DA.soundOff;
    localStorage.setItem('da_sound_off', DA.soundOff ? '1' : '0');
  };

  console.log('[DriverAlerts] نظام إشعارات المندوب جاهز 🔔');
})();
