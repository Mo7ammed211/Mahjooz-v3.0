/* ============================================================
   Driver Assignment — تعيين المندوب على الطلب
   ------------------------------------------------------------
   adminAssignDriver(orderId)  — يفتح مودال اختيار المندوب
   يُحدّث orders بـ { driverId, driverName }
   ويُرسل إشعاراً فورياً للمندوب عبر driver_messages
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  /* ── حالة البث الأخيرة للمندوب (آخر طلب نشط له) ── */
  function driverActiveOrder(uid) {
    return (AppData.orders || []).find(o =>
      o.driverId === uid &&
      !['completed','cancelled','rejected'].includes(o.status)
    );
  }

  /* ══════════════════════════════════════════════════
     showDriverAssignModal — نقطة الدخول
  ══════════════════════════════════════════════════ */
  window.adminAssignDriver = function (orderId) {
    const order   = (AppData.orders || []).find(o => o.id === orderId);
    if (!order) { toast('لم يُعثر على الطلب', 'error'); return; }

    const drivers = (AppData.ddbEntries || []).filter(d => d.linkedUserId);
    const sq      = '';

    openModal(_buildModal(order, drivers, sq), 'lg');
  };

  /* ── بناء HTML المودال ─────────────────────────── */
  function _buildModal(order, drivers, sq) {
    const filtered = sq
      ? drivers.filter(d =>
          (d.name||'').toLowerCase().includes(sq) ||
          (d.vehicleType||'').toLowerCase().includes(sq) ||
          (d.phone||'').includes(sq)
        )
      : drivers;

    const currentUid  = order.driverId || '';
    const currentName = order.driverName || '';

    return `
    <div class="modal-header" style="border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:0">
      <div>
        <h2 class="modal-title" style="margin-bottom:4px">🚗 تعيين مندوب</h2>
        <p style="font-size:12px;color:var(--text-muted);margin:0">الطلب #${esc(order.orderId||order.id.slice(-6))} · ${esc(order.customerName||'')}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <!-- المندوب الحالي -->
    ${currentUid ? `
    <div style="background:rgba(16,185,129,0.07);border:1.5px solid rgba(16,185,129,0.25);border-radius:14px;padding:12px 16px;margin:16px 0;display:flex;align-items:center;gap:12px">
      <div style="font-size:22px">✅</div>
      <div style="flex:1">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">المندوب المعيّن حالياً</div>
        <div style="font-weight:900;color:#10b981">${esc(currentName)}</div>
      </div>
      <button onclick="adminUnassignDriver('${esc(order.id)}')"
              style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
        ❌ إلغاء التعيين
      </button>
    </div>` : `
    <div style="background:rgba(245,158,11,0.07);border:1.5px solid rgba(245,158,11,0.2);border-radius:14px;padding:10px 16px;margin:16px 0;font-size:12px;color:var(--text-secondary)">
      ⚠️ لم يُعيَّن مندوب على هذا الطلب بعد
    </div>`}

    <!-- بحث -->
    <div style="position:relative;margin-bottom:14px">
      <span style="position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">🔍</span>
      <input id="drv-assign-search"
             style="width:100%;padding:10px 40px 10px 12px;border:1.5px solid var(--border);border-radius:12px;background:var(--glass-bg);color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;box-sizing:border-box"
             placeholder="ابحث بالاسم أو المركبة أو الهاتف..."
             oninput="_drvAssignSearch(this.value, '${esc(order.id)}')"
             onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
    </div>

    <!-- قائمة المندوبين -->
    <div id="drv-assign-list" style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-left:2px">
      ${filtered.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <div style="font-size:36px;margin-bottom:10px">🚗</div>
          <div>لا يوجد مندوبون مرتبطون بحسابات بعد</div>
          <div style="font-size:12px;margin-top:6px">أضف مندوبين من قاعدة المندوبين وارتبطهم بحسابات مستخدمين</div>
        </div>` :
        filtered.map(d => _driverRow(d, order, currentUid)).join('')
      }
    </div>`;
  }

  /* ── صف مندوب واحد ─────────────────────────────── */
  function _driverRow(d, order, currentUid) {
    const isAssigned  = d.linkedUserId === currentUid;
    const activeOrder = driverActiveOrder(d.linkedUserId);
    const busy        = activeOrder && activeOrder.id !== order.id;
    const stats       = _quickStats(d.linkedUserId);

    return `
    <div style="background:var(--bg-card);border:1.5px solid ${isAssigned ? 'rgba(16,185,129,0.4)' : 'var(--border)'};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:all 0.15s"
         onmouseover="this.style.borderColor='var(--primary)';this.style.background='rgba(124,58,237,0.04)'"
         onmouseout="this.style.borderColor='${isAssigned ? 'rgba(16,185,129,0.4)' : 'var(--border)'}';this.style.background='var(--bg-card)'">

      <!-- صورة/حرف -->
      <div style="position:relative;flex-shrink:0">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900">
          ${esc((d.name||'م').charAt(0).toUpperCase())}
        </div>
        <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;border:2px solid var(--bg-card);background:${busy ? '#f59e0b' : '#10b981'}"></div>
      </div>

      <!-- بيانات -->
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:14px;color:var(--text-main);display:flex;align-items:center;gap:6px">
          ${esc(d.name||'مندوب')}
          ${isAssigned ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:800">✓ معيّن</span>' : ''}
          ${busy ? '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:800">مشغول</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
          ${d.vehicleType ? `<span>🚗 ${esc(d.vehicleType)}</span>` : ''}
          ${d.phone ? `<span>📞 ${esc(d.phone)}</span>` : ''}
          ${d.coverageAreas ? `<span>📍 ${esc(d.coverageAreas)}</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;display:flex;gap:12px">
          <span>📦 ${stats.total} طلب</span>
          <span>✅ ${stats.completed} مكتمل</span>
          ${stats.avgRating ? `<span>⭐ ${stats.avgRating}</span>` : ''}
        </div>
      </div>

      <!-- زر التعيين -->
      <button onclick="adminDoAssign('${esc(order.id)}','${esc(d.linkedUserId)}','${esc(d.name||'مندوب')}')"
              style="flex-shrink:0;background:${isAssigned ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)'};color:${isAssigned ? '#10b981' : '#7c3aed'};border:1.5px solid ${isAssigned ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'};border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;white-space:nowrap">
        ${isAssigned ? '✓ معيّن' : '🚗 تعيين'}
      </button>
    </div>`;
  }

  /* ── إحصائيات سريعة للمندوب ─────────────────────── */
  function _quickStats(uid) {
    const myOrders = (AppData.orders || []).filter(o => o.driverId === uid);
    const completed = myOrders.filter(o => ['completed','delivered'].includes(o.status)).length;
    const ratings   = (AppData.ratings || []).filter(r => r.driverId === uid && r.driverStars);
    const avgRating = ratings.length
      ? (ratings.reduce((a,r) => a + Number(r.driverStars), 0) / ratings.length).toFixed(1)
      : null;
    return { total: myOrders.length, completed, avgRating };
  }

  /* ── بحث داخل المودال بدون إغلاقه ───────────────── */
  window._drvAssignSearch = function (sq, orderId) {
    const order   = (AppData.orders || []).find(o => o.id === orderId);
    if (!order) return;
    const drivers = (AppData.ddbEntries || []).filter(d => d.linkedUserId);
    const currentUid = order.driverId || '';
    const q = sq.toLowerCase().trim();
    const filtered = q
      ? drivers.filter(d =>
          (d.name||'').toLowerCase().includes(q) ||
          (d.vehicleType||'').toLowerCase().includes(q) ||
          (d.phone||'').includes(q)
        )
      : drivers;
    const listEl = document.getElementById('drv-assign-list');
    if (!listEl) return;
    listEl.innerHTML = filtered.length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--text-muted)">🔍 لا توجد نتائج</div>`
      : filtered.map(d => _driverRow(d, order, currentUid)).join('');
  };

  /* ══════════════════════════════════════════════════
     adminDoAssign — تنفيذ التعيين
  ══════════════════════════════════════════════════ */
  window.adminDoAssign = async function (orderId, driverUid, driverName) {
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
      await fsUpdate('orders', orderId, {
        driverId:   driverUid,
        driverName: driverName,
        assignedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const order = (AppData.orders || []).find(o => o.id === orderId);
      const orderRef = order?.orderId || orderId.slice(-6);

      await db.collection('driver_messages').add({
        toUid:     driverUid,
        fromUid:   State.currentUser?.uid || 'admin',
        message:   `📦 تم تعيينك على الطلب #${orderRef}\nالعميل: ${order?.customerName || ''}\nالخدمة: ${order?.svcName || ''}`,
        type:      'assignment',
        orderId:   orderId,
        read:      false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      toast(`✅ تم تعيين ${driverName} على الطلب`, 'success');
      closeModal();
      await render();
    } catch (err) {
      console.error('[DriverAssign] خطأ:', err);
      toast('حدث خطأ أثناء التعيين', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🚗 تعيين'; }
    }
  };

  /* ══════════════════════════════════════════════════
     adminUnassignDriver — إلغاء التعيين
  ══════════════════════════════════════════════════ */
  window.adminUnassignDriver = async function (orderId) {
    if (!confirm('إلغاء تعيين المندوب من هذا الطلب؟')) return;
    try {
      await fsUpdate('orders', orderId, {
        driverId:   null,
        driverName: null,
        assignedAt: null
      });
      toast('تم إلغاء تعيين المندوب', 'success');
      closeModal();
      await render();
    } catch (err) {
      console.error('[DriverAssign] خطأ إلغاء:', err);
      toast('حدث خطأ', 'error');
    }
  };

  console.log('[DriverAssign] نظام تعيين المندوبين جاهز 🚗');
})();
