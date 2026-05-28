/* ============================================================
   Driver Performance Report — تقرير أداء المندوبين
   ------------------------------------------------------------
   يحسب من AppData.orders + AppData.ratings + AppData.ddbEntries
   لكل مندوب:
     • إجمالي الطلبات المُسنَدة
     • الطلبات المكتملة + نسبة الإنجاز %
     • الطلبات الملغاة
     • متوسط وقت التوصيل (deliveredAt − createdAt)
     • متوسط تقييم العملاء (driverStars) + عدد التقييمات
     • آخر نشاط
   ============================================================ */
(function () {
  'use strict';

  /* ── أدوات مساعدة ─────────────────────────────── */
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  function fmtDuration(ms) {
    if (!ms || ms <= 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60)  return `${mins} د`;
    const hrs = (ms / 3600000).toFixed(1);
    return `${hrs} س`;
  }

  function toMs(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate().getTime();
    if (typeof ts === 'string') return new Date(ts).getTime();
    if (typeof ts === 'number') return ts;
    return null;
  }

  function stars(avg, count) {
    if (!count) return '<span style="color:var(--text-muted);font-size:12px">لا تقييمات</span>';
    const filled  = Math.round(avg);
    const s = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    return `<span style="color:#f59e0b;font-size:14px;letter-spacing:1px">${s}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-right:4px">${avg.toFixed(1)} (${count})</span>`;
  }

  /* ── حساب الإحصائيات لكل مندوب ─────────────────── */
  function buildDriverStats() {
    const orders  = AppData.orders  || [];
    const ratings = AppData.ratings || [];
    const ddbEntries = AppData.ddbEntries || [];

    const map = {}; // driverId → stats object

    orders.forEach(o => {
      if (!o.driverId) return;
      if (!map[o.driverId]) {
        map[o.driverId] = {
          uid:       o.driverId,
          name:      o.driverName || '',
          total:     0,
          completed: 0,
          cancelled: 0,
          durations: [],   // ms للطلبات التي لها deliveredAt + createdAt
          lastAt:    null,
        };
      }
      const st = map[o.driverId];
      st.total++;

      const createdMs   = toMs(o.createdAt);
      const deliveredMs = toMs(o.deliveredAt);
      if (deliveredMs && createdMs && deliveredMs > createdMs) {
        st.durations.push(deliveredMs - createdMs);
      }

      if (['completed','delivered'].includes(o.status)) st.completed++;
      if (o.status === 'cancelled') st.cancelled++;

      const oMs = toMs(o.createdAt);
      if (!st.lastAt || (oMs && oMs > st.lastAt)) st.lastAt = oMs;

      if (!st.name && o.driverName) st.name = o.driverName;
    });

    // إضافة بيانات من قاعدة المندوبين
    Object.keys(map).forEach(uid => {
      const st  = map[uid];
      const ddb = ddbEntries.find(e => e.linkedUserId === uid);
      if (ddb) {
        if (!st.name) st.name = ddb.name;
        st.phone       = ddb.phone || '';
        st.vehicleType = ddb.vehicleType || '';
        st.ddbId       = ddb.id;
      }
    });

    // ربط التقييمات
    ratings.forEach(r => {
      if (!r.driverId || !r.driverStars) return;
      if (map[r.driverId]) {
        map[r.driverId].ratingStars = map[r.driverId].ratingStars || [];
        map[r.driverId].ratingStars.push(Number(r.driverStars));
      }
    });

    return Object.values(map).map(st => {
      const avgDuration = st.durations.length
        ? st.durations.reduce((a,b) => a+b, 0) / st.durations.length
        : null;
      const ratingCount = (st.ratingStars || []).length;
      const avgRating   = ratingCount
        ? st.ratingStars.reduce((a,b) => a+b, 0) / ratingCount
        : null;
      const completion  = st.total ? Math.round((st.completed / st.total) * 100) : 0;
      return { ...st, avgDuration, ratingCount, avgRating, completion };
    }).sort((a, b) => (b.completed - a.completed) || (b.total - a.total));
  }

  /* ── شريط التقدم ────────────────────────────────── */
  function bar(pct, color) {
    return `<div style="width:100%;background:var(--border,#e5e7eb);border-radius:99px;height:6px;overflow:hidden">
      <div style="width:${pct}%;background:${color};height:100%;border-radius:99px;transition:width 0.4s ease"></div>
    </div>`;
  }

  /* ── ألوان نسبة الإنجاز ─────────────────────────── */
  function completionColor(pct) {
    if (pct >= 80) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  /* ── فمت تاريخ ──────────────────────────────────── */
  function fmtDate(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('ar', { day:'2-digit', month:'short', year:'numeric' });
  }

  /* ══════════════════════════════════════════════════
     renderAdminDriverPerformance — نقطة الدخول الرئيسية
  ══════════════════════════════════════════════════ */
  window.renderAdminDriverPerformance = function () {
    const drivers  = buildDriverStats();
    const sq       = (State._drvPerfSearch || '').toLowerCase().trim();
    const sortBy   = State._drvPerfSort || 'completed';

    let filtered = sq
      ? drivers.filter(d => (d.name||'').toLowerCase().includes(sq) || (d.phone||'').includes(sq))
      : drivers;

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'rating')     return (b.avgRating||0) - (a.avgRating||0);
      if (sortBy === 'completion') return b.completion - a.completion;
      if (sortBy === 'total')      return b.total - a.total;
      if (sortBy === 'speed')      return (a.avgDuration||Infinity) - (b.avgDuration||Infinity);
      return b.completed - a.completed;
    });

    /* ── إحصائيات إجمالية ── */
    const totalCompleted  = drivers.reduce((a,d) => a + d.completed, 0);
    const totalOrders     = drivers.reduce((a,d) => a + d.total, 0);
    const avgRatingAll    = (() => {
      const r = drivers.filter(d => d.avgRating);
      return r.length ? (r.reduce((a,d) => a + d.avgRating, 0) / r.length) : null;
    })();
    const broadcasting    = (AppData.orders||[]).filter(o => o.isBroadcasting).length;

    return `
    <div style="padding:20px;max-width:1200px;margin:0 auto;font-family:'Cairo',sans-serif">

      <!-- رأس الصفحة -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:900;color:var(--text-main)">🚗 تقرير أداء المندوبين</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0">${drivers.length} مندوب · البيانات محسوبة من ${totalOrders} طلب</p>
        </div>
        <button onclick="State._drvPerfSearch='';State._drvPerfSort='completed';render()"
                style="display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.1);border:1.5px solid rgba(139,92,246,0.3);color:#7c3aed;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
          🔄 إعادة تعيين
        </button>
      </div>

      <!-- إحصائيات إجمالية -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
        ${[
          ['🚗', 'مندوبون مسجّلون', drivers.length,        '#8b5cf6'],
          ['📦', 'طلبات مكتملة',    totalCompleted,        '#10b981'],
          ['📊', 'إجمالي الطلبات',  totalOrders,           '#0d9488'],
          ['⭐', 'متوسط التقييم',   avgRatingAll ? avgRatingAll.toFixed(1)+'★' : '—', '#f59e0b'],
          ['📡', 'يبثون الآن',      broadcasting,          '#3b82f6'],
        ].map(([ic, label, val, color]) => `
        <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:14px;padding:12px 18px;flex:1;min-width:130px">
          <div style="font-size:22px;margin-bottom:4px">${ic}</div>
          <div style="font-size:22px;font-weight:900;color:${color}">${val}</div>
          <div style="font-size:12px;color:var(--text-muted)">${label}</div>
        </div>`).join('')}
      </div>

      <!-- بحث + فرز -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="position:relative;flex:1;min-width:200px">
          <span style="position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">🔍</span>
          <input style="width:100%;padding:10px 40px 10px 12px;border:1.5px solid var(--border);border-radius:12px;background:var(--glass-bg);color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;box-sizing:border-box"
                 placeholder="ابحث بالاسم أو الهاتف..."
                 value="${esc(State._drvPerfSearch || '')}"
                 oninput="State._drvPerfSearch=this.value;render()"
                 onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
        </div>
        <select style="padding:10px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--glass-bg);color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;cursor:pointer"
                onchange="State._drvPerfSort=this.value;render()">
          ${[
            ['completed', 'ترتيب: أكثر إنجازاً'],
            ['total',     'ترتيب: أكثر طلبات'],
            ['rating',    'ترتيب: أعلى تقييم'],
            ['completion','ترتيب: نسبة إنجاز'],
            ['speed',     'ترتيب: أسرع توصيل'],
          ].map(([v,l]) => `<option value="${v}" ${sortBy===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>

      ${drivers.length === 0 ? `
      <div style="text-align:center;padding:60px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
        <div style="font-size:48px;margin-bottom:14px">🚗</div>
        <h3 style="color:var(--text-secondary);margin-bottom:8px">لا توجد بيانات مندوبين بعد</h3>
        <p style="color:var(--text-muted);font-size:13px">ستظهر إحصائيات المندوبين هنا بعد تعيينهم على الطلبات</p>
      </div>` : filtered.length === 0 ? `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <div style="font-size:36px;margin-bottom:10px">🔍</div>
        <div>لا توجد نتائج لـ "<strong>${esc(sq)}</strong>"</div>
      </div>` : `
      <!-- بطاقات المندوبين -->
      <div style="display:flex;flex-direction:column;gap:14px">
        ${filtered.map((d, idx) => _driverCard(d, idx)).join('')}
      </div>`}

      <!-- تلميح -->
      <div style="margin-top:20px;background:rgba(13,148,136,0.05);border:1px solid rgba(13,148,136,0.2);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--text-secondary);line-height:1.6">
        💡 <strong>ملاحظة:</strong> وقت التوصيل يُحسب فقط للطلبات التي تضمّنت تسجيل وقت التسليم (deliveredAt). التقييمات مأخوذة من تقييمات العملاء بعد اكتمال الطلب.
      </div>
    </div>`;
  };

  /* ── بطاقة مندوب واحد ──────────────────────────── */
  function _driverCard(d, idx) {
    const compColor  = completionColor(d.completion);
    const rankMedal  = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`;
    const linked     = d.uid || '';
    const name       = d.name || 'مندوب';

    return `
    <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:18px;overflow:hidden;transition:box-shadow 0.2s"
         onmouseover="this.style.boxShadow='0 4px 20px rgba(139,92,246,0.1)'" onmouseout="this.style.boxShadow=''">

      <!-- رأس البطاقة -->
      <div style="padding:16px 20px 14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="position:relative;flex-shrink:0">
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900">
            ${esc(name.charAt(0).toUpperCase())}
          </div>
          <div style="position:absolute;bottom:-4px;right:-4px;background:var(--bg-card);border-radius:50%;font-size:13px;line-height:1;padding:1px">
            ${rankMedal}
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:900;color:var(--text-main)">${esc(name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
            ${d.phone ? `<span>📞 ${esc(d.phone)}</span>` : ''}
            ${d.vehicleType ? `<span>🚗 ${esc(d.vehicleType)}</span>` : ''}
            ${d.lastAt ? `<span>آخر نشاط: ${fmtDate(d.lastAt)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
          ${d.phone ? `<a href="tel:${esc(d.phone)}" style="display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none">📞</a>` : ''}
          ${linked ? `<button onclick="adminSendDriverMessage('${esc(linked)}','${esc(name)}')" style="display:inline-flex;align-items:center;gap:4px;background:rgba(124,58,237,0.1);color:#7c3aed;border:1px solid rgba(124,58,237,0.3);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">📨 راسله</button>` : ''}
        </div>
      </div>

      <!-- مؤشرات الأداء -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--border);border-top:1px solid var(--border)">
        ${[
          { label:'طلبات مُسنَدة',    val: d.total,                  color:'#8b5cf6', icon:'📋' },
          { label:'طلبات مكتملة',    val: d.completed,              color:'#10b981', icon:'✅' },
          { label:'طلبات ملغاة',     val: d.cancelled,              color:'#ef4444', icon:'❌' },
          { label:'نسبة الإنجاز',    val: d.completion+'%',         color: compColor, icon:'📊' },
          { label:'متوسط الوقت',     val: fmtDuration(d.avgDuration),color:'#0d9488', icon:'⏱️' },
        ].map(m => `
        <div style="background:var(--bg-card);padding:12px 16px;text-align:center">
          <div style="font-size:16px;margin-bottom:4px">${m.icon}</div>
          <div style="font-size:18px;font-weight:900;color:${m.color}">${m.val}</div>
          <div style="font-size:11px;color:var(--text-muted)">${m.label}</div>
        </div>`).join('')}

        <!-- التقييم -->
        <div style="background:var(--bg-card);padding:12px 16px;text-align:center">
          <div style="font-size:16px;margin-bottom:4px">⭐</div>
          <div style="font-size:14px;font-weight:900;margin-bottom:2px">${stars(d.avgRating||0, d.ratingCount||0)}</div>
          <div style="font-size:11px;color:var(--text-muted)">تقييم العملاء</div>
        </div>
      </div>

      <!-- شريط نسبة الإنجاز -->
      <div style="padding:10px 20px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:11px;color:var(--text-muted)">نسبة الإنجاز</span>
          <span style="font-size:12px;font-weight:800;color:${compColor}">${d.completion}%</span>
        </div>
        ${bar(d.completion, compColor)}
      </div>
    </div>`;
  }

  console.log('[DriverPerformance] تقرير أداء المندوبين جاهز 📊');
})();
