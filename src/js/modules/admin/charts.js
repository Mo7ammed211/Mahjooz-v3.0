// ═══════════════════════════════════════════════════════
//  محجوز v2.4 — Phase 4
//  - Advanced Statistics Dashboard (Chart.js)
//    • KPI cards (revenue, orders, growth %, avg order value)
//    • Time-series line chart (orders + revenue last N days)
//    • Donut chart (orders by status)
//    • Bar chart (orders by region)
//    • Bar chart (top services by orders & revenue)
//    • Date-range selector (7d / 30d / 90d / all)
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('advanced_stats',      'الإحصائيات المتقدمة', 'Advanced Statistics');
  add('range_7d',            'آخر 7 أيام',          'Last 7 days');
  add('range_30d',           'آخر 30 يوم',          'Last 30 days');
  add('range_90d',           'آخر 90 يوم',          'Last 90 days');
  add('range_all',           'كل الفترات',          'All time');
  add('kpi_revenue',         'الإيرادات',           'Revenue');
  add('kpi_orders',          'الطلبات',             'Orders');
  add('kpi_growth',          'النمو مقابل الفترة السابقة', 'Growth vs previous');
  add('kpi_aov',             'متوسط قيمة الطلب',    'Avg. order value');
  add('kpi_completion',      'نسبة الإتمام',        'Completion rate');
  add('kpi_active_customers','عملاء نشطون',         'Active customers');
  add('chart_orders_over_time','الطلبات والإيرادات بمرور الوقت', 'Orders & Revenue over time'); 
  add('chart_status',        'توزيع حالات الطلبات', 'Orders by status');
  add('chart_region',        'الطلبات حسب المنطقة', 'Orders by region');
  add('chart_top_services',  'أفضل الخدمات',        'Top services');
  add('chart_categories',    'الطلبات حسب الفئة',   'Orders by category');
  add('no_data_yet',         'لا توجد بيانات بعد لهذه الفترة', 'No data yet for this period');
  add('refresh',             'تحديث',               'Refresh');
  add('export_csv',          'تصدير CSV',           'Export CSV');
  add('status_pending',      'قيد الانتظار',        'Pending');
  add('status_accepted',     'مقبول',               'Accepted');
  add('status_with_driver',  'مع المندوب',          'With driver');
  add('status_delivered',    'موصّل',               'Delivered');
  add('status_completed',    'مكتمل',               'Completed');
  add('status_cancelled',    'ملغي',                'Cancelled');
  add('status_other',        'أخرى',                'Other');
  add('orders_count',        'عدد الطلبات',         '# of orders');
  add('revenue_amount',      'الإيرادات (ر)',       'Revenue (YER)');
  add('total_label',         'الإجمالي',            'Total');
})();

// ─── Helper: convert any timestamp shape to a JS Date ─
function ph4_toDate(ts) {
  if (!ts) return null;
  if (ts.toDate)  return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') { const d = new Date(ts); return isNaN(d) ? null : d; }
  if (ts instanceof Date) return ts;
  return null;
}

function ph4_dayKey(d) {
  // YYYY-MM-DD  (local time)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ph4_arNum(n) {
  return Number(n || 0).toLocaleString(typeof getLang === 'function' && getLang() === 'en' ? 'en' : 'ar-EG');
}

// ─── State for the advanced-stats panel ───────────────
window.AdvStatsState = window.AdvStatsState || { range: 30 };
const __ph4_charts = {}; // canvasId -> Chart instance (to destroy on rerender)

function setAdvRange(days) {
  window.AdvStatsState.range = days;
  if (typeof setAdminTab === 'function') setAdminTab('advanced');
}

// ─── Inject the new admin tab via render() wrapper ────
const __ph4_originalRender = window.render;
window.render = async function (...args) {
  const result = await __ph4_originalRender.apply(this, args);
  try { ph4_drawCharts(); } catch (e) { console.warn('ph4_drawCharts:', e); }
  return result;
};

// ─── Patch renderAdmin to add our tab and show our UI ─────
// window.renderAdmin override removed to prevent conflicts with dashboards.js hub UI.



// ─── Main render function ─────────────────────────────
function renderAdminAdvancedStats() {
  const range = window.AdvStatsState.range || 30;

  // Filter orders inside selected range (or all)
  const now = new Date();
  const cutoff = range === 'all' ? null : new Date(now.getTime() - range * 86400000);
  const allOrders = (AppData.orders || []).map(o => ({ ...o, _date: ph4_toDate(o.createdAt) }));
  const inRange = allOrders.filter(o => !cutoff || (o._date && o._date >= cutoff));

  // Compute previous-period data for growth %
  let prevOrders = [];
  if (cutoff) {
    const prevCutoff = new Date(cutoff.getTime() - range * 86400000);
    prevOrders = allOrders.filter(o => o._date && o._date >= prevCutoff && o._date < cutoff);
  }

  const sumOrderTotals = (arr) => arr.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const isRevenue = (o) => o.status === 'completed' || o.status === 'delivered';
  const revenue = sumOrderTotals(inRange.filter(isRevenue));
  const prevRevenue = sumOrderTotals(prevOrders.filter(isRevenue));
  const orderCount = inRange.length;
  const prevOrderCount = prevOrders.length;
  const completed = inRange.filter(o => o.status === 'completed').length;
  const completionRate = orderCount ? Math.round((completed / orderCount) * 100) : 0;
  const aov = orderCount ? Math.round(revenue / orderCount) : 0;
  const activeCustomers = new Set(inRange.map(o => o.userId || o.customerId).filter(Boolean)).size;

  const growth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
                : (revenue > 0 ? 100 : 0);
  const growthColor = growth >= 0 ? '#10b981' : '#ef4444';
  const growthIcon  = growth >= 0 ? '▲' : '▼';

  // KPI card builder
  const kpi = (icon, label, value, sub, color) => `
    <div class="adv-kpi-card" style="background:linear-gradient(135deg,${color}22,${color}08);border:1px solid ${color}55;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:6px;min-width:180px;flex:1">
      <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:13px">
        <span style="font-size:20px">${icon}</span><span>${label}</span>
      </div>
      <div style="font-size:26px;font-weight:800;color:var(--text-main,#fff);line-height:1.2">${value}</div>
      ${sub ? `<div style="font-size:12px;color:var(--text-muted)">${sub}</div>` : ''}
    </div>`;

  const rangeBtn = (val, label) => {
    const active = (window.AdvStatsState.range === val);
    return `<button class="adv-range-btn" onclick="setAdvRange(${typeof val==='string'?`'${val}'`:val})"
      style="padding:8px 14px;border-radius:10px;border:1px solid ${active?'var(--primary,#7c3aed)':'var(--border,#333)'};
      background:${active?'var(--primary,#7c3aed)':'transparent'};color:${active?'#fff':'var(--text-main,#fff)'};
      cursor:pointer;font-size:13px;font-weight:600;transition:all .15s">${label}</button>`;
  };

  if (orderCount === 0 && (AppData.orders || []).length === 0) {
    const banner = (typeof renderSmartAlertsBanner === 'function') ? renderSmartAlertsBanner() : '';
    return `
    <div style="display:flex;flex-direction:column;gap:20px">
      ${banner}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <h2 style="margin:0">📈 ${t('advanced_stats')}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${rangeBtn(7,t('range_7d'))}${rangeBtn(30,t('range_30d'))}${rangeBtn(90,t('range_90d'))}${rangeBtn('all',t('range_all'))}
        </div>
      </div>
      <div style="background:var(--bg-card,#1a1a2e);border:1px dashed var(--border,#333);border-radius:16px;padding:60px 24px;text-align:center;color:var(--text-muted)">
        <div style="font-size:54px;margin-bottom:14px">📊</div>
        <div style="font-size:16px">${t('no_data_yet')}</div>
        <div style="font-size:13px;margin-top:6px;opacity:.7">سيتم عرض الرسوم البيانية تلقائياً عند توفر طلبات</div>
      </div>
    </div>`;
  }

  const alertsBanner = (typeof renderSmartAlertsBanner === 'function') ? renderSmartAlertsBanner() : '';

  return `
  <div id="adv-stats-wrap" style="display:flex;flex-direction:column;gap:20px">

    ${alertsBanner}

    <!-- Header + range selector -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div>
        <h2 style="margin:0">📈 ${t('advanced_stats')}</h2>
        <div style="color:var(--text-muted);font-size:13px;margin-top:4px">
          ${range === 'all' ? t('range_all') : (typeof t==='function'?t('range_'+range+'d'):'') }
          • ${ph4_arNum(orderCount)} ${t('orders_count')}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${rangeBtn(7,t('range_7d'))}
        ${rangeBtn(30,t('range_30d'))}
        ${rangeBtn(90,t('range_90d'))}
        ${rangeBtn('all',t('range_all'))}
        <button class="btn btn-secondary" onclick="setAdminTab('advanced')" style="padding:8px 14px;border-radius:10px;font-size:13px">🔄 ${t('refresh')}</button>
        <button class="btn btn-primary" onclick="ph4_exportCSV()" style="padding:8px 14px;border-radius:10px;font-size:13px">📥 ${t('export_csv')}</button>
        ${typeof ph6_generateMonthlyReport==='function' ? `<button class="btn btn-primary" onclick="ph6_generateMonthlyReport(window.AdvStatsState?.range==='all'?365:(window.AdvStatsState?.range||30))" style="padding:8px 14px;border-radius:10px;font-size:13px;background:#ec4899;border-color:#ec4899">📄 ${t('pdf_monthly_report')}</button>` : ''}
      </div>
    </div>

    <!-- KPI Row -->
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      ${kpi('💰', t('kpi_revenue'),         ph4_arNum(revenue) + ' ر',     '', '#10b981')}
      ${kpi('📦', t('kpi_orders'),          ph4_arNum(orderCount),         `${t('status_completed')}: ${ph4_arNum(completed)}`, '#3b82f6')}
      ${kpi('📈', t('kpi_growth'),          `<span style="color:${growthColor}">${growthIcon} ${Math.abs(growth)}%</span>`, range==='all'?'—':'', growth>=0?'#10b981':'#ef4444')}
      ${kpi('🧾', t('kpi_aov'),             ph4_arNum(aov) + ' ر',         '', '#f59e0b')}
      ${kpi('✅', t('kpi_completion'),      completionRate + '%',          '', '#8b5cf6')}
      ${kpi('👥', t('kpi_active_customers'),ph4_arNum(activeCustomers),    '', '#ec4899')}
    </div>

    <!-- Chart 1: Orders & Revenue over time (line) -->
    <div class="adv-chart-card" style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:20px">
      <h3 style="margin:0 0 14px 0;font-size:16px">📉 ${t('chart_orders_over_time')}</h3>
      <div style="position:relative;height:300px">
        <canvas id="ph4-chart-time"></canvas>
      </div>
    </div>

    <!-- Charts row 2 -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      <div class="adv-chart-card" style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:20px">
        <h3 style="margin:0 0 14px 0;font-size:16px">🍩 ${t('chart_status')}</h3>
        <div style="position:relative;height:280px"><canvas id="ph4-chart-status"></canvas></div>
      </div>
      <div class="adv-chart-card" style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:20px">
        <h3 style="margin:0 0 14px 0;font-size:16px">📂 ${t('chart_categories')}</h3>
        <div style="position:relative;height:280px"><canvas id="ph4-chart-cats"></canvas></div>
      </div>
    </div>

    <!-- Charts row 3 -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      <div class="adv-chart-card" style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:20px">
        <h3 style="margin:0 0 14px 0;font-size:16px">📍 ${t('chart_region')}</h3>
        <div style="position:relative;height:280px"><canvas id="ph4-chart-region"></canvas></div>
      </div>
      <div class="adv-chart-card" style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:20px">
        <h3 style="margin:0 0 14px 0;font-size:16px">🏆 ${t('chart_top_services')}</h3>
        <div style="position:relative;height:280px"><canvas id="ph4-chart-svc"></canvas></div>
      </div>
    </div>

  </div>`;
}

// ─── Draw all charts after the DOM is rendered ────────
function ph4_drawCharts() {
  if (typeof Chart === 'undefined') return;
  if (!document.getElementById('adv-stats-wrap')) return;

  const range = window.AdvStatsState.range || 30;
  const now = new Date();
  const cutoff = range === 'all' ? null : new Date(now.getTime() - range * 86400000);
  const orders = (AppData.orders || []).map(o => ({ ...o, _date: ph4_toDate(o.createdAt) }));
  const inRange = orders.filter(o => !cutoff || (o._date && o._date >= cutoff));

  // Destroy any previous chart instances on this page
  for (const id of Object.keys(__ph4_charts)) {
    try { __ph4_charts[id].destroy(); } catch(_) {}
    delete __ph4_charts[id];
  }

  // Common Chart.js defaults — Arabic-friendly, dark theme
  const isLight = document.body.classList.contains('light-theme');
  Chart.defaults.color = isLight ? '#374151' : '#cbd5e1';
  Chart.defaults.font.family = "'Cairo','Segoe UI',sans-serif";
  Chart.defaults.font.size = 12;
  const gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';

  // ── 1) Time-series: orders count + revenue per day
  const timeCanvas = document.getElementById('ph4-chart-time');
  if (timeCanvas) {
    const days = range === 'all' ? 90 : range;
    const labels = []; const ordersByDay = []; const revenueByDay = [];
    const grouped = {};
    for (const o of inRange) {
      if (!o._date) continue;
      const k = ph4_dayKey(o._date);
      if (!grouped[k]) grouped[k] = { count: 0, revenue: 0 };
      grouped[k].count += 1;
      if (o.status === 'completed' || o.status === 'in_progress' || !o.status) {
        grouped[k].revenue += Number(o.total) || 0;
      }
    }
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const k = ph4_dayKey(d);
      labels.push(d.toLocaleDateString('ar-YE', { month: 'short', day: 'numeric' }));
      ordersByDay.push(grouped[k]?.count || 0);
      revenueByDay.push(grouped[k]?.revenue || 0);
    }
    __ph4_charts.time = new Chart(timeCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: t('orders_count'), data: ordersByDay, yAxisID: 'y',
            borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.15)',
            tension: .35, fill: true, pointRadius: 2 },
          { label: t('revenue_amount'), data: revenueByDay, yAxisID: 'y1',
            borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.10)',
            tension: .35, fill: true, pointRadius: 2 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: gridColor } },
          y:  { position: 'right', grid: { color: gridColor }, beginAtZero: true,
                title: { display: true, text: t('orders_count') } },
          y1: { position: 'left',  grid: { drawOnChartArea: false }, beginAtZero: true,
                title: { display: true, text: t('revenue_amount') } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  // ── 2) Donut: orders by status
  const statusCanvas = document.getElementById('ph4-chart-status');
  if (statusCanvas) {
    const buckets = { pending: 0, accepted: 0, with_driver: 0, delivered: 0, completed: 0, cancelled: 0, other: 0 };
    for (const o of inRange) {
      const s = (o.status || 'other').toLowerCase();
      if (buckets[s] !== undefined) buckets[s] += 1; else buckets.other += 1;
    }
    const lbls = [
      t('status_pending'), t('status_accepted'), t('status_with_driver'),
      t('status_delivered'), t('status_completed'), t('status_cancelled'), t('status_other'),
    ];
    const data = [buckets.pending, buckets.accepted, buckets.with_driver,
                  buckets.delivered, buckets.completed, buckets.cancelled, buckets.other];
    const colors = ['#f59e0b','#3b82f6','#06b6d4','#8b5cf6','#10b981','#ef4444','#6b7280'];
    // Drop empty buckets to keep donut clean
    const keep = data.map((v,i)=>v>0?i:-1).filter(i=>i>=0);
    __ph4_charts.status = new Chart(statusCanvas, {
      type: 'doughnut',
      data: {
        labels: keep.map(i=>lbls[i]),
        datasets: [{
          data: keep.map(i=>data[i]),
          backgroundColor: keep.map(i=>colors[i]),
          borderColor: isLight ? '#fff' : '#1a1a2e',
          borderWidth: 2,
        }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '60%' },
    });
  }

  // ── 3) Bar: orders by category
  const catCanvas = document.getElementById('ph4-chart-cats');
  if (catCanvas) {
    const services = AppData.services || [];
    const cats = AppData.cats || [];
    const svcCat = {}; for (const s of services) svcCat[s.id] = s.catId;
    const catName = {}; for (const c of cats) catName[c.id] = (c.icon ? c.icon + ' ' : '') + c.name;
    const counts = {};
    for (const o of inRange) {
      const cid = svcCat[o.serviceId] || o.categoryId || o.catId || 'other';
      const name = catName[cid] || (typeof t==='function'?t('status_other'):'أخرى');
      counts[name] = (counts[name] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 10);
    __ph4_charts.cats = new Chart(catCanvas, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ label: t('orders_count'), data: entries.map(e => e[1]),
          backgroundColor: '#8b5cf6', borderRadius: 6 }],
      },
      options: {
        maintainAspectRatio: false, indexAxis: 'y',
        scales: { x: { grid: { color: gridColor }, beginAtZero: true }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  // ── 4) Bar: orders by region
  const regionCanvas = document.getElementById('ph4-chart-region');
  if (regionCanvas) {
    const regions = AppData.regions || [];
    const services = AppData.services || [];
    const svcRegion = {}; for (const s of services) svcRegion[s.id] = s.regionId;
    const regName = {}; for (const r of regions) regName[r.id] = r.name;
    const counts = {};
    for (const o of inRange) {
      const rid = svcRegion[o.serviceId] || o.regionId || 'unknown';
      const name = regName[rid] || (rid === 'unknown' ? '— غير محدد —' : rid);
      counts[name] = (counts[name] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 10);
    __ph4_charts.region = new Chart(regionCanvas, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ label: t('orders_count'), data: entries.map(e => e[1]),
          backgroundColor: '#06b6d4', borderRadius: 6 }],
      },
      options: {
        maintainAspectRatio: false,
        scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
  }

  // ── 5) Bar: top services by revenue
  const svcCanvas = document.getElementById('ph4-chart-svc');
  if (svcCanvas) {
    const services = AppData.services || [];
    const svcName = {}; for (const s of services) svcName[s.id] = s.name || s.title || s.id;
    const totals = {}; // serviceId -> { count, revenue }
    for (const o of inRange) {
      const sid = o.serviceId || 'unknown';
      if (!totals[sid]) totals[sid] = { count: 0, revenue: 0 };
      totals[sid].count += 1;
      if (o.status === 'completed' || o.status === 'in_progress' || !o.status) {
        totals[sid].revenue += Number(o.total) || 0;
      }
    }
    const entries = Object.entries(totals)
      .sort((a,b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);
    __ph4_charts.svc = new Chart(svcCanvas, {
      type: 'bar',
      data: {
        labels: entries.map(e => svcName[e[0]] || e[0]),
        datasets: [
          { label: t('revenue_amount'), data: entries.map(e => e[1].revenue),
            backgroundColor: '#10b981', borderRadius: 6, yAxisID: 'y' },
          { label: t('orders_count'),   data: entries.map(e => e[1].count),
            backgroundColor: '#f59e0b', borderRadius: 6, yAxisID: 'y1' },
        ],
      },
      options: {
        maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x:  { grid: { color: gridColor }, beginAtZero: true },
          y:  { grid: { display: false } },
          y1: { display: false, beginAtZero: true },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }
}

// ─── CSV export of orders within current range ────────
function ph4_exportCSV() {
  const range = window.AdvStatsState.range || 30;
  const now = new Date();
  const cutoff = range === 'all' ? null : new Date(now.getTime() - range * 86400000);
  const services = AppData.services || [];
  const svcName = {}; for (const s of services) svcName[s.id] = s.name || s.title || s.id;
  const rows = [['order_id','date','service','status','total','user_id']];
  for (const o of (AppData.orders || [])) {
    const d = ph4_toDate(o.createdAt);
    if (cutoff && (!d || d < cutoff)) continue;
    rows.push([
      o.id || '',
      d ? d.toISOString().slice(0,10) : '',
      (svcName[o.serviceId] || o.serviceId || '').replace(/,/g,' '),
      o.status || '',
      Number(o.total || 0),
      o.userId || o.customerId || '',
    ]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `mahjooz-orders-${range}d-${ph4_dayKey(new Date())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  if (typeof toast === 'function') toast('تم تصدير الملف ✅', 'success');
}
window.renderAdminAdvancedStats = renderAdminAdvancedStats;
