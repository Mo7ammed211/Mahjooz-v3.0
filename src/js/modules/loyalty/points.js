/* ============================================================
   phase31.js — نظام نقاط الولاء (Loyalty Points)
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('loyalty_points', 'نقاط الولاء', 'Loyalty Points');
  add('points', 'نقاط', 'Points');
  add('points_balance', 'رصيد النقاط', 'Points Balance');
  add('earn_points', 'اكسب نقاط', 'Earn Points');
  add('spend_points', 'استبدل نقاط', 'Spend Points');
  add('points_earned', 'النقاط المكتسبة', 'Points Earned');
  add('points_spent', 'النقاط المستبدلة', 'Points Spent');
  add('points_history', 'سجل النقاط', 'Points History');
  add('reward', 'مكافأة', 'Reward');
  add('rewards', 'المكافآت', 'Rewards');
  add('redeem', 'استبدال', 'Redeem');
  add('loyalty_level', 'مستوى الولاء', 'Loyalty Level');
  add('bronze', 'برونزي', 'Bronze');
  add('silver', 'فضي', 'Silver');
  add('gold', 'ذهبي', 'Gold');
  add('platinum', 'بلاتيني', 'Platinum');
  add('diamond', 'ماسي', 'Diamond');
  add('level_up', 'ترقية المستوى', 'Level Up');
  add('points_per_riyal', 'نقاط لكل ريال', 'Points Per Riyal');
  add('welcome_points', 'نقاط ترحيبية', 'Welcome Points');
  add('referral_points', 'نقاط الإحالة', 'Referral Points');
  add('review_points', 'نقاط التقييم', 'Review Points');
  add('birthday_points', 'نقاط عيد الميلاد', 'Birthday Points');

})();

// ============================================================
// Loyalty Config
// ============================================================

window.ph31_config = {
  pointsPerRiyal: 1,        // 1 نقطة لكل ريال
  minPointsRedeem: 100,       // الحد الأدنى للاستبدال
  redemptionRate: 0.01,      // 1 نقطة = 0.01 ريال
  welcomeBonus: 100,          // نقاط ترحيبية
  referralBonus: 50,           // نقاط الإحالة
  reviewBonus: 10,            // نقاط التقييم
  levels: [
    { name: 'bronze', min: 0, discount: 0, color: '#cd7f32' },
    { name: 'silver', min: 500, discount: 5, color: '#c0c0c0' },
    { name: 'gold', min: 2000, discount: 10, color: '#ffd700' },
    { name: 'platinum', min: 5000, discount: 15, color: '#e5e4e2' },
    { name: 'diamond', min: 10000, discount: 20, color: '#b9f2ff' }
  ]
};

// ============================================================
// Get User Points
// ============================================================

window.ph31_getUserPoints = function(uid) {
  const points = AppData.points || [];
  return points.find(p => p.uid === uid) || { uid, balance: 0, earned: 0, spent: 0, level: 'bronze', history: [] };
};

window.ph31_getLevel = function(totalPoints) {
  const levels = window.ph31_config.levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalPoints >= levels[i].min) return levels[i];
  }
  return levels[0];
};

// ============================================================
// Add Points
// ============================================================

window.ph31_earnPoints = async function(uid, amount, reason) {
  if (!uid || amount <= 0) return;
  
  const userPoints = window.ph31_getUserPoints(uid);
  const newBalance = (userPoints.balance || 0) + amount;
  const newEarned = (userPoints.earned || 0) + amount;
  const newLevel = window.ph31_getLevel(newEarned);
  
  await fsSet(`points/${uid}`, {
    uid: uid,
    balance: newBalance,
    earned: newEarned,
    spent: userPoints.spent || 0,
    level: newLevel.name,
    levelDiscount: newLevel.discount,
    lastUpdated: new Date(),
    history: [
      ...(userPoints.history || []),
      { date: new Date(), amount, reason, type: 'earn' }
    ].slice(-50) // Keep last 50
  });
  
  return { balance: newBalance, level: newLevel };
};

// ============================================================
// Spend/Redeem Points
// ============================================================

window.ph31_spendPoints = async function(uid, amount, reason) {
  const userPoints = window.ph31_getUserPoints(uid);
  
  if ((userPoints.balance || 0) < amount) {
    toast('رصيد نقاط غير كافٍ', 'error');
    return false;
  }
  
  const newBalance = (userPoints.balance || 0) - amount;
  const newSpent = (userPoints.spent || 0) + amount;
  const riyalValue = amount * window.ph31_config.redemptionRate;
  
  await fsSet(`points/${uid}`, {
    uid: uid,
    balance: newBalance,
    earned: userPoints.earned || 0,
    spent: newSpent,
    level: userPoints.level,
    lastUpdated: new Date(),
    history: [
      ...(userPoints.history || []),
      { date: new Date(), amount: -amount, riyalValue, reason, type: 'spend' }
    ].slice(-50)
  });
  
  return { balance: newBalance, riyalValue };
};

// ============================================================
// Render User Loyalty Card
// ============================================================

window.ph31_renderLoyaltyCard = function(user) {
  const userPoints = window.ph31_getUserPoints(user.uid);
  const level = window.ph31_getLevel(userPoints.earned || 0);
  const nextLevel = window.ph31_config.levels[window.ph31_config.levels.findIndex(l => l.name === level.name) + 1];
  
  const pointsToNext = nextLevel ? nextLevel.min - (userPoints.earned || 0) : 0;
  const progress = nextLevel ? ((userPoints.earned || 0) - level.min) / (nextLevel.min - level.min) * 100 : 100;
  
  return `
    <div class="ph31-loyalty-card" style="background:linear-gradient(135deg,${level.color}30,${level.color}10);border:2px solid ${level.color};border-radius:20px;padding:24px;margin-bottom:20px">
      <div class="ph31-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-size:12px;color:var(--text-muted)">${I18N.ar.points_balance}</div>
          <div style="font-size:36px;font-weight:800;color:${level.color}">${userPoints.balance || 0}</div>
        </div>
        <div class="ph31-level-badge" style="background:${level.color};color:#000;padding:8px 16px;border-radius:20px;font-weight:700">
          ${level.name.toUpperCase()}
        </div>
      </div>
      
      <div class="ph31-progress" style="margin:16px 0">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span>${level.name}</span>
          ${nextLevel ? `<span>${nextLevel.min} نقطة</span>` : ''}
        </div>
        <div style="height:8px;background:rgba(0,0,0,0.2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(progress, 100)}%;background:${level.color};border-radius:4px;transition:width 0.3s"></div>
        </div>
        ${nextLevel && pointsToNext > 0 ? `
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;text-align:center">
            متبقي ${pointsToNext} نقطة للمستوى التالي
          </div>
        ` : ''}
      </div>
      
      <div class="ph31-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="text-align:center;padding:12px;background:rgba(0,0,0,0.1);border-radius:12px">
          <div style="font-size:20px;font-weight:700">${userPoints.earned || 0}</div>
          <div style="font-size:11px;color:var(--text-muted)">${I18N.ar.points_earned}</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(0,0,0,0.1);border-radius:12px">
          <div style="font-size:20px;font-weight:700">${userPoints.spent || 0}</div>
          <div style="font-size:11px;color:var(--text-muted)">${I18N.ar.points_spent}</div>
        </div>
      </div>
      
      ${level.discount > 0 ? `
        <div class="ph31-benefits" style="margin-top:16px;padding:12px;background:rgba(16,185,129,0.2);border-radius:12px;text-align:center">
          🎉 خصم <strong>${level.discount}%</strong> على كل الخدمات
        </div>
      ` : ''}
    </div>
  `;
};

// ============================================================
// Render Points History
// ============================================================

window.ph31_renderHistory = function(user) {
  const userPoints = window.ph31_getUserPoints(user.uid);
  const history = (userPoints.history || []).reverse();
  
  if (history.length === 0) {
    return `<div style="text-align:center;padding:40px;color:var(--text-muted)">لا يوجد سجل نقاط بعد</div>`;
  }
  
  return `
    <div class="ph31-history">
      ${history.map(h => `
        <div class="ph31-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:600">${h.reason}</div>
            <div style="font-size:12px;color:var(--text-muted)">${new Date(h.date).toLocaleDateString('ar-SA')}</div>
          </div>
          <div style="font-size:18px;font-weight:700;color:${h.type === 'earn' ? '#10b981' : '#ef4444'}">
            ${h.type === 'earn' ? '+' : '-'}${Math.abs(h.amount)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// ============================================================
// Render Rewards
// ============================================================

window.ph31_renderRewards = function(user) {
  const userPoints = window.ph31_getUserPoints(user.uid);
  
  const rewards = [
    { name: 'خصم 50 ريال', points: 5000, value: 50, icon: '🎫' },
    { name: 'خصم 100 ريال', points: 10000, value: 100, icon: '🎟️' },
    { name: 'خدمة مجانية', points: 15000, value: 'free', icon: '🎁' },
    { name: 'شحن محفظة 50 ريال', points: 5000, value: 50, icon: '💰' }
  ];
  
  return `
    <div class="ph31-rewards">
      <div style="margin-bottom:16px;font-weight:600">${I18N.ar.rewards}</div>
      ${rewards.map(r => `
        <div class="ph31-reward-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:28px">${r.icon}</span>
            <div>
              <div style="font-weight:600">${r.name}</div>
              <div style="font-size:12px;color:var(--text-muted)">${r.points} نقطة</div>
            </div>
          </div>
          <button class="btn btn-sm ${userPoints.balance >= r.points ? 'btn-primary' : 'btn-secondary'}" 
            onclick="ph31_redeemReward('${r.name}', ${r.points}, ${r.value})"
            ${userPoints.balance < r.points ? 'disabled' : ''}>
            ${I18N.ar.redeem}
          </button>
        </div>
      `).join('')}
    </div>
  `;
};

window.ph31_redeemReward = async function(name, points, value) {
  const u = State.currentUser;
  if (!u) return;
  
  const result = await window.ph31_spendPoints(u.uid, points, `استبدال: ${name}`);
  if (!result) return;
  
  // Apply reward
  if (typeof value === 'number') {
    await window.creditWallet(u.uid, value, `مكافأة نقاط: ${name}`);
    toast(`تم استبدال ${points} نقطة بـ ${value} ريال!`, 'success');
  } else {
    toast(`تم استبدال: ${name}`, 'success');
  }
};

// ============================================================
// Auto Earn Points on Order Complete
// ============================================================

window.ph31_onOrderComplete = async function(order) {
  if (!order || !order.customerId) return;
  
  const points = Math.round((order.total || 0) * window.ph31_config.pointsPerRiyal);
  if (points <= 0) return;
  
  await window.ph31_earnPoints(order.customerId, points, `طلب #${order.orderId}`);
};

// ============================================================
// Add Styles
// ============================================================

(function() {
  if (window.ph31_stylesAdded) return;
  window.ph31_stylesAdded = true;
  
  const style = document.createElement('style');
  style.textContent = `
    .ph31-loyalty-card { position: relative; overflow: hidden; }
    .ph31-header { position: relative; z-index: 1; }
    .ph31-level-badge { text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
    .ph31-history-item:last-child { border-bottom: none; }
    .ph31-reward-card { transition: all 0.2s; }
    .ph31-reward-card:hover { border-color: var(--primary); transform: translateY(-2px); }
  `;
  document.head.appendChild(style);
})();

console.log('[Phase 31] Loyalty Points System loaded');