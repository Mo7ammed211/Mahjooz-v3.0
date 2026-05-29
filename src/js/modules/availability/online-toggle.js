/* ============================================================
   Online / Offline Toggle — نظام الدوام والإتاحة
   ------------------------------------------------------------
   للمزود (vendor/provider): يفتح / يغلق المتجر
   للمندوب (driver):         يبدأ / ينهي الدوام

   يُخزَّن في Firestore users/{uid}:
     isOnline          : boolean (default true)
     onlineUpdatedAt   : serverTimestamp

   الدوال العامة:
     toggleVendorOnline()
     toggleDriverOnline()
     renderAvailabilityToggle(type)   → HTML string (للسايدبار)
   ============================================================ */
(function () {
  'use strict';

  /* ── CSS ──────────────────────────────────────────── */
  const css = `
  .avail-card {
    margin: 14px 10px 6px;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid;
    transition: border-color 0.35s, background 0.35s;
  }
  .avail-card.online  { border-color: rgba(16,185,129,0.45); background: rgba(16,185,129,0.07); }
  .avail-card.offline { border-color: rgba(239,68,68,0.35);  background: rgba(239,68,68,0.06);  }

  .avail-inner {
    padding: 13px 14px;
    display: flex;
    align-items: center;
    gap: 11px;
  }

  /* حلقة النبض */
  .avail-dot {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
  .avail-dot::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    animation: avail-pulse 2s infinite;
  }
  .avail-card.online  .avail-dot { background: rgba(16,185,129,0.2); }
  .avail-card.online  .avail-dot::before { border: 2px solid rgba(16,185,129,0.5); }
  .avail-card.offline .avail-dot { background: rgba(239,68,68,0.12); animation: none; }
  .avail-card.offline .avail-dot::before { display: none; }

  @keyframes avail-pulse {
    0%   { transform: scale(1);    opacity: 0.9; }
    50%  { transform: scale(1.25); opacity: 0.3; }
    100% { transform: scale(1);    opacity: 0.9; }
  }

  .avail-info { flex: 1; min-width: 0; }
  .avail-label {
    font-size: 13px;
    font-weight: 900;
    line-height: 1.2;
    font-family: 'Cairo', sans-serif;
  }
  .avail-card.online  .avail-label { color: #10b981; }
  .avail-card.offline .avail-label { color: #ef4444; }

  .avail-sub {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 2px;
    font-family: 'Cairo', sans-serif;
  }

  /* مفتاح iOS */
  .avail-switch {
    position: relative;
    width: 46px;
    height: 26px;
    border-radius: 99px;
    border: none;
    cursor: pointer;
    transition: background 0.3s;
    flex-shrink: 0;
    padding: 0;
  }
  .avail-switch.on  { background: #10b981; }
  .avail-switch.off { background: #d1d5db; }
  .avail-thumb {
    position: absolute;
    top: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    transition: left 0.3s cubic-bezier(.4,0,.2,1);
  }
  .avail-switch.on  .avail-thumb { left: 23px; }
  .avail-switch.off .avail-thumb { left:  3px; }

  /* حالة الانتظار */
  .avail-switch:disabled { opacity: 0.5; cursor: not-allowed; }

  /* شريط الحالة في أعلى الصفحة الرئيسية */
  .avail-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-radius: 14px;
    margin-bottom: 20px;
    font-family: 'Cairo', sans-serif;
    font-size: 13px;
    font-weight: 700;
    border: 1.5px solid;
  }
  .avail-banner.offline {
    background: rgba(239,68,68,0.07);
    border-color: rgba(239,68,68,0.25);
    color: #ef4444;
  }
  .avail-banner.online {
    background: rgba(16,185,129,0.07);
    border-color: rgba(16,185,129,0.25);
    color: #10b981;
  }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── فمت وقت آخر تغيير ─────────────────────────── */
  function _fmtTime(ts) {
    if (!ts) return '';
    let d;
    if (ts.toDate) d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  }

  /* ══════════════════════════════════════════════════
     renderAvailabilityToggle — HTML السايدبار
  ══════════════════════════════════════════════════ */
  window.renderAvailabilityToggle = function (type) {
    const u  = State.currentUser;
    const isOnline = u?.isOnline !== false;
    const updTime  = _fmtTime(u?.onlineUpdatedAt);

    const cfg = type === 'driver'
      ? {
          onIcon:    '🟢',
          offIcon:   '🔴',
          onLabel:   'أنت في الخدمة',
          offLabel:  'خارج الخدمة',
          onSub:     'تستقبل الطلبات',
          offSub:    'لا تستقبل طلبات',
          fn:        'toggleDriverOnline()',
        }
      : {
          onIcon:    '🏪',
          offIcon:   '🚫',
          onLabel:   'المتجر مفتوح',
          offLabel:  'المتجر مغلق',
          onSub:     'يستقبل طلبات العملاء',
          offSub:    'موقوف عن الاستقبال',
          fn:        'toggleVendorOnline()',
        };

    const label  = isOnline ? cfg.onLabel  : cfg.offLabel;
    const icon   = isOnline ? cfg.onIcon   : cfg.offIcon;
    const sub    = isOnline ? cfg.onSub    : cfg.offSub;
    const cls    = isOnline ? 'online'     : 'offline';
    const swCls  = isOnline ? 'on'         : 'off';

    return `
    <div class="avail-card ${cls}" id="avail-card-main">
      <div class="avail-inner">
        <div class="avail-dot">${icon}</div>
        <div class="avail-info">
          <div class="avail-label">${label}</div>
          <div class="avail-sub">${sub}${updTime ? ' · ' + updTime : ''}</div>
        </div>
        <button class="avail-switch ${swCls}" id="avail-switch-btn"
                onclick="${cfg.fn}"
                aria-label="تبديل الحالة">
          <span class="avail-thumb"></span>
        </button>
      </div>
    </div>`;
  };

  /* ══════════════════════════════════════════════════
     renderAvailabilityBanner — شريط التحذير في المحتوى
  ══════════════════════════════════════════════════ */
  window.renderAvailabilityBanner = function (type) {
    const u = State.currentUser;
    if (u?.isOnline !== false) return '';
    const isDriver = type === 'driver';
    return `
    <div class="avail-banner offline">
      <span style="font-size:22px">${isDriver ? '🔴' : '🚫'}</span>
      <div style="flex:1">
        <div>${isDriver ? 'أنت خارج الخدمة حالياً' : 'المتجر مغلق حالياً'}</div>
        <div style="font-size:11px;font-weight:400;opacity:0.8;margin-top:2px">
          ${isDriver
            ? 'لن يتم تعيينك على طلبات جديدة. فعّل الدوام لاستقبال الطلبات.'
            : 'لن تصلك طلبات جديدة. افتح المتجر لاستقبال العملاء.'}
        </div>
      </div>
      <button onclick="${isDriver ? 'toggleDriverOnline()' : 'toggleVendorOnline()'}"
              style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;white-space:nowrap">
        ${isDriver ? '▶ ابدأ الدوام' : '▶ افتح المتجر'}
      </button>
    </div>`;
  };

  /* ══════════════════════════════════════════════════
     _doToggle — منطق مشترك للتبديل
  ══════════════════════════════════════════════════ */
  async function _doToggle(type) {
    const u = State.currentUser;
    if (!u?.uid) { toast('يجب تسجيل الدخول أولاً', 'error'); return; }

    const nowOnline = u.isOnline !== false;
    const willOnline = !nowOnline;
    const isDriver = type === 'driver';

    /* تحديث بصري فوري للمفتاح قبل انتهاء الطلب */
    const btn = document.getElementById('avail-switch-btn');
    if (btn) {
      btn.disabled = true;
      btn.classList.toggle('on',  willOnline);
      btn.classList.toggle('off', !willOnline);
    }
    const card = document.getElementById('avail-card-main');
    if (card) {
      card.classList.toggle('online',  willOnline);
      card.classList.toggle('offline', !willOnline);
    }

    try {
      await fsUpdate('users', u.uid, {
        isOnline:        willOnline,
        onlineUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      State.currentUser.isOnline        = willOnline;
      State.currentUser.onlineUpdatedAt = new Date();

      if (willOnline) {
        toast(isDriver ? '▶ بدأت الدوام — تستقبل الطلبات الآن 🟢' : '🏪 المتجر مفتوح — يستقبل الطلبات الآن', 'success');
      } else {
        toast(isDriver ? '⏹ انتهى الدوام — لن تستقبل طلبات جديدة 🔴' : '🚫 تم إغلاق المتجر — لن تصلك طلبات جديدة', 'success');
      }

      await render();
    } catch (err) {
      console.error('[OnlineToggle] خطأ:', err);
      toast('حدث خطأ أثناء تحديث الحالة', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.toggle('on',  nowOnline);
        btn.classList.toggle('off', !nowOnline);
      }
    }
  }

  window.toggleVendorOnline = () => _doToggle('vendor');
  window.toggleDriverOnline = () => _doToggle('driver');

  /* ══════════════════════════════════════════════════
     isVendorOpen — للاستخدام في صفحة الحجز
  ══════════════════════════════════════════════════ */
  window.isVendorOpen = function (vendorUid) {
    if (!vendorUid) return true;
    const vendorUser = (AppData.users || []).find(u => u.uid === vendorUid || u.id === vendorUid);
    return vendorUser ? vendorUser.isOnline !== false : true;
  };

  /* ══════════════════════════════════════════════════
     isDriverAvailable — للاستخدام في نظام التعيين
  ══════════════════════════════════════════════════ */
  window.isDriverAvailable = function (driverUid) {
    if (!driverUid) return true;
    const driverUser = (AppData.users || []).find(u => u.uid === driverUid || u.id === driverUid);
    return driverUser ? driverUser.isOnline !== false : true;
  };

  /* ══════════════════════════════════════════════════
     renderAvailabilityCard — البطاقة البارزة في أعلى الداشبورد
  ══════════════════════════════════════════════════ */
  window.renderAvailabilityCard = function (type) {
    const u = State.currentUser;
    const isOnline = u?.isOnline !== false;
    const updTime  = _fmtTime(u?.onlineUpdatedAt);
    const isDriver = type === 'driver';

    const cfg = isDriver
      ? {
          onIcon:     '🟢',
          offIcon:    '🔴',
          onTitle:    'أنت في الخدمة',
          offTitle:   'أنت خارج الخدمة',
          onDesc:     'تستقبل طلبات التوصيل الآن',
          offDesc:    'لن يتم تعيينك على أي طلب جديد',
          onAction:   'إيقاف الدوام',
          offAction:  'بدء الدوام',
          fn:         'toggleDriverOnline()',
          onGrad:     'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))',
          offGrad:    'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.05))',
          onBorder:   'rgba(16,185,129,0.3)',
          offBorder:  'rgba(239,68,68,0.25)',
          onColor:    '#10b981',
          offColor:   '#ef4444',
          typeLabel:  'حالة المندوب',
        }
      : {
          onIcon:     '🏪',
          offIcon:    '🚫',
          onTitle:    'المتجر مفتوح',
          offTitle:   'المتجر مغلق',
          onDesc:     'يستقبل طلبات العملاء الآن',
          offDesc:    'لن تصلك طلبات جديدة من العملاء',
          onAction:   'إغلاق المتجر',
          offAction:  'فتح المتجر',
          fn:         'toggleVendorOnline()',
          onGrad:     'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))',
          offGrad:    'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.05))',
          onBorder:   'rgba(16,185,129,0.3)',
          offBorder:  'rgba(239,68,68,0.25)',
          onColor:    '#10b981',
          offColor:   '#ef4444',
          typeLabel:  'حالة المتجر',
        };

    const color  = isOnline ? cfg.onColor  : cfg.offColor;
    const grad   = isOnline ? cfg.onGrad   : cfg.offGrad;
    const border = isOnline ? cfg.onBorder : cfg.offBorder;
    const icon   = isOnline ? cfg.onIcon   : cfg.offIcon;
    const title  = isOnline ? cfg.onTitle  : cfg.offTitle;
    const desc   = isOnline ? cfg.onDesc   : cfg.offDesc;
    const action = isOnline ? cfg.onAction : cfg.offAction;
    const swCls  = isOnline ? 'on' : 'off';
    const pulseCls = isOnline ? 'avail-pulse-dot' : '';

    return `
    <div style="background:${grad};border:2px solid ${border};border-radius:20px;padding:20px 22px;margin-bottom:22px;font-family:'Cairo',sans-serif;direction:rtl;transition:all 0.35s" id="avail-big-card">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">

        <!-- أيقونة الحالة مع نبض -->
        <div style="position:relative;width:60px;height:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'};border-radius:18px;font-size:28px;">
          ${icon}
          ${isOnline ? `<span style="position:absolute;top:-3px;right:-3px;width:14px;height:14px;background:#10b981;border-radius:50%;border:2px solid var(--bg-card,#1e293b);animation:avail-pulse 1.8s infinite"></span>` : `<span style="position:absolute;top:-3px;right:-3px;width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid var(--bg-card,#1e293b)"></span>`}
        </div>

        <!-- معلومات الحالة -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:${color};opacity:0.7;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px">${cfg.typeLabel}</div>
          <div style="font-size:17px;font-weight:900;color:${color};line-height:1.2;">${title}</div>
          <div style="font-size:12px;color:var(--text-muted,#94a3b8);margin-top:3px;">${desc}${updTime ? ` · آخر تغيير ${updTime}` : ''}</div>
        </div>

        <!-- مفتاح التبديل الكبير -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
          <button class="avail-switch ${swCls}" id="avail-switch-btn"
                  onclick="${cfg.fn}"
                  style="width:58px;height:32px;"
                  aria-label="تبديل الحالة">
            <span class="avail-thumb" style="width:24px;height:24px;${isOnline ? 'left:30px' : 'left:4px'}"></span>
          </button>
          <div style="font-size:10px;font-weight:700;color:${color}">${isOnline ? '● مفعّل' : '○ موقوف'}</div>
        </div>

        <!-- زر الإجراء السريع -->
        <button onclick="${cfg.fn}"
                style="background:${color};color:#fff;border:none;border-radius:12px;padding:10px 18px;font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 4px 12px ${color}40;transition:all 0.2s;flex-shrink:0;"
                onmouseover="this.style.opacity='0.88'"
                onmouseout="this.style.opacity='1'">
          ${isOnline ? '⏹ ' : '▶ '}${action}
        </button>
      </div>
    </div>`;
  };

  console.log('[OnlineToggle] نظام الدوام والإتاحة جاهز ✅');
})();
