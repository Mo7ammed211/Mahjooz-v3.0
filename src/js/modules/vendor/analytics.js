// ═══════════════════════════════════════════════════════
//  محجوز v3.3 — Phase 13 (Vendor Analytics Dashboard)
//  - تبويب جديد "📊 تحليلاتي" داخل لوحة صاحب الخدمة
//  - KPIs: إيرادات، عدد الطلبات، متوسط التقييم، نسبة الإلغاء
//  - مخططات: إيرادات يومية، أكثر الخدمات طلباً، ساعات الذروة
// ═══════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('vendor_analytics', '📊 تحليلاتي',         '📊 My analytics');
  add('va_revenue',       'الإيرادات (آخر 30 يوم)','Revenue (30d)');
  add('va_orders',        'عدد الطلبات',          'Orders');
  add('va_rating',        'متوسط التقييم',        'Avg rating');
  add('va_cancel_pct',    'نسبة الإلغاء',         'Cancellation %');
  add('va_top_services',  'أكثر الخدمات طلباً',   'Top services');
  add('va_peak_hours',    'ساعات الذروة',         'Peak hours');
  add('va_daily_revenue', 'الإيرادات اليومية',    'Daily revenue');
  add('va_no_data',       'لا توجد بيانات بعد',  'No data yet');
})();

// ── Add tab to vendor sidebar
(function patchRenderVendor() {
  const __orig = window.renderVendor;
  if (typeof __orig !== 'function') { setTimeout(patchRenderVendor, 600); return; }
  window.renderVendor = function () {
    if (State.currentUser?.role !== 'vendor' && State.currentUser?.role !== 'provider') return __orig.apply(this, arguments);
    if (State.vendorTab === 'analytics') {
      // Render the analytics view inside the same shell as renderVendor
      const tabs = [
        ['orders','📋','الطلبات'], ['earnings','💰','الأرباح'],
        ['services','🛎️','خدماتي'], ['profile','👤','الملف'],
        ['analytics','📊','تحليلاتي'],
      ];
      return `
        <div id="app-content">
          <div class="admin-layout">
            <aside class="admin-sidebar">
              ${tabs.map(([tk,ic,l])=>`
                <button class="admin-nav-item${State.vendorTab===tk?' active':''}" onclick="setVendorTab('${tk}')">
                  <span>${ic}</span><span>${l}</span>
                </button>`).join('')}
            </aside>
            <main class="admin-main">${ph13_renderAnalytics()}</main>
          </div>
        </div>`;
    }
    let html = __orig.apply(this, arguments);
    // Append the new tab button to existing sidebar
    const newBtn = `<button class="admin-nav-item" onclick="setVendorTab('analytics')"><span>📊</span><span>تحليلاتي</span></button>`;
    html = html.replace(/(<\/aside>)/, `${newBtn}$1`);
    return html;
  };
})();

window.ph13_renderAnalytics = function () {
  const u = State.currentUser;
  if (!u || (u.role !== 'vendor' && u.role !== 'provider')) return '<div class="empty-state">غير مصرّح</div>';
  const orders = AppData.orders.filter(o => o.vendorId === u.uid || o.providerUid === u.uid);
  const ratings = (AppData.ratings || []).filter(r => orders.find(o => o.id === r.orderId));

  // KPIs
  const completed = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const revenue = completed.reduce((s, o) => s + (o.servicePrice || 0), 0);
  const avgRating = ratings.length ? (ratings.reduce((s, r) => s + (r.serviceStars || r.stars || 0), 0) / ratings.length).toFixed(1) : '—';
  const cancelPct = orders.length ? Math.round(cancelled.length * 100 / orders.length) : 0;

  // Daily revenue (last 30 days)
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    days.push({ ts: d.getTime(), label: `${d.getMonth()+1}/${d.getDate()}`, total: 0 });
  }
  completed.forEach(o => {
    const ts = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : null;
    if (!ts) return;
    const dayStart = new Date(ts); dayStart.setHours(0,0,0,0);
    const bucket = days.find(d => d.ts === dayStart.getTime());
    if (bucket) bucket.total += (o.servicePrice || 0);
  });

  // Top services
  const svcMap = {};
  orders.forEach(o => {
    if (!o.svcName) return;
    if (!svcMap[o.svcName]) svcMap[o.svcName] = { name: o.svcName, icon: o.svcIcon || '🔷', count: 0, revenue: 0 };
    svcMap[o.svcName].count++;
    if (o.status === 'completed' || o.status === 'delivered') svcMap[o.svcName].revenue += (o.servicePrice || 0);
  });
  const topSvc = Object.values(svcMap).sort((a,b) => b.count - a.count).slice(0, 6);

  // Peak hours histogram (24 buckets)
  const hours = Array.from({length:24}, (_,h) => ({ h, count: 0 }));
  orders.forEach(o => {
    const ts = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : null;
    if (!ts) return;
    hours[new Date(ts).getHours()].count++;
  });
  const peakMax = Math.max(1, ...hours.map(h => h.count));

  return `
    <div class="ph13-wrap">
      <h2>📊 تحليلاتي</h2>

      <div class="ph13-kpis">
        <div class="ph13-kpi"><div class="ph13-kpi-num">${revenue.toLocaleString('ar-EG')}</div><div class="ph13-kpi-l">${t('va_revenue')}</div></div>
        <div class="ph13-kpi"><div class="ph13-kpi-num">${orders.length}</div><div class="ph13-kpi-l">${t('va_orders')}</div></div>
        <div class="ph13-kpi"><div class="ph13-kpi-num">${avgRating} ⭐</div><div class="ph13-kpi-l">${t('va_rating')}</div></div>
        <div class="ph13-kpi ${cancelPct > 20 ? 'ph13-kpi-warn' : ''}"><div class="ph13-kpi-num">${cancelPct}%</div><div class="ph13-kpi-l">${t('va_cancel_pct')}</div></div>
      </div>

      <div class="ph13-card">
        <h3>${t('va_daily_revenue')}</h3>
        ${days.every(d => d.total === 0)
          ? `<div class="empty-state">${t('va_no_data')}</div>`
          : `<canvas id="ph13-revenue-chart" height="120"></canvas>`}
      </div>

      <div class="ph13-grid-2">
        <div class="ph13-card">
          <h3>${t('va_top_services')}</h3>
          ${topSvc.length ? topSvc.map(s => `
            <div class="ph13-svc-row">
              <div class="ph13-svc-name">${s.icon} ${escHtml(s.name)}</div>
              <div class="ph13-svc-count"><strong>${s.count}</strong> طلب • ${s.revenue.toLocaleString('ar-EG')} ر</div>
            </div>`).join('') : `<div class="empty-state">${t('va_no_data')}</div>`}
        </div>
        <div class="ph13-card">
          <h3>${t('va_peak_hours')}</h3>
          <div class="ph13-hours">
            ${hours.map(h => `
              <div class="ph13-hr-col" title="${h.h}:00 — ${h.count} طلب">
                <div class="ph13-hr-bar" style="height:${(h.count / peakMax) * 100}%"></div>
                <div class="ph13-hr-l">${h.h}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
};

// Render daily revenue chart after DOM paints
(function watchAnalyticsRender() {
  setInterval(() => {
    const el = document.getElementById('ph13-revenue-chart');
    if (!el || el.__ph13_done) return;
    el.__ph13_done = true;
    if (typeof Chart === 'undefined') return;
    const u = State.currentUser;
    if (!u) return;
    const orders = AppData.orders.filter(o => (o.vendorId === u.uid || o.providerUid === u.uid) && (o.status === 'completed' || o.status === 'delivered'));
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      days.push({ ts: d.getTime(), label: `${d.getMonth()+1}/${d.getDate()}`, total: 0 });
    }
    orders.forEach(o => {
      const ts = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : null;
      if (!ts) return;
      const dayStart = new Date(ts); dayStart.setHours(0,0,0,0);
      const bucket = days.find(d => d.ts === dayStart.getTime());
      if (bucket) bucket.total += (o.servicePrice || 0);
    });
    try {
      new Chart(el, {
        type: 'line',
        data: {
          labels: days.map(d => d.label),
          datasets: [{
            label: 'الإيرادات',
            data: days.map(d => d.total),
            fill: true,
            backgroundColor: 'rgba(168,85,247,0.18)',
            borderColor: '#a855f7',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { ticks: { color: '#aaa', maxRotation:0, autoSkip:true, maxTicksLimit:8 }, grid: { display: false } },
          },
        },
      });
    } catch (e) {}
  }, 800);
})();

console.log('[Phase 13] Vendor analytics loaded.');
