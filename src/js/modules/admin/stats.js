// ═══════════════════════════════════════════════════════
//  محجوز v2.3 — Phase 3
//  - Drill-down statistics (clickable stat cards)
//  - Customer Service (CS) role + permissions
//  - Manual account creation by admin
//  - Wallet enhancements (manual adjust)
//  - Send invoice via WhatsApp / Email
//  - In-app notifications bell with dropdown
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('drill_users', 'قائمة المستخدمين', 'Users list');
  add('drill_vendors', 'قائمة أصحاب الخدمات', 'Vendors list');
  add('drill_customers', 'قائمة العملاء', 'Customers list');
  add('drill_orders', 'كل الطلبات', 'All orders');
  add('drill_completed', 'الطلبات المكتملة', 'Completed orders');
  add('drill_revenue', 'تفاصيل الإيرادات', 'Revenue breakdown');
  add('cs_role', 'خدمة العملاء', 'Customer Service');
  add('permissions', 'الصلاحيات', 'Permissions');
  add('perm_view_orders', 'عرض الطلبات', 'View orders');
  add('perm_edit_orders', 'تعديل الطلبات', 'Edit orders');
  add('perm_create_users', 'إنشاء حسابات', 'Create accounts');
  add('perm_chat_customers', 'محادثة العملاء', 'Chat with customers');
  add('perm_view_wallets', 'عرض المحافظ', 'View wallets');
  add('perm_adjust_wallets', 'تعديل المحافظ', 'Adjust wallets');
  add('perm_view_reports', 'عرض التقارير', 'View reports');
  add('add_user_manual', 'إضافة مستخدم جديد', 'Add new user');
  add('adjust_wallet', 'تعديل الرصيد', 'Adjust balance');
  add('send_invoice', 'إرسال الفاتورة', 'Send invoice');
  add('send_via_whatsapp', 'واتساب', 'WhatsApp');
  add('send_via_email', 'بريد', 'Email');
  add('notifications', 'الإشعارات', 'Notifications');
  add('no_notifications', 'لا توجد إشعارات', 'No notifications');
  add('mark_all_read', 'تعليم الكل كمقروء', 'Mark all read');
  add('amount_to_credit', 'مبلغ الإضافة (ريال)', 'Amount to credit (SAR)');
  add('amount_to_debit', 'مبلغ الخصم (ريال)', 'Amount to debit (SAR)');
  add('reason', 'السبب', 'Reason');
  if (typeof applyLang === 'function') applyLang();
})();

// ─── Default permissions per role ─────────────────────
const DEFAULT_PERMS = {
  admin:    { view_orders:true, edit_orders:true, create_users:true, chat_customers:true, view_wallets:true, adjust_wallets:true, view_reports:true },
  cs:       { view_orders:true, edit_orders:true, create_users:false, chat_customers:true, view_wallets:true, adjust_wallets:false, view_reports:true },
  staff:    { view_orders:true, edit_orders:true, create_users:false, chat_customers:false, view_wallets:false, adjust_wallets:false, view_reports:false },
  vendor:   {},
  driver:   {},
  customer: {},
  guest:    {},
};
function userHasPerm(u, perm) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  const p = u.permissions || DEFAULT_PERMS[u.role] || {};
  return !!p[perm];
}
window.userHasPerm = userHasPerm;

// getSecondaryAuth is now in core.js

// ─── Notifications collection helpers ─────────────────
async function pushNotification({ uid, title, body, type = 'info', link = null }) {
  try {
    await db.collection('user_notifications').add({
      uid, title, body, type, link, read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.warn('pushNotification failed:', e); }
}
window.pushNotification = pushNotification;

async function loadMyNotifications(uid, limit = 20) {
  try {
    const snap = await Promise.race([
      db.collection('user_notifications').where('uid', '==', uid).limit(limit).get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 4000)),
    ]);
    return (snap.docs || []).map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { return []; }
}

// ─── Notification bell (added to navbar) ───────────────
async function refreshNotifBell() {
  const u = State.currentUser;
  const wrap = document.getElementById('notif-bell-wrap');
  if (!wrap || !u) return;
  const list = await loadMyNotifications(u.uid);
  State._notifs = list;
  const unread = list.filter(n => !n.read).length;
  wrap.querySelector('.notif-badge').textContent = unread > 99 ? '99+' : (unread || '');
  wrap.querySelector('.notif-badge').style.display = unread ? 'flex' : 'none';
}

function toggleNotifPanel() {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  const open = p.classList.toggle('show');
  if (open) renderNotifPanel();
}

function renderNotifPanel() {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  const list = State._notifs || [];
  p.innerHTML = `
    <div class="notif-head">
      <strong>${t('notifications')}</strong>
      ${list.some(n => !n.read) ? `<button class="link-btn" onclick="markAllNotifsRead()">${t('mark_all_read')}</button>` : ''}
    </div>
    <div class="notif-body">
      ${list.length ? list.map(n => `
        <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="onNotifClick('${n.id}', ${n.link ? `'${n.link}'` : 'null'})">
          <div class="notif-dot ${n.type || 'info'}"></div>
          <div style="flex:1">
            <div class="notif-title">${escHtml(n.title || '')}</div>
            ${n.body ? `<div class="notif-body-txt">${escHtml(n.body)}</div>` : ''}
            <div class="notif-time">${typeof fmtDate === 'function' ? fmtDate(n.createdAt) : ''}</div>
          </div>
        </div>`).join('') :
        `<div class="notif-empty">🔔 ${t('no_notifications')}</div>`}
    </div>`;
}

async function onNotifClick(id, link) {
  try { await db.collection('user_notifications').doc(id).update({ read: true }); } catch (e) {}
  await refreshNotifBell();
  document.getElementById('notif-panel')?.classList.remove('show');
  if (link) {
    const [page, paramsJson] = link.split('?');
    let params = {};
    if (paramsJson) try { params = JSON.parse(decodeURIComponent(paramsJson)); } catch(e) {}
    navigate(page, params);
  }
}

async function markAllNotifsRead() {
  const list = State._notifs || [];
  await Promise.all(list.filter(n => !n.read).map(n =>
    db.collection('user_notifications').doc(n.id).update({ read: true }).catch(() => {})
  ));
  await refreshNotifBell();
  renderNotifPanel();
}

document.addEventListener('click', (e) => {
  const p = document.getElementById('notif-panel');
  if (!p || !p.classList.contains('show')) return;
  if (e.target.closest('#notif-bell-wrap')) return;
  p.classList.remove('show');
});

// ─── Inject the bell into the navbar after each render ─
const __originalRender = window.render;
window.render = async function (...args) {
  let result;
  try {
    result = await __originalRender.apply(this, args);
  } catch (e) {
    console.error('render() failed:', e?.message || String(e), '\nstack:', e?.stack || '(no stack)', '\nraw:', e);
    // Surface the failure to the UI so the page is never silently blank
    try {
      const app = document.getElementById('app');
      if (app) app.innerHTML = `
        <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center">
          <div style="font-size:48px">⚠️</div>
          <h2 style="color:var(--text-main,#fff);margin:0">حدث خطأ أثناء تحميل الصفحة</h2>
          <div style="color:var(--text-secondary,#aaa);max-width:520px;font-size:14px">
            ${escHtml ? escHtml(e?.message || String(e)) : (e?.message || String(e))}
          </div>
          <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
          <button class="btn btn-secondary" onclick="State.currentPage='login';navigate('login')">العودة لتسجيل الدخول</button>
        </div>`;
    } catch(_) {}
  }
  try { injectNotifBell(); } catch (e) { console.warn('injectNotifBell:', e); }
  return result;
};

function injectNotifBell() {
  const u = State.currentUser;
  const navbar = document.querySelector('.nav-user, .navbar-actions, .nav-actions, .navbar-right');
  if (!u || !navbar) return;
  if (document.getElementById('notif-bell-wrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'notif-bell-wrap';
  wrap.className = 'notif-wrap';
  wrap.innerHTML = `
    <button class="notif-bell" onclick="toggleNotifPanel(event)" title="${t('notifications')}">
      🔔<span class="notif-badge"></span>
    </button>
    <div id="notif-panel" class="notif-panel"></div>`;
  navbar.insertBefore(wrap, navbar.firstChild);
  refreshNotifBell();
}

// ─── DRILL-DOWN STATS — override renderAdminDash ──────
function renderAdminDash() {
  const users = AppData.users || [];
  const orders = AppData.orders || [];
  const transactions = AppData.transactions || [];
  const rechargeReqs = AppData.rechargeReqs || [];

  const stats = {
    users: users.filter(u => u.role !== 'admin'),
    vendors: users.filter(u => u.role === 'vendor'),
    customers: users.filter(u => u.role === 'customer'),
    staff: users.filter(u => u.role === 'staff'),
    drivers: users.filter(u => u.role === 'driver'),
    orders: orders,
    pendingOrders: orders.filter(o => o.status === 'pending'),
    completedOrders: orders.filter(o => o.status === 'completed'),
    cancelledOrders: orders.filter(o => o.status === 'cancelled'),
    services: AppData.services || [],
    cats: AppData.cats || [],
    revenueDebit: transactions.filter(t => t.type === 'debit'),
    pendingRecharges: rechargeReqs.filter(r => r.status === 'pending'),
  };
  const totalRevenue = stats.revenueDebit.reduce((a, t) => a + (Number(t.amount) || 0), 0);


  const card = (title, num, key, color) => `
    <button class="stat-card stat-clickable" onclick="drillStat('${key}')" style="${color ? 'border-color:' + color : ''}">
      <div class="stat-num">${num}</div>
      <div class="stat-label">${title}</div>
      <span class="stat-arrow">←</span>
    </button>`;

  return `
    <h2>لوحة الإحصائيات</h2>
    <p style="color:var(--text-muted);margin-bottom:16px">انقر على أي بطاقة لرؤية التفاصيل</p>
    <div class="stats-grid">
      ${card('المستخدمون', stats.users.length, 'users', '#7c3aed')}
      ${card('أصحاب الخدمات', stats.vendors.length, 'vendors', '#06b6d4')}
      ${card('العملاء', stats.customers.length, 'customers', '#10b981')}
      ${card('الموظفون', stats.staff.length, 'staff', '#f59e0b')}
      ${card('المندوبون', stats.drivers.length, 'drivers', '#ec4899')}
      ${card('إجمالي الطلبات', stats.orders.length, 'orders', '#7c3aed')}
      ${card('قيد الانتظار', stats.pendingOrders.length, 'pendingOrders', '#f59e0b')}
      ${card('الطلبات المكتملة', stats.completedOrders.length, 'completedOrders', '#10b981')}
      ${card('الطلبات الملغاة', stats.cancelledOrders.length, 'cancelledOrders', '#ef4444')}
      ${card('الخدمات', stats.services.length, 'services', '#06b6d4')}
      ${card('التصنيفات', stats.cats.length, 'cats', '#06b6d4')}
      ${card('إجمالي الإيرادات', totalRevenue.toLocaleString('ar') + ' ر', 'revenue', '#10b981')}
      ${card('طلبات شحن معلقة', stats.pendingRecharges.length, 'pendingRecharges', '#f59e0b')}
    </div>
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:24px;margin-top:24px">
      <h3 style="margin-bottom:12px">سريعة الوصول</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('cats')">إضافة تصنيف</button>
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('services')">إضافة خدمة</button>
        <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">إضافة مستخدم</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('orders')">إدارة الطلبات</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('wallet')">إدارة المحافظ</button>
      </div>
    </div>`;
}

function drillStat(key) {
  const renderers = {
    users:    () => drillUsersList(AppData.users.filter(u => u.role !== 'admin'), 'كل المستخدمين'),
    vendors:  () => drillUsersList(AppData.users.filter(u => u.role === 'vendor'), 'أصحاب الخدمات'),
    customers:() => drillUsersList(AppData.users.filter(u => u.role === 'customer'), 'العملاء'),
    staff:    () => drillUsersList(AppData.users.filter(u => u.role === 'staff'), 'الموظفون'),
    drivers:  () => drillUsersList(AppData.users.filter(u => u.role === 'driver'), 'المندوبون'),
    orders:   () => drillOrdersList(AppData.orders, 'كل الطلبات'),
    pendingOrders:   () => drillOrdersList(AppData.orders.filter(o => o.status === 'pending'), 'الطلبات قيد الانتظار'),
    completedOrders: () => drillOrdersList(AppData.orders.filter(o => o.status === 'completed'), 'الطلبات المكتملة'),
    cancelledOrders: () => drillOrdersList(AppData.orders.filter(o => o.status === 'cancelled'), 'الطلبات الملغاة'),
    services: () => drillServicesList(AppData.services, 'كل الخدمات'),
    cats:     () => drillCatsList(AppData.cats, 'كل التصنيفات'),
    revenue:  () => drillRevenue(),
    pendingRecharges: () => drillRechargesList(AppData.rechargeReqs.filter(r => r.status === 'pending')),
  };
  (renderers[key] || (() => toast('لا توجد تفاصيل', 'info')))();
}

function drillUsersList(users, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${users.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>الدور</th><th>البريد</th><th>الجوال</th><th>تاريخ التسجيل</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td style="font-weight:600">${escHtml(u.name || '—')}</td>
            <td><span class="badge badge-teal">${u.role}</span></td>
            <td style="font-size:13px;color:var(--text-secondary)">${escHtml(u.email || '—')}</td>
            <td>${escHtml(u.phone || '—')}</td>
            <td style="color:var(--text-muted)">${typeof fmtDate === 'function' ? fmtDate(u.createdAt) : ''}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillOrdersList(orders, title) {
  const sLabel = { pending:'بانتظار', accepted:'مقبول', with_driver:'مع المندوب', delivered:'موصّل', completed:'مكتمل', cancelled:'ملغي' };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${orders.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>رقم</th><th>الخدمة</th><th>العميل</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th></tr></thead>
        <tbody>
          ${orders.map(o => `<tr>
            <td style="font-family:monospace;font-size:12px">${escHtml(o.orderId || o.id)}</td>
            <td>${o.svcIcon || ''} ${escHtml(o.svcName || '—')}</td>
            <td>${escHtml(o.customerName || '—')}</td>
            <td style="font-weight:700">${o.total || 0} ر</td>
            <td>${escHtml(o.date || '—')}</td>
            <td><span class="badge">${sLabel[o.status] || o.status}</span></td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillServicesList(services, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${services.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>التصنيف</th><th>السعر</th><th>المنطقة</th></tr></thead>
        <tbody>
          ${services.map(s => {
            const cat = AppData.cats.find(c => c.id === s.catId);
            const reg = AppData.regions?.find(r => r.id === s.regionId);
            return `<tr>
              <td style="font-weight:600">${escHtml(s.name)}</td>
              <td>${cat?.icon || ''} ${escHtml(cat?.name || '—')}</td>
              <td>${s.price ? s.price + ' ر' : '—'}</td>
              <td>${escHtml(reg?.name || '—')}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillCatsList(cats, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${cats.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>القسم</th><th>عدد الخدمات</th></tr></thead>
        <tbody>
          ${cats.map(c => `<tr>
            <td style="font-weight:600">${c.icon || ''} ${escHtml(c.name)}</td>
            <td>${escHtml(c.section || '—')}</td>
            <td>${AppData.services.filter(s => s.catId === c.id).length}</td>
          </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillRevenue() {
  const txns = AppData.transactions.filter(t => t.type === 'debit')
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const total = txns.reduce((a, t) => a + (t.amount || 0), 0);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">💰 تفاصيل الإيرادات (${total.toLocaleString('ar')} ر)</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الوصف</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${txns.map(t => {
            const u = AppData.users.find(x => x.id === t.uid || x.uid === t.uid);
            return `<tr>
              <td>${escHtml(u?.name || t.uid)}</td>
              <td style="font-weight:700;color:#10b981">${t.amount} ر</td>
              <td style="color:var(--text-secondary)">${escHtml(t.note || '—')}</td>
              <td style="color:var(--text-muted)">${typeof fmtDate === 'function' ? fmtDate(t.createdAt) : ''}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillRechargesList(reqs) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⏳ طلبات شحن معلقة (${reqs.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${reqs.map(r => `<tr>
            <td>${escHtml(r.userName || '—')}</td>
            <td style="font-weight:700">${r.amount} ر</td>
            <td>${r.proofBase64 ? `<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.proofBase64}')">📸</button>` : '—'}</td>
            <td>
              <button class="btn btn-sm btn-success" onclick="approveRecharge('${r.id}','${r.userId}','${r.amount}');closeModal()">✅</button>
              <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${r.id}');closeModal()">❌</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

// ─── ADMIN: Original Tab Logic (Legacy - Overridden by Phase 26) ─
const __ph3_originalRenderAdmin = typeof renderAdmin === 'function' ? renderAdmin : null;
function __legacy_renderAdmin() {
  try {
    const u = State.currentUser;
    if (!u || !['admin','cs','staff'].includes(u.role)) { navigate('home'); return ''; }
    const isAdmin = u.role === 'admin';

    // Ensure AppData is ready
    const orders = AppData.orders || [];
    const services = AppData.services || [];
    const users = AppData.users || [];

    const pendingSvcsCount = services.filter(s=>s.status==='pending_approval').length;
    const pendingOrdersCount = orders.filter(o=>o.status==='pending_admin' || o.status==='pending').length;
    const pendingUsersCount = users.filter(u=>u.status==='pending').length;

    const allTabs = [
      { k:'dashboard',    ic:'📊', l:t('admin_tab_dashboard') || 'الإحصائيات', perm:null },
      { k:'reports',      ic:'📈', l:t('admin_tab_reports') || 'التقارير', perm:'view_reports' },
      { k:'advance_stats',ic:'📊', l:'التحليلات المتقدمة', perm:null, adminOnly:true },
      { k:'advanced',     ic:'📈', l:'الإحصائيات المتقدمة', perm:null, adminOnly:true },
      { k:'users',        ic:'👥', l:t('admin_tab_users') || 'المستخدمين', perm:'view_users', adminOnly:false },
      { k:'users',        ic:'⌛', l:`حسابات معلقة${pendingUsersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingUsersCount}</span>`:''}`, perm:null, adminOnly:true },
      { k:'permissions',  ic:'🛡️', l:t('admin_tab_permissions') || 'الصلاحيات', perm:null, adminOnly:true },
      { k:'staff_performance', ic:'📊', l:'أداء الموظفين', perm:null, adminOnly:true },
      { k:'orders',       ic:'📋', l:`إدارة الطلبات${pendingOrdersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingOrdersCount}</span>`:''}`, perm:'view_orders' },
      { k:'live_tracking',ic:'📍', l:'التتبع المباشر', perm:null, adminOnly:true },
      { k:'ads',          ic:'🏷️', l:'الكوبونات والعروض', perm:null, adminOnly:true },
      { k:'sys_bookings', ic:'📅', l:'نظام الحجوزات', perm:null, adminOnly:true },
      { k:'sys_professions', ic:'🛠️', l:'نظام المهن', perm:null, adminOnly:true },
      { k:'sys_stores',   ic:'🏪', l:'نظام المتاجر', perm:null, adminOnly:true },
      { k:'sys_digital',  ic:'🛒', l:'المتاجر الرقمية', perm:null, adminOnly:true },
      { k:'sys_services', ic:'🛎️', l:'خدمات أخرى', perm:null, adminOnly:true },
      { k:'sys_offers',   ic:'🏷️', l:'العروض والخصومات', perm:null, adminOnly:true },
      { k:'provider_svcs',ic:'💼', l:`خدمات المزودين${pendingSvcsCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingSvcsCount}</span>`:''}`, perm:null, adminOnly:true },
      { k:'wallet',       ic:'💰', l:'المحافظ الإلكترونية', perm:'view_wallets' },
      { k:'wallet',       ic:'📥', l:'طلبات الإيداع', perm:'view_wallets' },
      { k:'banks',        ic:'🏦', l:'الحسابات البنكية', perm:null, adminOnly:true },
      { k:'banks',        ic:'💳', l:'طرق الدفع', perm:null, adminOnly:true },
      { k:'ads',          ic:'📢', l:'الإعلانات', perm:null, adminOnly:true },
      { k:'cms_banners',  ic:'✉️', l:'إدارة الرسائل', perm:null, adminOnly:true },
      { k:'signup_settings', ic:'📝', l:'حقول التسجيل', perm:null, adminOnly:true },
      { k:'login_settings',ic:'🔑', l:'إعدادات الدخول', perm:null, adminOnly:true },
      { k:'ph17settings', ic:'⚙️', l:'الإعدادات العامة', perm:null, adminOnly:true },
      { k:'regions',      ic:'📍', l:'المناطق والمدن', perm:null, adminOnly:true },
      { k:'cms_texts',    ic:'🔤', l:'النصوص والأيقونات', perm:null, adminOnly:true },
      { k:'cms_pages',    ic:'📄', l:'الصفحات الثابتة', perm:null, adminOnly:true },
      { k:'delivery_pricing', ic:'🚚', l:'أسعار التوصيل', perm:null, adminOnly:true },
      { k:'direct_routing',   ic:'🚦', l:'التوجيه المباشر', perm:null, adminOnly:true },
    ];

    const tabs = allTabs.filter(t => {
      if (isAdmin) return true;
      if (t.adminOnly) return false;
      if (!t.perm) return true;
      if (typeof userHasPerm === 'function') return userHasPerm(u, t.perm);
      return false;
    });

    let adminTab = State.adminTab || 'dashboard';
    if (!tabs.some(t => t.k === adminTab)) adminTab = tabs[0]?.k || 'dashboard';

    let content = '';
    const fallback = (fnName) => `<div style="padding:40px;text-align:center;color:var(--text-muted)">دالة ${fnName} غير متوفرة حالياً</div>`;

    if (adminTab==='dashboard')        content = typeof renderAdminDash === 'function' ? renderAdminDash() : fallback('renderAdminDash');
    else if (adminTab==='users')       content = typeof renderAdminUsers === 'function' ? renderAdminUsers() : fallback('renderAdminUsers');
    else if (adminTab==='permissions') content = typeof renderAdminPermissions === 'function' ? renderAdminPermissions() : fallback('renderAdminPermissions');
    else if (adminTab==='staff_performance') content = typeof renderStaffPerformance === 'function' ? renderStaffPerformance() : fallback('renderStaffPerformance');
    else if (adminTab==='cats')        content = typeof renderAdminCats === 'function' ? renderAdminCats() : fallback('renderAdminCats');
    else if (adminTab==='services')    content = typeof renderAdminServices === 'function' ? renderAdminServices() : fallback('renderAdminServices');
    else if (adminTab==='sys_bookings')   content = typeof renderAdminSystem === 'function' ? renderAdminSystem('bookings') : fallback('renderAdminSystem');
    else if (adminTab==='sys_professions') content = typeof renderAdminSystem === 'function' ? renderAdminSystem('professions') : fallback('renderAdminSystem');
    else if (adminTab==='sys_stores')     content = typeof ph43_renderAdminStores === 'function' ? ph43_renderAdminStores() : (typeof renderAdminSystem === 'function' ? renderAdminSystem('stores') : fallback('renderAdminSystem'));
    else if (adminTab==='sys_digital')    content = typeof ph45_renderAdminDigitalStores === 'function' ? ph45_renderAdminDigitalStores() : fallback('ph45_renderAdminDigitalStores');
    else if (adminTab==='sys_services')   content = typeof renderAdminSystem === 'function' ? renderAdminSystem('services') : fallback('renderAdminSystem');
    else if (adminTab==='sys_offers')     content = typeof renderAdminOffers === 'function' ? renderAdminOffers() : fallback('renderAdminOffers');
    else if (adminTab==='provider_svcs') content = typeof renderAdminPendingSvcs === 'function' ? renderAdminPendingSvcs() : fallback('renderAdminPendingSvcs');
    else if (adminTab==='regions')     content = typeof renderAdminRegions === 'function' ? renderAdminRegions() : fallback('renderAdminRegions');
    else if (adminTab==='banks')       content = typeof renderAdminBanks === 'function' ? renderAdminBanks() : fallback('renderAdminBanks');
    else if (adminTab==='orders')      content = typeof renderAdminOrders === 'function' ? renderAdminOrders() : fallback('renderAdminOrders');
    else if (adminTab==='ads')         content = typeof renderAdminAds === 'function' ? renderAdminAds() : fallback('renderAdminAds');
    else if (adminTab==='wallet')      content = typeof renderAdminWallet === 'function' ? renderAdminWallet() : fallback('renderAdminWallet');
    else if (adminTab==='reports')     content = typeof renderAdminReports === 'function' ? renderAdminReports() : fallback('renderAdminReports');
    else if (adminTab==='delivery_pricing') content = typeof renderAdminDeliveryPricing === 'function' ? renderAdminDeliveryPricing() : fallback('renderAdminDeliveryPricing');
    else if (adminTab==='direct_routing') content = typeof renderAdminDirectRouting === 'function' ? renderAdminDirectRouting() : fallback('renderAdminDirectRouting');
    else if (adminTab.startsWith('rental_stores_')) content = typeof _renderRentalStoresTab === 'function' ? _renderRentalStoresTab(adminTab.replace('rental_stores_','')) : fallback('_renderRentalStoresTab');
    else                               content = typeof renderAdminDash === 'function' ? renderAdminDash() : 'Dashboard Error';

    const roleBanner = !isAdmin ? `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(124,58,237,.08));border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--text-secondary)">
        أنت مسجّل كـ <strong>${u.role==='cs'?'خدمة عملاء':'موظف'}</strong> — تُعرض فقط التبويبات والإجراءات المسموح بها لك.
      </div>` : '';

    return `
    <div id="app-content">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;padding:0 8px">${(typeof t==='function' && t('language')==='Language')?'MENU':'القائمة'}</div>
          ${tabs.map(t=>`
            <button class="admin-nav-item${adminTab===t.k?' active':''}" onclick="setAdminTab('${t.k}')">
              <span style="margin-inline-end:8px">${t.ic}</span><span>${t.l}</span>
            </button>`).join('')}
        </aside>
        <main class="admin-main">
          ${typeof renderBanners === 'function' ? renderBanners('admin') : ''}
          ${roleBanner}
          ${content}
        </main>
      </div>
    </div>`;
  } catch (err) {
    console.error("Critical Admin Render Error:", err);
    return `<div style="padding:60px;text-align:center">
      <h2 style="color:var(--danger)">حدث خطأ في عرض لوحة التحكم</h2>
      <p style="color:var(--text-secondary);margin:16px 0">${err.message}</p>
      <button class="btn btn-primary" onclick="location.reload()">تحديث الصفحة</button>
    </div>`;
  }
}
// window.renderAdmin = __legacy_renderAdmin;


// ─── Dedicated Permissions tab ────────────────────────
const ALL_PERMS = ['view_orders','edit_orders','create_users','chat_customers','view_wallets','adjust_wallets','view_reports'];

function renderAdminPermissions() {
  // Show ALL users, not just staff/admin — admin can grant perms to anyone.
  const users = (AppData.users || []).slice();
  const roleLabel = { admin:'مدير', staff:'موظف', vendor:'صاحب خدمة', driver:'مندوب', customer:'عميل', guest:'زائر', cs:'موظف' };
  const roleBadge = { admin:'badge-rose', staff:'badge-purple', vendor:'badge-teal', driver:'badge-gold', customer:'badge-teal', guest:'badge-teal', cs:'badge-purple' };

  // Use the FULL permissions list (16) — base 7 + extras 9 from phase 17.
  const ALL = (typeof ph17_allPerms === 'function')
    ? ph17_allPerms()
    : ALL_PERMS.slice();
  const PLABEL = (typeof PH17_PERM_LABELS !== 'undefined' && PH17_PERM_LABELS) || {};
  const labelOf = (k) => PLABEL[k] || (typeof t === 'function' ? t('perm_'+k) : k);

  // Optional role filter (default = all)
  const roleFilter = (window.__permRoleFilter || 'all');
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredByRole = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
  const filtered = filteredByRole.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery) ||
    (u.email || '').toLowerCase().includes(searchQuery) ||
    (u.role || '').toLowerCase().includes(searchQuery)
  );

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <h2>الصلاحيات — كل المستخدمين</h2>
        <input type="text" class="form-control" id="admin-permissions-search" placeholder="ابحث بالاسم أو البريد أو الدور..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
      </div>
      <button class="btn btn-primary" onclick="ph17_openCreateUser ? ph17_openCreateUser() : showAddUserModal()">إضافة مستخدم</button>
    </div>
    <p style="color:var(--text-muted);margin-bottom:14px">يمكنك منح أيّ صلاحية لأيّ مستخدم بغضّ النظر عن دوره. المدير يملك كل الصلاحيات تلقائياً.</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${['all','admin','staff','vendor','driver','customer'].map(r => `
        <button class="btn btn-sm ${roleFilter===r?'btn-primary':'btn-secondary'}"
          onclick="window.__permRoleFilter='${r}'; render();">
          ${r==='all'?'الكل':roleLabel[r]||r}
        </button>`).join('')}
    </div>

    <div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.2);border-radius:12px;padding:16px;margin-bottom:20px">
      <h3 style="margin-bottom:12px;font-size:15px">الصلاحيات المتاحة (${ALL.length})</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        ${ALL.map(p => `
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
            <span style="color:var(--accent-purple)">●</span> ${labelOf(p)}
          </div>`).join('')}
      </div>
    </div>

    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الدور</th>
            <th>البريد</th>
            <th>عدد الصلاحيات الفعّالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length ? filtered.map(u => {
            const perms = u.role === 'admin'
              ? Object.fromEntries(ALL.map(p=>[p,true]))
              : (u.permissions || (typeof DEFAULT_PERMS!=='undefined' ? (DEFAULT_PERMS[u.role]||{}) : {}));
            const active = ALL.filter(p => perms[p]).length;
            return `<tr>
              <td style="font-weight:600">${escHtml(u.name||'—')}</td>
              <td><span class="badge ${roleBadge[u.role]||'badge-purple'}">${roleLabel[u.role]||u.role||'—'}</span></td>
              <td style="font-size:13px;color:var(--text-secondary);direction:ltr;text-align:left">${escHtml(u.email||'—')}</td>
              <td><strong style="color:var(--accent-purple)">${active}</strong> / ${ALL.length}</td>
              <td>
                ${u.role === 'admin'
                  ? '<span style="color:var(--text-muted);font-size:12px">— كل الصلاحيات —</span>'
                  : `<button class="btn btn-sm btn-primary" onclick="showPermsModal('${u.id}')">تعديل الصلاحيات</button>`}
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">
            لا يوجد مستخدمون بهذا التصنيف.
          </td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ───────────────────────────────────────────────────────
//  ADMIN — Login settings
// ───────────────────────────────────────────────────────
function renderAdminLoginSettings() {
  const s = (AppData.appSettings) || {};
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>إعدادات تسجيل الدخول</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <button class="btn btn-primary" onclick="saveAdminLoginSettings()">حفظ الإعدادات</button>
      </div>
    </div>
    <div style="max-width:760px">
      <div class="form-group"><label class="form-label">تفعيل تسجيل الدخول بالبريد/كلمة المرور</label>
        <input type="checkbox" id="login-email-enabled" style="margin-left:8px" ${s.loginEmailEnabled? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">تفعيل تسجيل الدخول بالجوال (بدون @)</label>
        <input type="checkbox" id="login-phone-enabled" style="margin-left:8px" ${s.loginPhoneEnabled? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">تفعيل دخول العرض السريع (Quick demo)</label>
        <input type="checkbox" id="login-quick-demo" style="margin-left:8px" ${s.loginQuickDemo? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">إجبار المصادقة الثنائية عند الدخول (2FA)</label>
        <input type="checkbox" id="login-2fa-enabled" style="margin-left:8px" ${s.login2faEnabled? 'checked':''}>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-top:12px">ملاحظة: بعض التغييرات قد تتطلب إعادة تحميل إعدادات الخادم أو إعادة تشغيل جلسات المستخدمين لتظهر فوراً.</p>
    </div>`;
}

async function saveAdminLoginSettings() {
  const patch = {
    loginEmailEnabled: !!document.getElementById('login-email-enabled')?.checked,
    loginPhoneEnabled: !!document.getElementById('login-phone-enabled')?.checked,
    loginQuickDemo: !!document.getElementById('login-quick-demo')?.checked,
    login2faEnabled: !!document.getElementById('login-2fa-enabled')?.checked,
  };
  if (typeof ph17_saveSettings === 'function') {
    await ph17_saveSettings(patch);
    toast('✅ تم حفظ إعدادات تسجيل الدخول','success');
    await render();
  } else {
    toast('تعذّر الحفظ — وظيفة ph17 غير متاحة','error');
  }
}

// Ensure phase3 implementations override any earlier globals
try {
  if (typeof renderAdminUsers === 'function') window.renderAdminUsers = renderAdminUsers;
  if (typeof renderAdminOrders === 'function') window.renderAdminOrders = renderAdminOrders;
  if (typeof renderAdminWallet === 'function') window.renderAdminWallet = renderAdminWallet;
  if (typeof renderAdminPermissions === 'function') window.renderAdminPermissions = renderAdminPermissions;
} catch (e) { /* ignore */ }

function showAddStaffModal() {
  showAddUserModal();
  // Pre-select staff role after modal opens
  setTimeout(() => {
    const sel = document.getElementById('nu-role');
    if (sel) sel.value = 'staff';
  }, 50);
}

/* Removed renderAdminUsers and renderAdminOrders overrides. Functionality integrated into dashboards.js */

// ─── Override renderAdminWallet to gate approve/reject by perms ─
const __ph3_originalRenderAdminWallet = typeof renderAdminWallet === 'function' ? renderAdminWallet : null;
function renderAdminWallet() {
  const me = State.currentUser;
  const isAdmin = me?.role === 'admin';
  const canAdjust = isAdmin || userHasPerm(me, 'adjust_wallets');
  const pending = AppData.rechargeReqs.filter(r => r.status === 'pending');
  const approved = AppData.rechargeReqs.filter(r => r.status === 'approved');
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredPending = pending.filter(r =>
    (r.userName || '').toLowerCase().includes(searchQuery) ||
    (r.amount || '').toString().toLowerCase().includes(searchQuery)
  );
  const filteredApproved = approved.filter(r =>
    (r.userName || '').toLowerCase().includes(searchQuery) ||
    (r.amount || '').toString().toLowerCase().includes(searchQuery)
  );
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <h2>إدارة المحافظ</h2>
      <input type="text" class="form-control" id="admin-wallet-search" placeholder="ابحث بالاسم أو المبلغ..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
    </div>
    ${!canAdjust ? '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">🔒 وضع العرض فقط — لا تملك صلاحية تعديل المحافظ</p>' : ''}
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:16px;margin-bottom:24px">
      <h3 style="margin-bottom:8px">⏳ طلبات الشحن المعلقة: ${filteredPending.length}</h3>
      ${filteredPending.length ? `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th>${canAdjust?'<th>الإجراءات</th>':''}</tr></thead>
          <tbody>
            ${filteredPending.map(r => `
              <tr>
                <td>${escHtml(r.userName||'—')}</td>
                <td style="font-weight:700">${r.amount} ريال</td>
                <td>${r.proofBase64 ? `<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.proofBase64}')">📸</button>` : '—'}</td>
                ${canAdjust ? `<td>
                  <button class="btn btn-sm btn-success" onclick="approveRecharge('${r.id}','${r.userId}','${r.amount}')">قبول</button>
                  <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${r.id}')">رفض</button>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p style="color:var(--text-muted)">لا توجد طلبات معلقة</p>'}
    </div>
    <h3>✅ الطلبات الموافق عليها: ${filteredApproved.length}</h3>
    ${filteredApproved.length ? `<div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${filteredApproved.map(r => `
            <tr>
              <td>${escHtml(r.userName||'—')}</td>
              <td>${r.amount} ريال</td>
              <td>${typeof fmtDate==='function'?fmtDate(r.createdAt):''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}`;
}

// ─── Override navbar to give CS/staff a link to the dashboard ─
// NOTE: must use assignment (not `function renderNavbar()`) so we can capture
// the ORIGINAL implementation from core.js. Function declarations hoist and
// would overwrite the global before we can grab the original — causing
// infinite recursion ("Maximum call stack size exceeded").
const __ph3_originalRenderNavbar = typeof window.renderNavbar === 'function' ? window.renderNavbar : null;
window.renderNavbar = function () {
  const u = State.currentUser;
  if (!u) return '';
  let html = __ph3_originalRenderNavbar ? __ph3_originalRenderNavbar() : '';
  // For CS, the original navbar shows nothing useful — inject a dashboard link
  // (re-injects into both the desktop nav-links pill bar AND the mobile drawer-nav)
  if (u.role === 'staff') {
    const active = State.currentPage === 'admin' ? ' active' : '';
    html = html.replace(
      /<div class="nav-links[^"]*">[\s\S]*?<\/div>/,
      `<div class="nav-links nav-links-desktop"><button class="nav-link${active}" onclick="navigate('admin')"><span>لوحة العمل</span></button></div>`
    );
    html = html.replace(
      /<nav class="drawer-nav">[\s\S]*?<\/nav>/,
      `<nav class="drawer-nav"><button class="drawer-link${active}" onclick="navigate('admin');closeDrawer()"><span>لوحة العمل</span></button></nav>`
    );
  }
  return html;
};

// Make CS users land on the admin route after login (defensive override)
const __ph3_originalNavigate = window.navigate;
window.navigate = async function(page, params) {
  try {
    const u = State.currentUser;
    if (u?.role === 'staff' && page === 'home') page = 'admin';
  } catch (e) {}
  return __ph3_originalNavigate.call(this, page, params);
};

// ─── Ultimate safety net: if app is still on the boot loader after 8s, force login.
// This guards against any future override accidentally swallowing the flow.
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (State.currentPage === 'loading' && !State.currentUser) {
      console.warn('[phase3] Boot loader exceeded 8s — forcing login page');
      try {
        State.currentPage = 'login';
        const app = document.getElementById('app');
        if (app && typeof renderLoginPage === 'function') {
          app.innerHTML = renderLoginPage();
          const nw = document.getElementById('navbar-wrap'); if (nw) nw.innerHTML = '';
          const fw = document.getElementById('footer-wrap'); if (fw) fw.innerHTML = '';
        }
      } catch (e) { console.error('Forced login failed:', e); }
    }
  }, 8000);
});

// ─── Add user modal (manual creation by admin) ─────────
function showAddUserModal() {
  const regions = AppData.regions || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${t('add_user_manual')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="nu-name" placeholder="الاسم الكامل"></div>
      <div class="form-group"><label class="form-label">الدور</label>
        <select class="form-control" id="nu-role">
          <option value="customer">عميل</option>
          <option value="vendor">صاحب خدمة</option>
          <option value="driver">مندوب</option>
          <option value="staff">موظف</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">البريد</label><input class="form-control" id="nu-email" type="email" placeholder="user@example.com"></div>
      <div class="form-group"><label class="form-label">كلمة مرور مؤقتة</label><input class="form-control" id="nu-password" type="text" placeholder="على الأقل 6 أحرف"></div>
      <div class="form-group"><label class="form-label">الجوال</label><input class="form-control" id="nu-phone" type="tel" placeholder="+9677..."></div>
      <div class="form-group"><label class="form-label">المنطقة</label>
        <select class="form-control" id="nu-region">
          <option value="">— اختياري —</option>
          ${regions.filter(r => r.active !== false).map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">رصيد ابتدائي (ريال)</label><input class="form-control" id="nu-balance" type="number" min="0" value="0"></div>
    <div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:8px;padding:12px;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      💡 سيتم إنشاء حساب بالبريد وكلمة المرور. أبلِغ المستخدم بهما.
    </div>
    <button class="btn btn-primary btn-block" onclick="submitAddUser()">إنشاء الحساب</button>`);
}

async function submitAddUser() {
  const name = document.getElementById('nu-name').value.trim();
  const role = document.getElementById('nu-role').value;
  const email = document.getElementById('nu-email').value.trim().toLowerCase();
  const password = document.getElementById('nu-password').value;
  const phone = document.getElementById('nu-phone').value.trim();
  const regionId = document.getElementById('nu-region').value || null;
  const balance = parseFloat(document.getElementById('nu-balance').value) || 0;

  if (!name || !email || !password || password.length < 6) {
    toast('املأ الاسم والبريد وكلمة مرور (6 أحرف على الأقل)', 'error'); return;
  }

  // Use secondary auth instance so we don't log out the admin
  const sa = getSecondaryAuth();
  if (!sa) { toast('تعذّر إنشاء الحساب', 'error'); return; }

  try {
    const cred = await sa.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await db.collection('users').doc(uid).set({
      name, email, phone, role, regionId,
      permissions: DEFAULT_PERMS[role] || {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: State.currentUser.uid,
    });
    if (balance > 0) await creditWallet(uid, balance, 'رصيد افتتاحي - من المدير');
    await sa.signOut().catch(() => {});
    closeModal();
    toast(`تم إنشاء حساب ${name} ✅`, 'success');
    await render();
  } catch (e) {
    console.error('Create user failed:', e);
    const msg = {
      'auth/email-already-in-use': 'البريد مستخدم بالفعل',
      'auth/invalid-email': 'بريد غير صالح',
      'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
      'auth/operation-not-allowed': 'فعّل تسجيل الدخول بالبريد/كلمة المرور في Firebase أولاً',
    }[e.code] || e.message;
    toast(msg, 'error');
  }
}

// ─── Permissions modal ────────────────────────────────
function showPermsModal(userId) {
  const u = AppData.users.find(x => x.id === userId);
  if (!u) return;
  const perms = u.permissions || DEFAULT_PERMS[u.role] || {};
  const allPerms = ['view_orders', 'edit_orders', 'create_users', 'chat_customers', 'view_wallets', 'adjust_wallets', 'view_reports'];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🔑 ${t('permissions')} — ${escHtml(u.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="perms-grid">
      ${allPerms.map(p => `
        <label class="perm-row">
          <input type="checkbox" id="perm-${p}" ${perms[p] ? 'checked' : ''}>
          <span>${t('perm_' + p)}</span>
        </label>`).join('')}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="savePerms('${userId}')">حفظ الصلاحيات</button>`);
}

async function savePerms(userId) {
  const allPerms = ['view_orders', 'edit_orders', 'create_users', 'chat_customers', 'view_wallets', 'adjust_wallets', 'view_reports'];
  const perms = {};
  allPerms.forEach(p => { perms[p] = document.getElementById('perm-' + p).checked; });
  await fsUpdate('users', userId, { permissions: perms });
  closeModal(); toast('تم حفظ الصلاحيات ✅', 'success'); await render();
}

// ─── Adjust wallet modal ──────────────────────────────
function showAdjustWalletModal(userId) {
  const u = AppData.users.find(x => x.id === userId);
  if (!u) return;
  const w = AppData.wallets ? (AppData.wallets[u.id || u.uid]?.balance || 0) : 0;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⚖️ تعديل رصيد ${escHtml(u.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:var(--gradient-card);padding:16px;border-radius:8px;margin-bottom:16px;text-align:center">
      <div style="color:var(--text-muted);font-size:13px">الرصيد الحالي</div>
      <div style="font-size:28px;font-weight:800;background:var(--gradient-main);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${w.toLocaleString('ar')} ر</div>
    </div>
    <div class="form-group"><label class="form-label">العملية</label>
      <select class="form-control" id="aw-type">
        <option value="credit">➕ إضافة إلى الرصيد</option>
        <option value="debit">➖ خصم من الرصيد</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">المبلغ (ريال)</label><input class="form-control" id="aw-amount" type="number" min="1" placeholder="100"></div>
    <div class="form-group"><label class="form-label">${t('reason')}</label><input class="form-control" id="aw-reason" placeholder="مثال: تعويض عن طلب ملغى"></div>
    <button class="btn btn-primary btn-block" onclick="submitAdjustWallet('${userId}')">تنفيذ</button>`);
}

async function submitAdjustWallet(userId) {
  const type = document.getElementById('aw-type').value;
  const amount = parseFloat(document.getElementById('aw-amount').value);
  const reason = document.getElementById('aw-reason').value.trim() || 'تعديل إداري';
  if (!amount || amount <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }
  try {
    if (type === 'credit') {
      await creditWallet(userId, amount, `${reason} (إضافة إدارية)`);
    } else {
      const ok = await deductWallet(userId, amount, `${reason} (خصم إداري)`);
      if (!ok) { toast('رصيد غير كافٍ', 'error'); return; }
    }
    await pushNotification({
      uid: userId,
      title: type === 'credit' ? '💰 تم إضافة رصيد لمحفظتك' : '💸 تم خصم مبلغ من محفظتك',
      body: `${amount} ريال — ${reason}`,
      type: type === 'credit' ? 'success' : 'warning',
      link: 'wallet',
    });
    closeModal(); toast('✅ تم', 'success'); await render();
  } catch (e) {
    toast(e.message || 'فشل التنفيذ', 'error');
  }
}

// ─── Send invoice via WhatsApp / Email ────────────────
function buildInvoiceText(o) {
  const sLabel = { pending:'بانتظار', accepted:'مقبول', with_driver:'مع المندوب', delivered:'موصّل', completed:'مكتمل', cancelled:'ملغي' };
  return [
    `🧾 *فاتورة محجوز*`,
    ``,
    `رقم العملية: ${o.orderId}`,
    `الخدمة: ${o.svcName}`,
    `مقدم الخدمة: ${o.vendorName || '—'}`,
    `التاريخ: ${o.date || '—'}`,
    o.time ? `الوقت: ${o.time}` : null,
    o.customerAddr ? `العنوان: ${o.customerAddr}` : null,
    ``,
    `سعر الخدمة: ${o.servicePrice || 0} ريال`,
    `رسوم التوصيل: ${o.deliveryFee || 0} ريال`,
    `*الإجمالي: ${o.total || 0} ريال*`,
    ``,
    `الحالة: ${sLabel[o.status] || o.status}`,
    ``,
    `شكراً لاستخدامك محجوز 🌟`,
  ].filter(Boolean).join('\n');
}

function shareInvoiceWA(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  const txt = encodeURIComponent(buildInvoiceText(o));
  const cust = AppData.users.find(u => u.id === o.customerId || u.uid === o.customerId);
  const phone = (cust?.phone || '').replace(/\D/g, '');
  const url = phone ? `https://wa.me/${phone}?text=${txt}` : `https://wa.me/?text=${txt}`;
  window.open(url, '_blank');
}

function shareInvoiceEmail(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  const cust = AppData.users.find(u => u.id === o.customerId || u.uid === o.customerId);
  const subject = encodeURIComponent(`فاتورة محجوز — ${o.orderId}`);
  const body = encodeURIComponent(buildInvoiceText(o));
  const to = cust?.email ? encodeURIComponent(cust.email) : '';
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

// Override showInvoice to add the share buttons
const __originalShowInvoice = typeof showInvoice === 'function' ? showInvoice : null;
function showInvoice(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  const sLabel = { pending:'⏳ بانتظار القبول', accepted:'✅ تم القبول', with_driver:'🚗 مع المندوب', delivered:'📦 تم التوصيل', completed:'🎉 مكتمل', cancelled:'❌ ملغي' };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🧾 فاتورة الطلب</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="invoice">
      <div class="invoice-row"><span>رقم العملية</span><strong>${o.orderId}</strong></div>
      <div class="invoice-row"><span>الخدمة</span><span>${o.svcIcon || ''} ${escHtml(o.svcName || '')}</span></div>
      ${o.tierName ? `<div class="invoice-row"><span>الفئة المختارة</span><span style="font-weight:700;color:var(--primary)">🏷️ ${escHtml(o.tierName)}</span></div>` : ''}
      <div class="invoice-row"><span>مقدم الخدمة</span><span>${escHtml(o.vendorName || '—')}</span></div>
      <div class="invoice-row"><span>التاريخ</span><span>${escHtml(o.date || '—')}</span></div>
      <div class="invoice-row"><span>سعر الخدمة</span><span>${o.servicePrice || 0} ريال</span></div>
      <div class="invoice-row"><span>رسوم التوصيل</span><span>${o.deliveryFee || 0} ريال</span></div>
      <div class="invoice-row total"><span>الإجمالي</span><strong>${o.total || 0} ريال</strong></div>
      <div class="invoice-row"><span>الحالة</span><span>${sLabel[o.status] || o.status}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-sm" style="background:#25d366;color:#fff;flex:1" onclick="shareInvoiceWA('${orderId}')">${t('send_via_whatsapp')}</button>
      <button class="btn btn-secondary btn-sm" style="flex:1" onclick="shareInvoiceEmail('${orderId}')">${t('send_via_email')}</button>
    </div>
    <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="closeModal()">إغلاق</button>`);
}

// ─── Hook into order lifecycle to push notifications ──
async function notifyOrderStatusChange(o, newStatus) {
  const labels = {
    accepted:'✅ تم قبول طلبك', with_driver:'🚗 طلبك في الطريق إليك',
    delivered:'📦 تم التوصيل', completed:'🎉 اكتمل الطلب', cancelled:'❌ تم إلغاء الطلب',
  };
  if (!labels[newStatus] || !o.customerId) return;
  await pushNotification({
    uid: o.customerId,
    title: labels[newStatus],
    body: `الطلب ${o.orderId} - ${o.svcName}`,
    type: newStatus === 'cancelled' ? 'warning' : 'success',
    link: 'myorders',
  });
}
window.notifyOrderStatusChange = notifyOrderStatusChange;

// ══════════════════════════════════════════════════════════════════
//  أسعار التوصيل — واجهة لوحة المدير
// ══════════════════════════════════════════════════════════════════

// حالة الواجهة: null = قائمة المناطق، string = داخل منطقة
window.__dp_selectedZone    = window.__dp_selectedZone    || null;
window.__dp_selectedVehicle = window.__dp_selectedVehicle || null; // 'motorcycle' | 'car'
window.__dp_selectedSubzone = window.__dp_selectedSubzone || null;
window.__dp_searchQuery     = window.__dp_searchQuery     || '';

window.renderAdminDeliveryPricing = function() {
  const zones      = AppData.deliveryZones  || [];
  const routes     = AppData.deliveryRoutes || [];
  const selZone    = window.__dp_selectedZone;
  const selVehicle = window.__dp_selectedVehicle;

  // ─── عرض قائمة المناطق ─────────────────────────────────────
  if (!selZone) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="margin:0">🚚 أسعار التوصيل</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0">حدد أسعار التوصيل بين المناطق لكل مسار (من → إلى)</p>
        </div>
        <button class="btn btn-primary" onclick="dp_openAddZoneModal()">+ إضافة منطقة رئيسية</button>
      </div>

      ${zones.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;background:rgba(124,58,237,.05);border:2px dashed rgba(124,58,237,.2);border-radius:16px">
          <div style="font-size:48px;margin-bottom:12px">🗺️</div>
          <h3 style="color:var(--text-secondary)">لا توجد مناطق رئيسية بعد</h3>
          <p style="color:var(--text-muted)">ابدأ بإضافة منطقة رئيسية مثل "المكلا" أو "سيئون"</p>
          <button class="btn btn-primary" onclick="dp_openAddZoneModal()">+ إضافة أول منطقة</button>
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
          ${zones.map(z => {
            const zRoutes = routes.filter(r => r.zoneId === z.id);
            return `
            <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:14px;padding:20px;transition:all .2s;cursor:pointer"
                 onmouseenter="this.style.borderColor='var(--accent-purple)';this.style.transform='translateY(-2px)'"
                 onmouseleave="this.style.borderColor='var(--border)';this.style.transform=''"
                 onclick="window.__dp_selectedZone='${z.id}';window.__dp_selectedVehicle=null;window.__dp_selectedSubzone=null;render()">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                <div>
                  <div style="font-size:18px;font-weight:700">📍 ${escHtml(z.name)}</div>
                  <div style="color:var(--text-muted);font-size:13px;margin-top:4px">${zRoutes.length} مسار مسجّل</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();dp_openEditZoneModal('${z.id}')" title="تعديل">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();dp_confirmDeleteZone('${z.id}','${escHtml(z.name)}')" title="حذف">🗑️</button>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" style="width:100%" onclick="event.stopPropagation();window.__dp_selectedZone='${z.id}';window.__dp_selectedVehicle=null;window.__dp_selectedSubzone=null;render()">
                فتح المسارات ←
              </button>
            </div>`;
          }).join('')}
        </div>`}

      ${/* مسارات مفقودة */ ''}
      <div id="dp-missing-routes-section" style="margin-top:32px"></div>
      <script>
        (async () => {
          if (typeof dp_loadMissingRoutes !== 'function') return;
          const missing = await dp_loadMissingRoutes();
          const el = document.getElementById('dp-missing-routes-section');
          if (!el || !missing.length) return;
          el.innerHTML = \`
            <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:20px">
              <h3 style="color:#ef4444;margin-bottom:12px">⚠️ مسارات غير مسجّلة (طلبات بدون سعر توصيل)</h3>
              <div class="table-wrap">
                <table class="admin-table">
                  <thead><tr><th>من</th><th>إلى</th><th>تاريخ الإبلاغ</th><th>إجراء</th></tr></thead>
                  <tbody>
                    \${missing.map(m => \`<tr>
                      <td><strong>\${m.fromArea || '—'}</strong></td>
                      <td><strong>\${m.toArea || '—'}</strong></td>
                      <td style="color:var(--text-muted);font-size:12px">\${typeof fmtDate==='function'?fmtDate(m.reportedAt):''}</td>
                      <td>
                        <button class="btn btn-sm btn-primary" onclick="dp_openAddRouteFromMissing('\${m.fromArea}','\${m.toArea}','\${m.id}')">+ إضافة السعر</button>
                        <button class="btn btn-sm btn-secondary" onclick="dp_resolveMissingRoute('\${m.id}').then(()=>render())">تجاهل</button>
                      </td>
                    </tr>\`).join('')}
                  </tbody>
                </table>
              </div>
            </div>\`;
        })();
      </scr` + `ipt>`;
  }

  // ─── عرض تفاصيل منطقة محددة ───────────────────────────────
  const zone = zones.find(z => z.id === selZone);
  if (!zone) return '';

  // ─── صفحة اختيار نوع المركبة (جديدة) ─────────────────────
  if (!selVehicle) {
    const motoRoutes = (AppData.deliveryRoutes||[]).filter(r => r.zoneId === selZone && r.vehicleType === 'motorcycle');
    const carRoutes  = (AppData.deliveryRoutes||[]).filter(r => r.zoneId === selZone && r.vehicleType === 'car');
    const motoSubs   = (AppData.deliverySubzones||[]).filter(s => s.zoneId === selZone && s.vehicleType === 'motorcycle');
    const carSubs    = (AppData.deliverySubzones||[]).filter(s => s.zoneId === selZone && s.vehicleType === 'car');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-secondary btn-sm" onclick="window.__dp_selectedZone=null;window.__dp_selectedVehicle=null;window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">← كافة المناطق</button>
          <div>
            <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">📍 ${escHtml(zone.name)}</h2>
            <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0">اختر نوع المركبة لعرض وإدارة أسعار التوصيل</p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;max-width:700px;margin:0 auto">

        <!-- بطاقة الدراجة النارية -->
        <div style="background:linear-gradient(135deg,rgba(251,146,60,0.08),rgba(251,146,60,0.03));border:2px solid rgba(251,146,60,0.25);border-radius:20px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:16px;cursor:pointer;transition:all 0.25s ease;text-align:center"
             onmouseenter="this.style.borderColor='rgba(251,146,60,0.7)';this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(251,146,60,0.18)'"
             onmouseleave="this.style.borderColor='rgba(251,146,60,0.25)';this.style.transform='none';this.style.boxShadow='none'"
             onclick="window.__dp_selectedVehicle='motorcycle';window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">
          <div style="font-size:60px;line-height:1">🏍️</div>
          <div>
            <div style="font-size:20px;font-weight:800;color:#f97316;font-family:'Cairo',sans-serif;margin-bottom:6px">دراجة نارية</div>
            <div style="font-size:13px;color:var(--text-muted)">${motoSubs.length} عنوان · ${motoRoutes.length} مسار</div>
          </div>
          <button class="btn btn-sm" style="background:rgba(251,146,60,0.15);color:#f97316;border:1px solid rgba(251,146,60,0.3);border-radius:10px;padding:8px 20px;font-family:'Cairo',sans-serif;font-weight:700;width:100%;transition:all 0.2s ease"
                  onmouseenter="this.style.background='rgba(251,146,60,0.25)'"
                  onmouseleave="this.style.background='rgba(251,146,60,0.15)'">
            إدارة أسعار الدراجة ←
          </button>
        </div>

        <!-- بطاقة السيارة -->
        <div style="background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(59,130,246,0.03));border:2px solid rgba(59,130,246,0.25);border-radius:20px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:16px;cursor:pointer;transition:all 0.25s ease;text-align:center"
             onmouseenter="this.style.borderColor='rgba(59,130,246,0.7)';this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(59,130,246,0.18)'"
             onmouseleave="this.style.borderColor='rgba(59,130,246,0.25)';this.style.transform='none';this.style.boxShadow='none'"
             onclick="window.__dp_selectedVehicle='car';window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">
          <div style="font-size:60px;line-height:1">🚗</div>
          <div>
            <div style="font-size:20px;font-weight:800;color:#3b82f6;font-family:'Cairo',sans-serif;margin-bottom:6px">سيارة</div>
            <div style="font-size:13px;color:var(--text-muted)">${carSubs.length} عنوان · ${carRoutes.length} مسار</div>
          </div>
          <button class="btn btn-sm" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:8px 20px;font-family:'Cairo',sans-serif;font-weight:700;width:100%;transition:all 0.2s ease"
                  onmouseenter="this.style.background='rgba(59,130,246,0.25)'"
                  onmouseleave="this.style.background='rgba(59,130,246,0.15)'">
            إدارة أسعار السيارة ←
          </button>
        </div>
      </div>
    `;
  }

  // ─── إعداد بيانات نوع المركبة المختارة ─────────────────────
  const vehicleLabel = selVehicle === 'motorcycle' ? 'دراجة نارية 🏍️' : 'سيارة 🚗';
  const vehicleColor = selVehicle === 'motorcycle' ? '#f97316' : '#3b82f6';
  const vehicleIcon  = selVehicle === 'motorcycle' ? '🏍️' : '🚗';

  const subzones = (AppData.deliverySubzones || []).filter(s => s.zoneId === selZone && s.vehicleType === selVehicle);
  const selSubzoneId = window.__dp_selectedSubzone;

  // ─── صفحة قائمة العناوين الفرعية ─────────────────────────
  if (!selSubzoneId) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-secondary btn-sm" onclick="window.__dp_selectedVehicle=null;window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">← ${escHtml(zone.name)}</button>
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">${vehicleLabel}</h2>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">منطقة: ${escHtml(zone.name)}</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="dp_openAddSubzoneModal('${selZone}','${selVehicle}')">+ إضافة عنوان فرعي</button>
      </div>

      <!-- شريط البحث -->
      <div style="position:relative;margin-bottom:24px">
        <input type="text" id="dp-subzone-search" placeholder="🔍 ابحث عن عنوان فرعي سريعاً (مثال: روكب، بويش، الديس)..." 
               value="${escAttr(window.__dp_searchQuery || '')}" 
               oninput="window.__dp_searchQuery=this.value; dp_filterSubzonesList()"
               style="width:100%;padding:14px 20px 14px 45px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:16px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;transition:all 0.25s ease;box-shadow:var(--shadow-sm)"
               onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.15)'"
               onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
      </div>

      <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">اختر العنوان الفرعي لعرض مسارات التوصيل أو إضافة مسارات جديدة:</p>

      ${subzones.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;background:rgba(124,58,237,.03);border:2px dashed rgba(124,58,237,.15);border-radius:16px;margin-top:16px">
          <div style="font-size:48px;margin-bottom:12px">${vehicleIcon}</div>
          <h3 style="color:var(--text-secondary)">لا توجد عناوين فرعية لـ ${vehicleLabel} بعد</h3>
          <p style="color:var(--text-muted)">ابدأ بإضافة عنوان فرعي مثل "روكب" أو "بويش" للبدء في ربط الأسعار</p>
          <button class="btn btn-primary btn-sm" onclick="dp_openAddSubzoneModal('${selZone}','${selVehicle}')">+ إضافة أول عنوان فرعي</button>
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
          ${subzones.map(sz => {
            const szRoutes = routes.filter(r => r.zoneId === selZone && r.fromArea === sz.name && r.vehicleType === selVehicle);
            return `
            <div class="dp-subzone-card" data-name="${escAttr(sz.name)}"
                 style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:16px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;transition:all 0.25s ease;cursor:pointer;box-shadow:var(--shadow-sm)"
                 onmouseenter="this.style.transform='translateY(-3px)';this.style.borderColor='${vehicleColor}';this.style.boxShadow='var(--shadow-md)'"
                 onmouseleave="this.style.transform='none';this.style.borderColor='var(--border)';this.style.boxShadow='var(--shadow-sm)'"
                 onclick="window.__dp_selectedSubzone='${sz.id}';window.__dp_searchQuery='';render()">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="background:rgba(139,92,246,0.12);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">${vehicleIcon}</div>
                  <div>
                    <span style="font-weight:800;font-size:16px;color:var(--text-main);font-family:'Cairo',sans-serif">${escHtml(sz.name)}</span>
                    <div style="color:var(--text-muted);font-size:12px;margin-top:2px">${szRoutes.length} مسار مسجّل</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
                  <button class="btn btn-sm btn-secondary" onclick="dp_openEditSubzoneModal('${sz.id}')" style="padding:6px;border-radius:8px;background:rgba(255,255,255,0.05);border:none" title="تعديل">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteSubzone('${sz.id}','${escHtml(sz.name)}')" style="padding:6px;border-radius:8px;border:none" title="حذف">🗑️</button>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" style="width:100%;font-weight:700;font-family:'Cairo',sans-serif" onclick="window.__dp_selectedSubzone='${sz.id}';window.__dp_searchQuery='';render()">
                عرض المسارات والأسعار ←
              </button>
            </div>`;
          }).join('')}
        </div>`}
    `;
  }

  // ─── صفحة مسارات عنوان فرعي محدد ─────────────────────────
  const subzone = subzones.find(s => s.id === selSubzoneId);
  if (!subzone) {
    window.__dp_selectedSubzone = null;
    return '';
  }

  const subzoneRoutes = routes.filter(r => r.zoneId === selZone && r.fromArea === subzone.name && r.vehicleType === selVehicle);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" onclick="window.__dp_selectedSubzone=null;render()">← ${vehicleLabel} (${escHtml(zone.name)})</button>
        <div>
          <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">🏠 ${escHtml(subzone.name)}</h2>
          <span style="font-size:12px;color:var(--text-muted);margin-top:2px">المسارات المنطلقة من "${escHtml(subzone.name)}" · ${vehicleLabel}</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="dp_openAddRouteModalForSubzone('${selZone}', '${subzone.id}', '${selVehicle}')">+ إضافة مسارات جديدة</button>
    </div>

    ${subzoneRoutes.length === 0 ? `
      <div style="text-align:center;padding:60px 20px;background:rgba(16,185,129,.03);border:2px dashed rgba(16,185,129,.15);border-radius:16px;margin-top:16px">
        <div style="font-size:48px;margin-bottom:12px">🛣️</div>
        <h3 style="color:var(--text-secondary)">لا توجد مسارات مسجّلة من "${escHtml(subzone.name)}" بعد</h3>
        <p style="color:var(--text-muted)">ابدأ بإضافة مسار توصيل من "${escHtml(subzone.name)}" إلى بقية العناوين</p>
        <button class="btn btn-primary btn-sm" onclick="dp_openAddRouteModalForSubzone('${selZone}', '${subzone.id}', '${selVehicle}')">+ إضافة أول مسار</button>
      </div>` : `
      <!-- شريط بحث المسارات -->
      <div style="position:relative;margin-bottom:16px">
        <input type="text" id="dp-route-search" placeholder="🔍 ابحث عن مسار أو وجهة معينة (مثال: بويش)..." 
               oninput="dp_filterRoutesTable()"
               style="width:100%;padding:12px 18px 12px 40px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:13.5px;transition:all 0.25s ease;box-shadow:var(--shadow-sm)"
               onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.15)'"
               onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
      </div>

      <div class="table-wrap" style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:16px;overflow:hidden">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="font-family:'Cairo',sans-serif;font-weight:700">من (نقطة الاستلام)</th>
              <th style="font-family:'Cairo',sans-serif;font-weight:700">إلى (موقع العميل)</th>
              <th style="font-family:'Cairo',sans-serif;font-weight:700">سعر التوصيل</th>
              <th style="font-family:'Cairo',sans-serif;font-weight:700">الحالة</th>
              <th style="font-family:'Cairo',sans-serif;font-weight:700">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${subzoneRoutes.map(r => `
              <tr class="dp-route-row" data-to="${escAttr(r.toArea)}" data-from="${escAttr(r.fromArea)}" style="transition:all 0.2s hover">
                <td><strong style="color:var(--accent-purple);font-size:14px">${escHtml(r.fromArea)}</strong></td>
                <td><strong style="color:var(--text-main);font-size:14px">${escHtml(r.toArea)}</strong></td>
                <td>
                  <span style="font-size:15px;font-weight:800;color:#10b981">${(r.price||0).toLocaleString('ar')} ريال</span>
                  ${r.weight ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">⚖️ ${r.weight} كغ</div>` : ''}
                </td>
                <td>
                  <span class="badge ${r.active!==false?'badge-teal':'badge-rose'}">${r.active!==false?'فعّال':'معطّل'}</span>
                </td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm btn-secondary" onclick="dp_openEditRouteModal('${r.id}')">✏️ تعديل</button>
                  <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteRoute('${r.id}','${escHtml(r.fromArea)}','${escHtml(r.toArea)}')">🗑️</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
  `;
}

// ─── وظيفة التصفية الفورية بالـ DOM دون إعادة رسم الصفحة بالكامل ────────────────
window.dp_filterSubzonesList = function() {
  const query = document.getElementById('dp-subzone-search')?.value?.trim()?.toLowerCase() || '';
  const cards = document.querySelectorAll('.dp-subzone-card');
  cards.forEach(card => {
    const name = card.getAttribute('data-name')?.toLowerCase() || '';
    if (name.includes(query)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// ─── وظيفة التصفية الفورية للمسارات بداخل الجدول ────────────────
window.dp_filterRoutesTable = function() {
  const query = document.getElementById('dp-route-search')?.value?.trim()?.toLowerCase() || '';
  const rows = document.querySelectorAll('.dp-route-row');
  rows.forEach(row => {
    const to = row.getAttribute('data-to')?.toLowerCase() || '';
    const from = row.getAttribute('data-from')?.toLowerCase() || '';
    if (to.includes(query) || from.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ─── نـوافذ المناطق الفرعية (Neighborhoods) ──────────────────────
window.dp_openAddSubzoneModal = function(zoneId, vehicleType) {
  const vt = vehicleType || window.__dp_selectedVehicle || 'motorcycle';
  const vtLabel = vt === 'motorcycle' ? '🏍️ دراجة نارية' : '🚗 سيارة';
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🏠 إضافة عنوان جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--text-muted)">
        نوع المركبة: <strong style="color:var(--text-main)">${vtLabel}</strong>
      </div>
      <div class="form-group">
        <label class="form-label">اسم المنطقة الفرعية / العنوان</label>
        <input class="form-control" id="dp-sz-name" placeholder="مثال: روكب، جول مسحة، الشرج..." autofocus>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitSubzone('${zoneId}','${vt}')">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_openEditSubzoneModal = function(id) {
  const sz = (AppData.deliverySubzones||[]).find(s=>s.id===id);
  if (!sz) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل العنوان</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">الاسم</label>
        <input class="form-control" id="dp-sz-name" value="${escHtml(sz.name)}">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitSubzone('${sz.zoneId}', '${id}')">✅ حفظ التعديل</button>
      </div>
    </div>`);
};

window.dp_submitSubzone = async function(zoneId, vehicleTypeOrId=null, editId=null) {
  if (window.__dp_isSavingSubzone) return;
  const name = document.getElementById('dp-sz-name')?.value?.trim();
  if (!name) { toast('يرجى إدخال الاسم','warning'); return; }

  // تحديد هل المعامل الثاني نوع مركبة أم معرّف تعديل
  let vehicleType = window.__dp_selectedVehicle || 'motorcycle';
  let id = editId;
  if (vehicleTypeOrId === 'motorcycle' || vehicleTypeOrId === 'car') {
    vehicleType = vehicleTypeOrId;
  } else if (vehicleTypeOrId && vehicleTypeOrId !== 'null') {
    id = vehicleTypeOrId; // قديم: للتوافقية مع نوافذ التعديل
    const existingSz = (AppData.deliverySubzones||[]).find(s=>s.id===id);
    if (existingSz?.vehicleType) vehicleType = existingSz.vehicleType;
  }

  window.__dp_isSavingSubzone = true;
  showLoader('جاري حفظ العنوان...');
  try {
    const ok = await dp_saveSubzone({ zoneId, name, vehicleType }, id);
    if (ok) { toast('✅ تم الحفظ','success'); closeModal(); await render(); }
    else toast('فشل الحفظ','error');
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ','error');
  } finally {
    window.__dp_isSavingSubzone = false;
    hideLoader();
  }
};

window.dp_confirmDeleteSubzone = function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف العنوان "${name}"؟`)) return;
  dp_deleteSubzone(id).then(ok => {
    if (ok) { toast('✅ تم الحذف','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

// ─── نافذة: إضافة/تعديل منطقة ──────────────────────────────────
window.dp_openAddZoneModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🗺️ إضافة منطقة رئيسية</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">اسم المنطقة <span style="color:#ef4444">*</span></label>
        <input class="form-control" id="dp-zone-name" placeholder="مثال: المكلا" autofocus>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitZone()">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_openEditZoneModal = function(id) {
  const z = (AppData.deliveryZones||[]).find(z=>z.id===id);
  if (!z) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل منطقة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">اسم المنطقة</label>
        <input class="form-control" id="dp-zone-name" value="${escHtml(z.name||'')}">
      </div>
      <style>
        .dp-toggle-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 18px;
          transition: all 0.25s ease;
          margin-top: 8px;
        }
        .dp-toggle-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(139,92,246,0.3);
        }
        .dp-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
          margin: 0;
        }
        .dp-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .dp-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255,255,255,0.08);
          border: 1px solid var(--border);
          transition: .25s ease;
          border-radius: 24px;
        }
        .dp-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: #fff;
          transition: .25s ease;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .dp-switch input:checked + .dp-slider {
          background-color: var(--primary);
          border-color: var(--primary);
        }
        .dp-switch input:checked + .dp-slider:before {
          transform: translateX(20px);
        }
      </style>
      <div class="dp-toggle-card">
        <div style="display:flex;flex-direction:column;gap:4px;text-align:right">
          <span style="font-weight:700;font-size:14px;color:var(--text-main)">الحالة: منطقة فعّالة</span>
          <span style="font-size:12px;color:var(--text-muted)">تفعيل أو إيقاف التوصيل والمسارات لهذه المنطقة</span>
        </div>
        <label class="dp-switch">
          <input type="checkbox" id="dp-zone-active" ${z.active!==false?'checked':''}>
          <span class="dp-slider"></span>
        </label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitZone('${id}')">✅ حفظ التعديلات</button>
      </div>
    </div>`);
};

window.dp_submitZone = async function(id=null) {
  if (window.__dp_isSavingZone) return;
  const name = document.getElementById('dp-zone-name')?.value?.trim();
  if (!name) { toast('يرجى إدخال اسم المنطقة','warning'); return; }
  const active = document.getElementById('dp-zone-active')?.checked ?? true;
  
  window.__dp_isSavingZone = true;
  showLoader('جاري حفظ المنطقة...');
  try {
    const ok = await dp_saveZone({ name, active }, id);
    if (ok) { toast(`✅ تم ${id?'تعديل':'إضافة'} المنطقة بنجاح`,'success'); closeModal(); await render(); }
    else toast('حدث خطأ أثناء الحفظ','error');
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ','error');
  } finally {
    window.__dp_isSavingZone = false;
    hideLoader();
  }
};

window.dp_confirmDeleteZone = function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف منطقة "${name}" وكافة مساراتها؟`)) return;
  dp_deleteZone(id).then(ok => {
    if (ok) { toast('✅ تم حذف المنطقة','success'); render(); }
    else toast('فشل الحذف','error');
  });
};



function _buildRouteModal(zoneId, r=null, fixedFromSubzoneId=null, vehicleType=null) {
  const vt = vehicleType || r?.vehicleType || window.__dp_selectedVehicle || 'motorcycle';
  const vtLabel = vt === 'motorcycle' ? '🏍️ دراجة نارية' : '🚗 سيارة';

  const zones = AppData.deliveryZones||[];
  const subzones = (AppData.deliverySubzones || []).filter(sz => sz.zoneId === zoneId && sz.vehicleType === vt);
  
  let fromArea = r?.fromArea || '';
  if (fixedFromSubzoneId) {
    const fixedSz = subzones.find(sz => sz.id === fixedFromSubzoneId);
    if (fixedSz) fromArea = fixedSz.name;
  }
  const toArea = r?.toArea || '';
  const checklistSubzones = subzones;

  return `
    <style>
      .dp-toggle-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255,255,255,0.02);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px 18px;
        transition: all 0.25s ease;
        margin-top: 8px;
      }
      .dp-toggle-card:hover {
        background: rgba(255,255,255,0.04);
        border-color: rgba(139,92,246,0.3);
      }
      .dp-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
        margin: 0;
      }
      .dp-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .dp-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(255,255,255,0.08);
        border: 1px solid var(--border);
        transition: .25s ease;
        border-radius: 24px;
      }
      .dp-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: #fff;
        transition: .25s ease;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .dp-switch input:checked + .dp-slider {
        background-color: var(--primary);
        border-color: var(--primary);
      }
      .dp-switch input:checked + .dp-slider:before {
        transform: translateX(20px);
      }
    </style>
    <div class="modal-header">
      <h2 class="modal-title">${r?'✏️ تعديل مسار':'🛣️ إضافة مسار توصيل'}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <input type="hidden" id="dp-route-vehicle-type" value="${escAttr(vt)}">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--text-muted)">
        نوع المركبة: <strong style="color:var(--text-main)">${vtLabel}</strong>
      </div>
      ${!fixedFromSubzoneId && !r ? `
      <div class="form-group">
        <label class="form-label">المنطقة الرئيسية</label>
        <select class="form-control" id="dp-route-zone" onchange="window.__dp_lastZoneId=this.value; dp_openAddRouteModal(this.value)">
          ${zones.map(z=>`<option value="${z.id}" ${(r?.zoneId||zoneId)===z.id?'selected':''}>${escHtml(z.name)}</option>`).join('')}
        </select>
      </div>` : `<input type="hidden" id="dp-route-zone" value="${escAttr(zoneId)}">`}

      <div class="form-group">
        <label class="form-label">📤 من (نقطة الاستلام / موقع المحل) <span style="color:#ef4444">*</span></label>
        ${fixedFromSubzoneId || r ? `
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">🏠</span>
            <strong style="color:var(--accent-purple);font-size:15px">${escHtml(fromArea)}</strong>
            <input type="hidden" id="dp-route-from" value="${escAttr(fromArea)}">
            <span style="font-size:11px;color:var(--text-muted);margin-right:auto">(محددة مسبقاً)</span>
          </div>
        ` : `
          ${subzones.length > 0 ? `
            <select class="form-control" id="dp-route-from">
              <option value="" disabled ${!fromArea?'selected':''}>اختر المنطقة الفرعية...</option>
              ${subzones.map(sz => `<option value="${escAttr(sz.name)}" ${fromArea===sz.name?'selected':''}>🏠 ${escHtml(sz.name)}</option>`).join('')}
            </select>
          ` : `
            <input class="form-control" id="dp-route-from" placeholder="مثال: روكب" value="${escHtml(fromArea)}">
          `}
        `}
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
          <span>📥 إلى (موقع العميل) <span style="color:#ef4444">*</span></span>
          ${checklistSubzones.length > 0 && !r ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px" onclick="dp_toggleAllToSubzones(true)">تحديد الكل</button>
              <button class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px" onclick="dp_toggleAllToSubzones(false)">إلغاء الكل</button>
            </div>
          ` : ''}
        </label>
        ${r ? `
          <input class="form-control" id="dp-route-to" placeholder="مثال: بويش" value="${escHtml(toArea)}" readonly style="opacity:0.8">
        ` : `
          ${checklistSubzones.length > 0 ? `
            <!-- Search box inside checklist -->
            <div style="position:relative;margin-bottom:10px">
              <input type="text" id="dp-modal-subzone-search" placeholder="🔍 ابحث عن عنوان لتحديده سريعاً..." 
                     oninput="dp_filterModalSubzonesChecklist()"
                     style="width:100%;padding:8px 12px 8px 30px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:12px;transition:all 0.2s ease"
                     onfocus="this.style.borderColor='var(--primary)'"
                     onblur="this.style.borderColor='var(--border)'">
            </div>

            <div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:14px;padding:16px;max-height:220px;overflow-y:auto">
              <div id="dp-subzones-checklist" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:10px">
                ${checklistSubzones.map(sz => {
                  const isChecked = toArea.split(',').includes(sz.name);
                  const isSame = sz.name === fromArea;
                  const initialBorder = isChecked ? 'var(--primary)' : 'var(--border)';
                  const initialBg = isChecked ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)';
                  const initialColor = isChecked ? 'var(--primary)' : 'var(--text-main)';
                  return `
                  <label class="subzone-checkbox-card" data-name="${escAttr(sz.name)}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;border:1px solid ${initialBorder};border-radius:12px;background:${initialBg};color:${initialColor};cursor:pointer;transition:all 0.2s ease;position:relative;text-align:center;min-height:70px"
                         onmouseenter="if(!this.querySelector('input').checked) { this.style.borderColor = 'rgba(139,92,246,0.4)'; this.style.transform = 'translateY(-2px)' }"
                         onmouseleave="if(!this.querySelector('input').checked) { this.style.borderColor = 'var(--border)'; this.style.transform = 'none' } else { this.style.transform = 'none' }">
                    <input type="checkbox" name="dp-to-subzone" value="${escAttr(sz.name)}" ${isChecked?'checked':''} style="display:none" onchange="this.parentElement.style.borderColor = this.checked ? 'var(--primary)' : 'var(--border)'; this.parentElement.style.background = this.checked ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)'; this.parentElement.style.color = this.checked ? 'var(--primary)' : 'var(--text-main)'">
                    <span style="font-size:16px">🏠</span>
                    <span style="font-size:12px;font-weight:700">${escHtml(sz.name)}</span>
                    ${isSame ? `<span style="font-size:9px;color:var(--accent-purple);font-weight:bold;margin-top:2px">(توصيل داخلي)</span>` : ''}
                  </label>
                  `;
                }).join('')}
              </div>
            </div>
          ` : `
            <input class="form-control" id="dp-route-to" placeholder="مثال: بويش" value="${escHtml(toArea)}">
          `}
        `}
      </div>

      <div class="form-group">
        <label class="form-label">💰 سعر التوصيل (ريال) <span style="color:#ef4444">*</span></label>
        <input class="form-control" id="dp-route-price" type="number" min="0" placeholder="مثال: 1000" value="${r?.price||''}">
      </div>

      <div class="dp-toggle-card" style="margin-top:0px">
        <div style="display:flex;flex-direction:column;gap:4px;text-align:right">
          <span style="font-weight:700;font-size:14px;color:var(--text-main)">الحالة: مسار فعّال</span>
          <span style="font-size:12px;color:var(--text-muted)">تمكين التوصيل وتسعير هذا المسار للعملاء</span>
        </div>
        <label class="dp-switch">
          <input type="checkbox" id="dp-route-active" ${r?.active!==false?'checked':''}>
          <span class="dp-slider"></span>
        </label>
      </div>

      ${r && fromArea !== toArea ? `
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-top:4px">
        <label class="form-label" style="margin-bottom:8px">⚙️ خيارات حفظ التعديل</label>
        <div style="display:flex;gap:20px;align-items:center">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-main);font-family:'Cairo',sans-serif">
            <input type="radio" name="dp-edit-mode" value="individual" checked style="accent-color:var(--primary);width:16px;height:16px">
            ✏️ تعديل فردي (هذا الاتجاه فقط)
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-main);font-family:'Cairo',sans-serif">
            <input type="radio" name="dp-edit-mode" value="global" style="accent-color:var(--primary);width:16px;height:16px">
            🌐 تعديل شامل (الذهاب والإياب معاً)
          </label>
        </div>
      </div>
      ` : ''}

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitRoute(${r?`'${r.id}'`:'null'})">✅ حفظ المسار</button>
      </div>
    </div>`;
}

window.dp_toggleAllToSubzones = function(val) {
  const checks = document.getElementsByName('dp-to-subzone');
  checks.forEach(c => {
    c.checked = val;
    c.dispatchEvent(new Event('change'));
  });
};

window.dp_filterModalSubzonesChecklist = function() {
  const query = document.getElementById('dp-modal-subzone-search')?.value?.trim()?.toLowerCase() || '';
  const labels = document.querySelectorAll('.subzone-checkbox-card');
  labels.forEach(label => {
    const name = label.getAttribute('data-name')?.toLowerCase() || '';
    if (name.includes(query)) {
      label.style.display = 'flex';
    } else {
      label.style.display = 'none';
    }
  });
};

window.dp_openAddRouteModal = function(zoneId) {
  openModal(_buildRouteModal(zoneId));
};

window.dp_openAddRouteModalForSubzone = function(zoneId, subzoneId, vehicleType) {
  openModal(_buildRouteModal(zoneId, null, subzoneId, vehicleType || window.__dp_selectedVehicle));
};

window.dp_openAddRouteFromMissing = function(fromArea, toArea, missingId) {
  const firstZone = (AppData.deliveryZones||[])[0]?.id || '';
  window.__dp_selectedZone = window.__dp_selectedZone || firstZone;
  openModal(_buildRouteModal(window.__dp_selectedZone, { fromArea, toArea }));
  // بعد الحفظ سنحل المسار المفقود تلقائياً
  window.__dp_resolveMissingId = missingId;
};

window.dp_openEditRouteModal = function(id) {
  const r = (AppData.deliveryRoutes||[]).find(r=>r.id===id);
  if (!r) return;
  openModal(_buildRouteModal(r.zoneId, r));
};

window.dp_submitRoute = async function(id=null) {
  if (window.__dp_isSavingRoute) return;

  const zoneId      = document.getElementById('dp-route-zone')?.value;
  const fromArea    = document.getElementById('dp-route-from')?.value?.trim();
  const price       = document.getElementById('dp-route-price')?.value;
  const active      = document.getElementById('dp-route-active')?.checked ?? true;
  const vehicleType = document.getElementById('dp-route-vehicle-type')?.value || window.__dp_selectedVehicle || 'motorcycle';

  // الحصول على الوجهات المحددة (سواء كان إدخال يدوي أو قائمة تشيك بوكس)
  let toAreas = [];
  const checks = document.getElementsByName('dp-to-subzone');
  if (checks.length > 0) {
    checks.forEach(c => { if (c.checked) toAreas.push(c.value); });
  } else {
    const to = document.getElementById('dp-route-to')?.value?.trim();
    if (to) toAreas.push(to);
  }

  if (!fromArea || toAreas.length === 0) { toast('يرجى إدخال نقطة الاستلام ووجهة واحدة على الأقل','warning'); return; }
  if (!price || Number(price) < 0) { toast('يرجى إدخال سعر صحيح','warning'); return; }

  window.__dp_isSavingRoute = true;
  showLoader('جاري حفظ المسارات...');
  try {
    // إذا كان تعديل، نعدل السجل نفسه
    if (id) {
      await dp_saveRoute({ zoneId, fromArea, toArea: toAreas[0], price, active }, id);
      
      // قراءة نوع التعديل (فردي أم شامل للاتجاهين معاً)
      const editMode = document.querySelector('input[name="dp-edit-mode"]:checked')?.value || 'individual';
      if (editMode === 'global') {
        const to = toAreas[0];
        if (fromArea !== to) {
          const reverseRoute = (AppData.deliveryRoutes || []).find(r => r.zoneId === zoneId && r.fromArea === to && r.toArea === fromArea);
          if (reverseRoute) {
            await dp_saveRoute({ zoneId, fromArea: to, toArea: fromArea, price, active }, reverseRoute.id);
          }
        }
      }
    } else {
      // إضافة المسارات بالاتجاهين تلقائياً (من A إلى B ومن B إلى A)
      const existingRoutes = AppData.deliveryRoutes || [];
      const promises = [];
      
      toAreas.forEach(to => {
        // 1. إضافة الاتجاه الرئيسي (A → B) إذا لم يكن موجوداً
        const exists1 = existingRoutes.some(r => r.zoneId === zoneId && r.fromArea === fromArea && r.toArea === to && r.vehicleType === vehicleType);
        if (!exists1) {
          promises.push(dp_saveRoute({ zoneId, fromArea, toArea: to, price, active, vehicleType }));
        }
        
        // 2. إضافة الاتجاه العكسي (B → A) إذا لم يكن نفس المنطقة ولم يكن موجوداً بالفعل
        if (fromArea !== to) {
          const exists2 = existingRoutes.some(r => r.zoneId === zoneId && r.fromArea === to && r.toArea === fromArea && r.vehicleType === vehicleType);
          if (!exists2) {
            promises.push(dp_saveRoute({ zoneId, fromArea: to, toArea: fromArea, price, active, vehicleType }));
          }
        }
      });
      
      await Promise.all(promises);
    }
    
    toast(`✅ تم الحفظ بنجاح`,'success');
    if (window.__dp_resolveMissingId) {
      await dp_resolveMissingRoute(window.__dp_resolveMissingId);
      window.__dp_resolveMissingId = null;
    }
    closeModal();
    await render();
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ','error');
  } finally {
    window.__dp_isSavingRoute = false;
    hideLoader();
  }
};

window.dp_confirmDeleteRoute = function(id, from, to) {
  if (!confirm(`حذف مسار "${from} → ${to}"؟`)) return;
  dp_deleteRoute(id).then(ok => {
    if (ok) { toast('✅ تم حذف المسار','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

// Final override after load: ensure our admin renderers and tab setter persist
try {
  window.addEventListener && window.addEventListener('load', function () {
    try {
      if (typeof renderAdminUsers === 'function') window.renderAdminUsers = renderAdminUsers;
      if (typeof renderAdminOrders === 'function') window.renderAdminOrders = renderAdminOrders;
      if (typeof renderAdminWallet === 'function') window.renderAdminWallet = renderAdminWallet;
      if (typeof renderAdminPermissions === 'function') window.renderAdminPermissions = renderAdminPermissions;
      if (typeof renderAdminLoginSettings === 'function') window.renderAdminLoginSettings = renderAdminLoginSettings;

      window.setAdminTab = async function (tab) {
        const sidebarOpen = document.getElementById('adminSidebar')?.classList.contains('open');
        if (sidebarOpen) {
          const sidebar = document.getElementById('adminSidebar');
          const overlay = document.getElementById('adminSidebarOverlay');
          if (sidebar) { sidebar.classList.remove('open'); sidebar.classList.remove('dragging'); }
          if (overlay) overlay.classList.remove('open');
          document.body.style.overflow = '';
        }
        document.body.style.overflow = '';
        await navigate('admin', { tab }, sidebarOpen);
      };
    } catch (e) { console.warn('[phase3] final override failed', e); }
  });
} catch (e) { /* ignore */ }
