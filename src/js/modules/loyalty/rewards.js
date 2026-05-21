// ═══════════════════════════════════════════════════════
//  محجوز v3.2 — Phase 12 (Loyalty / Rewards)
//  - 10% من قيمة كل طلب مكتمل تتحول إلى نقاط ولاء
//  - مستويات: برونزي / فضي / ذهبي / بلاتيني
//  - تحويل النقاط إلى رصيد محفظة (1 نقطة = 1 ريال)
//  - بطاقة الولاء تظهر في الإعدادات
// ═══════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('loyalty_section', '🏆 برنامج الولاء',     '🏆 Loyalty program');
  add('loyalty_points',  'نقاطي',                 'My points');
  add('loyalty_level',   'مستواي',                'My level');
  add('loyalty_next',    'للوصول للمستوى التالي',  'To next level');
  add('loyalty_redeem',  '💰 تحويل النقاط إلى رصيد محفظة', '💰 Convert points to wallet credit');
  add('loyalty_no_pts',  'لا توجد نقاط للتحويل',  'No points to redeem');
  add('loyalty_redeemed','✅ تم تحويل النقاط إلى محفظتك', '✅ Points converted to your wallet');
})();

// ── Levels (cumulative points)
window.PH12_LEVELS = [
  { key:'bronze',   name:'برونزي',  nameEn:'Bronze',   min:0,    color:'#cd7f32', icon:'🥉', discountPct: 0  },
  { key:'silver',   name:'فضي',     nameEn:'Silver',   min:500,  color:'#c0c0c0', icon:'🥈', discountPct: 3  },
  { key:'gold',     name:'ذهبي',    nameEn:'Gold',     min:2000, color:'#ffd700', icon:'🥇', discountPct: 5  },
  { key:'platinum', name:'بلاتيني', nameEn:'Platinum', min:5000, color:'#e5e4e2', icon:'💎', discountPct: 8  },
];

window.ph12_levelOf = function (points) {
  let lv = window.PH12_LEVELS[0];
  for (const l of window.PH12_LEVELS) if (points >= l.min) lv = l;
  return lv;
};
window.ph12_nextLevel = function (points) {
  return window.PH12_LEVELS.find(l => l.min > points) || null;
};

// ── Award points on order completion (wrap status update)
(function patchOrderStatusForLoyalty() {
  const wrapped = {};
  function wrap(name) {
    const orig = window[name];
    if (typeof orig !== 'function') return false;
    wrapped[name] = true;
    window[name] = async function (orderId, status) {
      const r = await orig.apply(this, arguments);
      if (status === 'completed' || status === 'delivered') {
        try {
          const o = AppData.orders.find(x => x.id === orderId);
          if (o && o.customerId && (o.servicePrice || o.total)) {
            const base = o.servicePrice || (o.total - (o.deliveryFee || 0)) || 0;
            const pts = Math.floor(base * 0.10);
            if (pts > 0) await ph12_addPoints(o.customerId, pts, `طلب ${o.orderId || orderId}`, orderId);
          }
        } catch (e) { console.warn('[Phase12] award failed', e); }
      }
      return r;
    };
    return true;
  }
  function tryWrap() {
    let p = false;
    if (!window.__ph12_w_uos) p |= !(window.__ph12_w_uos = wrap('updateOrderStatus'));
    if (!window.__ph12_w_uds) p |= !(window.__ph12_w_uds = wrap('updateDeliveryStatus'));
    if (p) setTimeout(tryWrap, 700);
  }
  tryWrap();
})();

// ── Add / read loyalty points (stored on user doc as `loyaltyPoints`)
window.ph12_getPoints = async function (uid) {
  if (!uid) return 0;
  const u = AppData.users.find(x => x.uid === uid);
  if (u && typeof u.loyaltyPoints === 'number') return u.loyaltyPoints;
  try {
    const doc = await db.collection('users').doc(uid).get();
    return (doc.exists && doc.data().loyaltyPoints) || 0;
  } catch (e) { return 0; }
};

window.ph12_addPoints = async function (uid, pts, note = '', orderId = null) {
  if (!uid || !pts) return;
  const cur = await ph12_getPoints(uid);
  const newTotal = cur + pts;
  await fsUpdate('users', uid, { loyaltyPoints: newTotal });
  // Sync local cache
  const local = AppData.users.find(x => x.uid === uid);
  if (local) local.loyaltyPoints = newTotal;
  if (State.currentUser?.uid === uid) State.currentUser.loyaltyPoints = newTotal;
  // Log history
  try {
    await db.collection('loyalty_log').add({
      uid, points: pts, note, orderId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {}
  // Notify user
  try {
    if (typeof db !== 'undefined') {
      db.collection('user_notifications').add({
        uid, title: `🎁 +${pts} نقطة ولاء`,
        body: `حصلت على ${pts} نقطة من ${note}. مجموعك الآن ${newTotal} نقطة.`,
        read: false, kind: 'loyalty',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {}
};

window.ph12_redeem = async function () {
  const u = State.currentUser;
  if (!u) return;
  const pts = await ph12_getPoints(u.uid);
  if (pts < 50) { toast('تحتاج 50 نقطة على الأقل للتحويل', 'error'); return; }
  if (!confirm(`هل تريد تحويل ${pts} نقطة إلى ${pts} ريال في محفظتك؟`)) return;
  try {
    await fsUpdate('users', u.uid, { loyaltyPoints: 0 });
    if (State.currentUser) State.currentUser.loyaltyPoints = 0;
    const local = AppData.users.find(x => x.uid === u.uid);
    if (local) local.loyaltyPoints = 0;
    await creditWallet(u.uid, pts, `تحويل ${pts} نقطة ولاء`);
    toast(t('loyalty_redeemed'), 'success');
    await render();
  } catch (e) {
    toast('تعذّر التحويل: ' + (e.message || e), 'error');
  }
};

// ── Inject "🏆 برنامج الولاء" card into settings page
(function patchSettingsForLoyalty() {
  const __orig = window.renderSettingsPage;
  if (typeof __orig !== 'function') { setTimeout(patchSettingsForLoyalty, 600); return; }
  window.renderSettingsPage = function () {
    let html = __orig.apply(this, arguments);
    return html; // DISABLE LOYALTY UI
    const u = State.currentUser;
    if (!u) return html;
    const pts = u.loyaltyPoints || 0;
    const lv = ph12_levelOf(pts);
    const next = ph12_nextLevel(pts);
    const pctNext = next ? Math.min(100, Math.round(((pts - lv.min) / (next.min - lv.min)) * 100)) : 100;
    const card = `
      <div class="ph9-card ph12-loyal-card" style="border-color:${lv.color}55;background:linear-gradient(135deg,${lv.color}18,${lv.color}06)">
        <div class="ph9-card-head"><h3>${t('loyalty_section')}</h3></div>
        <div class="ph12-loyal-row">
          <div class="ph12-badge" style="background:linear-gradient(135deg,${lv.color},${lv.color}aa);color:#1a1730">
            <div class="ph12-badge-ic">${lv.icon}</div>
            <div class="ph12-badge-name">${lv.name}</div>
          </div>
          <div class="ph12-loyal-stats">
            <div class="ph12-loyal-pts">${pts.toLocaleString('ar-EG')} <small>نقطة</small></div>
            ${next ? `
              <div class="ph12-loyal-bar"><div class="ph12-loyal-bar-fill" style="width:${pctNext}%;background:${next.color}"></div></div>
              <div class="ph9-hint">${t('loyalty_next')} (${next.icon} ${next.name}): ${(next.min - pts).toLocaleString('ar-EG')} نقطة</div>
            ` : `<div class="ph9-hint">🏆 وصلت إلى أعلى مستوى!</div>`}
            ${lv.discountPct ? `<div class="ph12-perk">⚡ خصم ${lv.discountPct}% على كل طلباتك</div>` : ''}
          </div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="ph12_redeem()" ${pts < 50 ? 'disabled' : ''}>
          ${t('loyalty_redeem')} ${pts < 50 ? `(الحد الأدنى 50 نقطة)` : `(${pts} ريال)`}
        </button>
      </div>`;
    // Insert before logout card (last ph9-card)
    const idx = html.lastIndexOf('<div class="ph9-card">');
    if (idx !== -1) html = html.slice(0, idx) + card + html.slice(idx);
    return html;
  };
})();

console.log('[Phase 12] Loyalty rewards loaded.');
