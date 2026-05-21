// ═══════════════════════════════════════════════════════
//  محجوز v2.5 — Phase 5
//  Smart Admin Alerts:
//    • Revenue drop today vs yesterday (>30%)
//    • High cancellation rate last 24h (>30%)
//    • No orders in last 6 hours during business hours
//    • Pending recharge requests pile-up (> 5)
//    • High-value order today (≥ 5,000 SAR)
//    • Inactive vendors (no orders in last 7 days)
//
//  Each alert:
//    - Renders as a colored banner inside the Advanced Stats panel
//    - Pushes once-per-day (rate-limited via localStorage) to the
//      admin's notification bell so they get pinged in real-time.
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('smart_alerts',         'تنبيهات ذكية',                 'Smart Alerts');
  add('all_clear',            'كل شيء على ما يرام ✅',          'All clear ✅');
  add('all_clear_sub',        'لا توجد تنبيهات تحتاج لانتباهك حالياً.', 'No alerts requiring your attention right now.');
  add('alert_revenue_drop_t', 'انخفاض في الإيرادات اليوم',     'Revenue drop today');
  add('alert_revenue_drop_b', 'إيرادات اليوم {today} ر مقابل {yesterday} ر بالأمس (انخفاض {pct}%).', 'Today\'s revenue {today} SAR vs {yesterday} SAR yesterday (down {pct}%).');
  add('alert_cancel_high_t',  'نسبة إلغاء مرتفعة',             'High cancellation rate');
  add('alert_cancel_high_b',  'تم إلغاء {n} من {total} طلب آخر 24 ساعة ({pct}%).', '{n} of {total} orders cancelled in last 24h ({pct}%).');
  add('alert_no_orders_t',    'لا توجد طلبات منذ 6 ساعات',     'No orders for 6+ hours');
  add('alert_no_orders_b',    'لم يتم استلام أي طلب جديد خلال آخر {hrs} ساعة.', 'No new orders received in the last {hrs} hours.');
  add('alert_recharges_t',    'طلبات شحن معلقة كثيرة',         'Many pending recharges');
  add('alert_recharges_b',    'يوجد {n} طلب شحن بانتظار الموافقة.', '{n} recharge requests waiting for approval.');
  add('alert_big_order_t',    'طلب بقيمة عالية اليوم',         'High-value order today');
  add('alert_big_order_b',    'أكبر طلب اليوم بقيمة {amount} ر — {svc}.', 'Largest order today: {amount} SAR — {svc}.');
  add('alert_inactive_t',     'مزودون غير نشطين',              'Inactive vendors');
  add('alert_inactive_b',     '{n} من أصحاب الخدمات بدون طلبات منذ أكثر من 7 أيام.', '{n} vendors with no orders in 7+ days.');
  add('view_orders_btn',      'عرض الطلبات',                   'View orders');
  add('view_recharges_btn',   'إدارة المحافظ',                 'Open wallet');
  add('view_vendors_btn',     'عرض المزودين',                  'View vendors');
  add('dismiss',              'إخفاء',                         'Dismiss');
})();

// ─── Helpers ──────────────────────────────────────────
function ph5_toDate(ts) {
  if (!ts) return null;
  if (ts.toDate)  return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') { const d = new Date(ts); return isNaN(d) ? null : d; }
  if (ts instanceof Date) return ts;
  return null;
}
function ph5_fmt(n) { return Number(n||0).toLocaleString(typeof getLang === 'function' && getLang() === 'en' ? 'en' : 'ar-EG'); }
function ph5_fill(tpl, vals) { return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vals ? vals[k] : `{${k}}`)); }

// ─── Local-storage key for dismissed alerts ──────────
const PH5_DISMISS_KEY = 'mahjooz_dismissed_alerts_v1';
function ph5_getDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(PH5_DISMISS_KEY) || '{}');
    // Auto-expire after 12h
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    let changed = false;
    for (const k of Object.keys(raw)) if (raw[k] < cutoff) { delete raw[k]; changed = true; }
    if (changed) localStorage.setItem(PH5_DISMISS_KEY, JSON.stringify(raw));
    return raw;
  } catch (e) { return {}; }
}
function ph5_dismissAlert(id) {
  const d = ph5_getDismissed();
  d[id] = Date.now();
  try { localStorage.setItem(PH5_DISMISS_KEY, JSON.stringify(d)); } catch(_) {}
  if (typeof setAdminTab === 'function' && State?.adminTab === 'advanced') setAdminTab('advanced');
}
window.ph5_dismissAlert = ph5_dismissAlert;

// ─── Core: compute alerts from current AppData ────────
function computeSmartAlerts() {
  const orders = (AppData?.orders || []).map(o => ({ ...o, _date: ph5_toDate(o.createdAt) }));
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest0  = new Date(today0.getTime() - 86400000);
  const day24  = new Date(now.getTime() - 24 * 3600 * 1000);
  const hr6    = new Date(now.getTime() - 6  * 3600 * 1000);
  const week7  = new Date(now.getTime() - 7  * 86400000);

  const revToday = orders.filter(o => o._date && o._date >= today0 && (o.status==='completed' || o.status==='delivered'))
                         .reduce((a,o)=>a+(Number(o.total)||0), 0);
  const revYest  = orders.filter(o => o._date && o._date >= yest0 && o._date < today0 && (o.status==='completed' || o.status==='delivered'))
                         .reduce((a,o)=>a+(Number(o.total)||0), 0);
  const last24   = orders.filter(o => o._date && o._date >= day24);
  const cancel24 = last24.filter(o => o.status === 'cancelled');
  const last6h   = orders.filter(o => o._date && o._date >= hr6);
  const pendRech = (AppData?.rechargeReqs || []).filter(r => r.status === 'pending');
  const todayOrders = orders.filter(o => o._date && o._date >= today0);
  const biggestToday = todayOrders.reduce((m,o) => (Number(o.total)||0) > (Number(m?.total)||0) ? o : m, null);

  const vendors = (AppData?.users || []).filter(u => u.role === 'vendor');
  const vendorOrders7d = new Set(orders.filter(o => o._date && o._date >= week7).map(o => o.vendorId).filter(Boolean));
  const inactiveVendors = vendors.filter(v => !vendorOrders7d.has(v.uid));

  const alerts = [];

  // 1) Revenue drop (need yesterday > 0 to compare meaningfully)
  if (revYest > 0) {
    const dropPct = Math.round(((revYest - revToday) / revYest) * 100);
    if (dropPct >= 30) {
      alerts.push({
        id: 'revenue_drop_' + today0.toISOString().slice(0,10),
        severity: 'critical',
        icon: '📉',
        title: t('alert_revenue_drop_t'),
        body: ph5_fill(t('alert_revenue_drop_b'), { today: ph5_fmt(revToday), yesterday: ph5_fmt(revYest), pct: dropPct }),
        action: { label: t('view_orders_btn'), tab: 'orders' },
      });
    }
  }

  // 2) High cancellation rate (need ≥5 orders for signal)
  if (last24.length >= 5) {
    const pct = Math.round((cancel24.length / last24.length) * 100);
    if (pct >= 30) {
      alerts.push({
        id: 'cancel_high_' + today0.toISOString().slice(0,10),
        severity: 'warning',
        icon: '⚠️',
        title: t('alert_cancel_high_t'),
        body: ph5_fill(t('alert_cancel_high_b'), { n: cancel24.length, total: last24.length, pct }),
        action: { label: t('view_orders_btn'), tab: 'orders' },
      });
    }
  }

  // 3) No orders in last 6h during business hours (8am – 10pm)
  const hr = now.getHours();
  if (last6h.length === 0 && hr >= 8 && hr <= 22 && orders.length > 0) {
    alerts.push({
      id: 'no_orders_' + today0.toISOString().slice(0,10) + '_' + hr,
      severity: 'warning',
      icon: '🕒',
      title: t('alert_no_orders_t'),
      body: ph5_fill(t('alert_no_orders_b'), { hrs: 6 }),
      action: { label: t('view_orders_btn'), tab: 'orders' },
    });
  }

  // 4) Pending recharges pile-up
  if (pendRech.length > 5) {
    alerts.push({
      id: 'recharges_pile_' + today0.toISOString().slice(0,10),
      severity: 'warning',
      icon: '💳',
      title: t('alert_recharges_t'),
      body: ph5_fill(t('alert_recharges_b'), { n: pendRech.length }),
      action: { label: t('view_recharges_btn'), tab: 'wallet' },
    });
  }

  // 5) High-value order today
  if (biggestToday && Number(biggestToday.total) >= 5000) {
    alerts.push({
      id: 'big_order_' + (biggestToday.id || biggestToday.orderId || 'x'),
      severity: 'info',
      icon: '💎',
      title: t('alert_big_order_t'),
      body: ph5_fill(t('alert_big_order_b'), {
        amount: ph5_fmt(biggestToday.total),
        svc: (biggestToday.svcIcon||'') + ' ' + (biggestToday.svcName || biggestToday.serviceId || '—'),
      }),
      action: { label: t('view_orders_btn'), tab: 'orders' },
    });
  }

  // 6) Inactive vendors (need at least 1 vendor + 1 order overall)
  if (vendors.length > 0 && orders.length > 0 && inactiveVendors.length > 0) {
    alerts.push({
      id: 'inactive_vendors_' + today0.toISOString().slice(0,10),
      severity: 'info',
      icon: '😴',
      title: t('alert_inactive_t'),
      body: ph5_fill(t('alert_inactive_b'), { n: inactiveVendors.length }),
      action: { label: t('view_vendors_btn'), tab: 'users' },
    });
  }

  // Filter out user-dismissed alerts
  const dismissed = ph5_getDismissed();
  return alerts.filter(a => !dismissed[a.id]);
}
window.computeSmartAlerts = computeSmartAlerts;

// ─── Render: alerts banner block ──────────────────────
function renderSmartAlertsBanner() {
  const u = State?.currentUser;
  if (!u || !['admin','cs','staff'].includes(u.role)) return '';
  const alerts = computeSmartAlerts();

  const tone = {
    critical: { bg:'rgba(239,68,68,.10)',  bd:'#ef4444', fg:'#fca5a5' },
    warning:  { bg:'rgba(245,158,11,.10)', bd:'#f59e0b', fg:'#fcd34d' },
    info:     { bg:'rgba(59,130,246,.10)', bd:'#3b82f6', fg:'#93c5fd' },
  };

  if (!alerts.length) {
    return `
      <div class="adv-alerts-card" style="background:rgba(16,185,129,.08);border:1px solid #10b981;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px">
        <div style="font-size:28px">✅</div>
        <div>
          <div style="font-weight:700;color:#10b981">${t('all_clear')}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${t('all_clear_sub')}</div>
        </div>
      </div>`;
  }

  return `
    <div class="adv-alerts-wrap" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px">
        <span style="font-size:18px">🛎️</span>${t('smart_alerts')}
        <span style="background:#ef4444;color:#fff;font-size:11px;padding:2px 8px;border-radius:99px;font-weight:700">${alerts.length}</span>
      </div>
      ${alerts.map(a => {
        const c = tone[a.severity] || tone.info;
        const actionBtn = a.action ? `<button class="btn btn-secondary" onclick="setAdminTab('${a.action.tab}')" style="padding:6px 12px;border-radius:8px;font-size:12px">${a.action.label} ←</button>` : '';
        return `
        <div class="adv-alert-card" style="background:${c.bg};border:1px solid ${c.bd};border-right:4px solid ${c.bd};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:24px">${a.icon}</div>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700;color:${c.fg};font-size:14px">${a.title}</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:3px">${a.body}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${actionBtn}
            <button class="btn btn-ghost" onclick="ph5_dismissAlert('${a.id}')" title="${t('dismiss')}" style="padding:6px 10px;border-radius:8px;font-size:12px;background:transparent;border:1px solid var(--border,#333);color:var(--text-muted);cursor:pointer">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
window.renderSmartAlertsBanner = renderSmartAlertsBanner;

// ─── Push alerts to the admin's notification bell ────
//     Rate-limited per-alert-id once every 12 hours.
const PH5_PUSH_KEY = 'mahjooz_pushed_alerts_v1';
function ph5_getPushed() {
  try {
    const raw = JSON.parse(localStorage.getItem(PH5_PUSH_KEY) || '{}');
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    let changed = false;
    for (const k of Object.keys(raw)) if (raw[k] < cutoff) { delete raw[k]; changed = true; }
    if (changed) localStorage.setItem(PH5_PUSH_KEY, JSON.stringify(raw));
    return raw;
  } catch (e) { return {}; }
}

async function ph5_pushNewAlertsToBell() {
  const u = State?.currentUser;
  if (!u || u.role !== 'admin') return;
  if (typeof pushNotification !== 'function') return;
  const alerts = computeSmartAlerts();
  if (!alerts.length) return;

  const pushed = ph5_getPushed();
  const newOnes = alerts.filter(a => !pushed[a.id]);
  if (!newOnes.length) return;

  for (const a of newOnes) {
    try {
      await pushNotification({
        uid: u.uid,
        title: a.icon + ' ' + a.title,
        body:  a.body,
        type:  a.severity,
        link:  a.action ? `admin?${encodeURIComponent(JSON.stringify({ tab: a.action.tab }))}` : null,
      });
      pushed[a.id] = Date.now();
    } catch (e) { /* swallow */ }
  }
  try { localStorage.setItem(PH5_PUSH_KEY, JSON.stringify(pushed)); } catch(_) {}
  if (typeof refreshNotifBell === 'function') refreshNotifBell();
}
window.ph5_pushNewAlertsToBell = ph5_pushNewAlertsToBell;

// ─── Auto-trigger after each render (admins only) ─────
const __ph5_originalRender = window.render;
window.render = async function (...args) {
  const result = await __ph5_originalRender.apply(this, args);
  try {
    const u = State?.currentUser;
    if (u && u.role === 'admin') {
      // Fire-and-forget; debounce a bit
      clearTimeout(window.__ph5_pushTimer);
      window.__ph5_pushTimer = setTimeout(() => {
        ph5_pushNewAlertsToBell().catch(() => {});
      }, 1200);
    }
  } catch (e) { /* swallow */ }
  return result;
};
