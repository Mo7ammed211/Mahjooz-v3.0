/* ============================================================
   Phase 42 — Analytics متقدم + نظام صلاحيات الموظفين
   - لوحة تحليلات شاملة بمخططات Chart.js حقيقية
   - تبويب الصلاحيات: يعرض الموظفين فقط
   ============================================================ */
'use strict';

// ─── Analytics helpers ──────────────────────────────────────────
function _last7Days() {
  const labels = [], dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }));
    dates.push(d.toISOString().split('T')[0]);
  }
  return { labels, dates };
}

function _ordersPerDay(dates) {
  return dates.map(d => (AppData.orders || []).filter(o => {
    const cd = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
    return cd && cd.toISOString().split('T')[0] === d;
  }).length);
}

function _revenuePerDay(dates) {
  return dates.map(d => (AppData.transactions || []).filter(t => {
    if (t.type !== 'debit') return false;
    const cd = t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt)) : null;
    return cd && cd.toISOString().split('T')[0] === d;
  }).reduce((sum, t) => sum + (t.amount || 0), 0));
}

function _topServices(n = 5) {
  const counts = {};
  (AppData.orders || []).forEach(o => {
    if (o.svcId) counts[o.svcId] = (counts[o.svcId] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, cnt]) => {
      const svc = (AppData.services || []).find(s => s.id === id);
      return { name: svc ? svc.name : id, count: cnt, icon: svc?.icon || '🔷' };
    });
}

function _ordersByStatus() {
  const counts = {};
  (AppData.orders || []).forEach(o => {
    counts[o.status] = (counts[o.status] || 0) + 1;
  });
  return counts;
}

function _ratingDistribution() {
  const dist = [0, 0, 0, 0, 0];
  (AppData.ratings || []).forEach(r => {
    const s = Math.round(r.vendorStars || 0);
    if (s >= 1 && s <= 5) dist[s - 1]++;
  });
  return dist;
}

// ─── Render Advanced Analytics Page ────────────────────────────
window.renderAdvancedAnalytics = function () {
  const orders = AppData.orders || [];
  const ratings = AppData.ratings || [];
  const users = AppData.users || [];
  const transactions = AppData.transactions || [];

  const totalRevenue = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
  const avgRating    = ratings.length ? (ratings.reduce((s, r) => s + (r.vendorStars || 0), 0) / ratings.length).toFixed(1) : '—';
  const customers    = users.filter(u => u.role === 'customer').length;
  const vendors      = users.filter(u => u.role === 'vendor').length;
  const completedPct = orders.length ? Math.round(orders.filter(o => o.status === 'completed').length / orders.length * 100) : 0;

  const topSvcs = _topServices(5);
  const statusCounts = _ordersByStatus();
  const { labels: dayLabels } = _last7Days();

  const statusLabels = { pending:'بانتظار القبول', accepted:'مقبول', with_driver:'مع المندوب', delivered:'وصل', completed:'مكتمل', cancelled:'ملغي' };
  const statusColors = { pending:'#f59e0b', accepted:'#10b981', with_driver:'#8b5cf6', delivered:'#3b82f6', completed:'#22c55e', cancelled:'#ef4444' };

  setTimeout(() => {
    const isDark = document.body.classList.contains('light-theme') ? false : true;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const chartDefaults = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { family: 'Tajawal' } } } }
    };

    // Orders & Revenue Chart
    const { labels, dates } = _last7Days();
    const ordersData  = _ordersPerDay(dates);
    const revenueData = _revenuePerDay(dates);

    const ctxOR = document.getElementById('ph42-orders-chart');
    if (ctxOR && window.Chart) {
      if (ctxOR._chartInstance) ctxOR._chartInstance.destroy();
      ctxOR._chartInstance = new Chart(ctxOR, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'الطلبات',
              data: ordersData,
              backgroundColor: 'rgba(139,92,246,0.7)',
              borderRadius: 6, yAxisID: 'y'
            },
            {
              label: 'الإيرادات (ريال)',
              data: revenueData,
              type: 'line',
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.1)',
              borderWidth: 2, tension: 0.4, fill: true, yAxisID: 'y1'
            }
          ]
        },
        options: {
          ...chartDefaults,
          scales: {
            y:  { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor }, position: 'right' },
            y1: { beginAtZero: true, grid: { display: false }, ticks: { color: textColor }, position: 'left' },
            x:  { grid: { display: false }, ticks: { color: textColor } }
          }
        }
      });
    }

    // Orders by Status Doughnut
    const ctxSt = document.getElementById('ph42-status-chart');
    if (ctxSt && window.Chart && Object.keys(statusCounts).length) {
      if (ctxSt._chartInstance) ctxSt._chartInstance.destroy();
      const stLabels = Object.keys(statusCounts).map(k => statusLabels[k] || k);
      const stData   = Object.values(statusCounts);
      const stColors = Object.keys(statusCounts).map(k => statusColors[k] || '#8b5cf6');
      ctxSt._chartInstance = new Chart(ctxSt, {
        type: 'doughnut',
        data: { labels: stLabels, datasets: [{ data: stData, backgroundColor: stColors, borderWidth: 2 }] },
        options: { ...chartDefaults, cutout: '65%' }
      });
    }

    // Top Services Bar
    const ctxSv = document.getElementById('ph42-svcs-chart');
    if (ctxSv && window.Chart && topSvcs.length) {
      if (ctxSv._chartInstance) ctxSv._chartInstance.destroy();
      ctxSv._chartInstance = new Chart(ctxSv, {
        type: 'bar',
        data: {
          labels: topSvcs.map(s => s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name),
          datasets: [{
            label: 'عدد الطلبات',
            data: topSvcs.map(s => s.count),
            backgroundColor: ['#8b5cf6','#10b981','#f59e0b','#3b82f6','#ef4444'],
            borderRadius: 8
          }]
        },
        options: {
          ...chartDefaults, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            y: { grid: { display: false }, ticks: { color: textColor } }
          }
        }
      });
    }

    // Rating Distribution
    const ctxRt = document.getElementById('ph42-rating-chart');
    if (ctxRt && window.Chart && ratings.length) {
      const dist = _ratingDistribution();
      if (ctxRt._chartInstance) ctxRt._chartInstance.destroy();
      ctxRt._chartInstance = new Chart(ctxRt, {
        type: 'bar',
        data: {
          labels: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'],
          datasets: [{
            label: 'عدد التقييمات',
            data: dist,
            backgroundColor: ['#ef4444','#f97316','#eab308','#22c55e','#10b981'],
            borderRadius: 6
          }]
        },
        options: {
          ...chartDefaults, plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { display: false }, ticks: { color: textColor } }
          }
        }
      });
    }
  }, 150);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:10px">
      <h2>📊 التحليلات المتقدمة</h2>
      <div style="color:var(--text-muted);font-size:13px">بيانات محدّثة لحظياً من قاعدة البيانات</div>
    </div>

    <!-- KPI Cards -->
    <div class="ph42-kpi-grid">
      <div class="ph42-kpi-card" style="--kpi-color:#8b5cf6">
        <div class="ph42-kpi-icon">📋</div>
        <div class="ph42-kpi-val">${orders.length.toLocaleString('ar-SA')}</div>
        <div class="ph42-kpi-lbl">إجمالي الطلبات</div>
        <div class="ph42-kpi-sub">${completedPct}% مكتملة</div>
      </div>
      <div class="ph42-kpi-card" style="--kpi-color:#10b981">
        <div class="ph42-kpi-icon">💰</div>
        <div class="ph42-kpi-val">${totalRevenue.toLocaleString('ar-SA')}</div>
        <div class="ph42-kpi-lbl">إجمالي الإيرادات</div>
        <div class="ph42-kpi-sub">ريال يمني</div>
      </div>
      <div class="ph42-kpi-card" style="--kpi-color:#f59e0b">
        <div class="ph42-kpi-icon">👥</div>
        <div class="ph42-kpi-val">${customers.toLocaleString('ar-SA')}</div>
        <div class="ph42-kpi-lbl">إجمالي العملاء</div>
        <div class="ph42-kpi-sub">${vendors} صاحب خدمة</div>
      </div>
      <div class="ph42-kpi-card" style="--kpi-color:#f43f5e">
        <div class="ph42-kpi-icon">⭐</div>
        <div class="ph42-kpi-val">${avgRating}</div>
        <div class="ph42-kpi-lbl">متوسط التقييم</div>
        <div class="ph42-kpi-sub">${ratings.length} تقييم</div>
      </div>
    </div>

    <!-- Orders & Revenue Chart -->
    <div class="ph42-chart-card" style="margin-top:24px">
      <div class="ph42-chart-head">
        <h3>📈 الطلبات والإيرادات — آخر 7 أيام</h3>
      </div>
      <div style="height:280px"><canvas id="ph42-orders-chart"></canvas></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
      <!-- Status Breakdown -->
      <div class="ph42-chart-card">
        <div class="ph42-chart-head"><h3>🥧 توزيع حالات الطلبات</h3></div>
        <div style="height:240px;display:flex;align-items:center;justify-content:center">
          ${Object.keys(statusCounts).length ? `<canvas id="ph42-status-chart"></canvas>` :
            '<div class="empty-state" style="padding:20px"><div class="empty-icon">📊</div><div class="empty-title">لا توجد طلبات بعد</div></div>'}
        </div>
      </div>

      <!-- Rating Distribution -->
      <div class="ph42-chart-card">
        <div class="ph42-chart-head"><h3>⭐ توزيع التقييمات</h3></div>
        <div style="height:240px;display:flex;align-items:center;justify-content:center">
          ${ratings.length ? `<canvas id="ph42-rating-chart"></canvas>` :
            '<div class="empty-state" style="padding:20px"><div class="empty-icon">⭐</div><div class="empty-title">لا توجد تقييمات بعد</div></div>'}
        </div>
      </div>
    </div>

    <!-- Top Services -->
    <div class="ph42-chart-card" style="margin-top:20px">
      <div class="ph42-chart-head"><h3>🏆 أبرز الخدمات طلباً</h3></div>
      ${topSvcs.length ? `
        <div style="height:${Math.max(topSvcs.length * 48, 160)}px"><canvas id="ph42-svcs-chart"></canvas></div>` : `
        <div class="empty-state" style="padding:20px"><div class="empty-icon">🛎️</div><div class="empty-title">لا توجد طلبات بعد</div></div>`}
    </div>

    <!-- Region Breakdown -->
    ${(AppData.regions || []).length ? `
    <div class="ph42-chart-card" style="margin-top:20px">
      <div class="ph42-chart-head"><h3>📍 توزيع الخدمات على المناطق</h3></div>
      <div class="ph42-region-grid">
        ${(AppData.regions || []).map(r => {
          const svcCount = (AppData.services || []).filter(s => s.regionId === r.id).length;
          const ordCount = (AppData.orders  || []).filter(o => {
            const svc = (AppData.services||[]).find(s=>s.id===o.svcId);
            return svc?.regionId === r.id;
          }).length;
          return `
            <div class="ph42-region-row">
              <div class="ph42-region-name">📍 ${escHtml(r.name)}</div>
              <div class="ph42-region-stats">
                <span class="badge badge-purple">${svcCount} خدمة</span>
                <span class="badge badge-teal">${ordCount} طلب</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
};

// ─── Staff Permissions Page ─────────────────────────────────────
window.renderStaffPermissions = function () {
  const staffUsers = (AppData.users || []).filter(u => u.role === 'staff');
  const searchQ = (State.adminSearch || '').toLowerCase();
  const filtered = staffUsers.filter(u =>
    (u.name || '').toLowerCase().includes(searchQ) ||
    (u.email || '').toLowerCase().includes(searchQ)
  );

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div>
        <h2>🔑 صلاحيات الموظفين</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px">إدارة صلاحيات الموظفين فقط — ${staffUsers.length} موظف</p>
      </div>
      <input type="text" class="form-control" id="admin-staff-perms-search" placeholder="🔍 ابحث بالاسم أو البريد..."
             value="${State.adminSearch || ''}" oninput="State.adminSearch=this.value;render();"
             style="width:280px">
    </div>

    ${filtered.length ? `
    <div class="ph42-staff-grid">
      ${filtered.map(u => {
        const perms  = u.permissions || {};
        const pcount = Object.values(perms).filter(Boolean).length;
        const sus    = !!u.suspended;
        return `
          <div class="ph42-staff-card${sus ? ' ph42-suspended' : ''}">
            <div class="ph42-staff-avatar">${(u.name || '؟').charAt(0).toUpperCase()}</div>
            <div class="ph42-staff-info">
              <div class="ph42-staff-name">${escHtml(u.name || '—')}</div>
              <div class="ph42-staff-email">${escHtml(u.email || '—')}</div>
              <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                ${sus ? '<span class="badge badge-rose">⏸️ معلّق</span>' : '<span class="badge badge-teal">✅ نشط</span>'}
                <span class="badge badge-gold">${pcount} صلاحية</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm ph42-perm-btn" onclick="showPermsModal('${u.id}')">
              🔑 الصلاحيات
            </button>
          </div>`;
      }).join('')}
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">👥</div>
      <div class="empty-title">${staffUsers.length === 0 ? 'لا يوجد موظفون بعد' : 'لا توجد نتائج للبحث'}</div>
      <div class="empty-sub">${staffUsers.length === 0 ? 'أضف موظفين من قسم المستخدمين لتعيين صلاحياتهم' : ''}</div>
    </div>`}
  `;
};

// ─── Inject analytics + permissions tabs into Admin sidebar ────
// window.renderAdmin override removed to prevent conflicts with dashboards.js hub UI.

// ─── Styles ────────────────────────────────────────────────────
(function () {
  if (window.__ph42_styles) return;
  window.__ph42_styles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ph42-kpi-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px; }
    @media(max-width:900px) { .ph42-kpi-grid { grid-template-columns:repeat(2,1fr); } }
    @media(max-width:500px)  { .ph42-kpi-grid { grid-template-columns:1fr; } }
    .ph42-kpi-card { background:var(--bg-card);border:1px solid var(--glass-border);border-radius:16px;padding:20px;text-align:center;position:relative;overflow:hidden; }
    .ph42-kpi-card::before { content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--kpi-color,#8b5cf6); }
    .ph42-kpi-icon { font-size:32px;margin-bottom:8px; }
    .ph42-kpi-val { font-size:28px;font-weight:800;color:var(--kpi-color,#8b5cf6); }
    .ph42-kpi-lbl { font-size:13px;color:var(--text-secondary);margin-top:4px;font-weight:600; }
    .ph42-kpi-sub { font-size:12px;color:var(--text-muted);margin-top:2px; }

    .ph42-chart-card { background:var(--bg-card);border:1px solid var(--glass-border);border-radius:16px;padding:20px; }
    .ph42-chart-head { margin-bottom:16px; }
    .ph42-chart-head h3 { font-size:16px;font-weight:700; }

    .ph42-region-grid { display:flex;flex-direction:column;gap:10px; }
    .ph42-region-row { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-main);border-radius:10px; }
    .ph42-region-name { font-weight:600; }
    .ph42-region-stats { display:flex;gap:8px; }

    .ph42-staff-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px; }
    .ph42-staff-card { background:var(--bg-card);border:1px solid var(--glass-border);border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px;transition:border-color 0.2s; }
    .ph42-staff-card:hover { border-color:var(--primary); }
    .ph42-suspended { opacity:0.6; }
    .ph42-staff-avatar { width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0; }
    .ph42-staff-info { flex:1;min-width:0; }
    .ph42-staff-name { font-weight:700;font-size:15px; }
    .ph42-staff-email { font-size:12px;color:var(--text-muted);direction:ltr;text-align:right;margin-top:2px; }
    .ph42-perm-btn { white-space:nowrap;flex-shrink:0; }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 42] Advanced Analytics & Staff Permissions loaded');
