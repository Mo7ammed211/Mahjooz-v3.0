/* phase25.js — Account Activation & Approval System
   - Admin tab "Pending Accounts"
   - Approve / Reject accounts with notifications
   - Inactive account banner on home page
*/
'use strict';


// ── Pending Accounts logic moved to Master Router (phase26.js) ──

function renderPendingAccounts() {
  const pending = (AppData.users || []).filter(u =>
    u.isActive === false && u.isActivePending === true
  );
  const roleLabels = { customer: 'عميل', driver: 'مندوب', vendor: 'مزود خدمة', staff: 'موظف' };
  const genderLabels = { male: 'ذكر 👨', female: 'أنثى 👩' };

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px">
      <h2>👥 الحسابات بانتظار التفعيل</h2>
      <span class="badge badge-rose" style="font-size:14px; padding:6px 12px">${pending.length} حساب</span>
    </div>

    ${pending.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">لا توجد حسابات بانتظار المراجعة</div>
        <div class="empty-sub">جميع الحسابات تمت مراجعتها</div>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الدور</th>
              <th>الجنس / العمر</th>
              <th>الجوال</th>
              <th>البريد</th>
              <th>المنطقة</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            ${pending.map((u, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="font-weight:700">${escHtml(u.name || '—')}</td>
                <td><span class="badge badge-purple">${roleLabels[u.role] || u.role}</span></td>
                <td>${genderLabels[u.gender] || '—'} / ${u.age || '—'}</td>
                <td style="direction:ltr">${escHtml(u.phone || '—')}</td>
                <td style="direction:ltr; font-size:12px">${escHtml(u.email || '—')}</td>
                <td>${escHtml(u.region || u.regionId || '—')}</td>
                <td>
                  <button class="btn btn-sm btn-success" onclick="ph25_approveAccount('${u.id}', '${escAttr(u.name||'')}', '${u.role}')">✅ تفعيل</button>
                  <button class="btn btn-sm btn-danger" style="margin-right:6px" onclick="ph25_rejectAccount('${u.id}', '${escAttr(u.name||'')}')">❌ رفض</button>
                  <button class="btn btn-sm btn-secondary" style="margin-right:6px" onclick="ph25_viewAccount('${u.id}')">👁️ عرض</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── Approve Account ──
window.ph25_approveAccount = async function (uid, name, role) {
  if (!confirm(`هل تريد تفعيل حساب "${name}"؟`)) return;
  showLoader('جاري تفعيل الحساب...');
  try {
    await fsUpdate('users', uid, {
      isActive: true,
      isActivePending: false,
      activatedAt: new Date(),
      activatedBy: State.currentUser?.uid || 'admin',
    });

    // Send notification to the user
    try {
      const roleLabels = { customer: 'عميل', driver: 'مندوب', vendor: 'مزود خدمة' };
      await fsAdd('notifications', {
        targetUserId: uid,
        type: 'account_activated',
        title: '🎉 مبروك! تم تفعيل حسابك',
        message: `تهانينا ${name}! تم مراجعة بياناتك وتفعيل حسابك كـ${roleLabels[role]||role}. يمكنك الآن الاستفادة من جميع خدمات المنصة.`,
        read: false,
        createdAt: new Date(),
      });
    } catch (e) { console.warn('Notif failed', e); }

    // Reload data
    if (typeof loadAllData === 'function') await loadAllData();
    hideLoader();
    toast(`✅ تم تفعيل حساب "${name}" بنجاح!`, 'success');
    await render();
  } catch (e) {
    hideLoader();
    toast('حدث خطأ: ' + (e.message || e), 'error');
  }
};

// ── Reject Account ──
window.ph25_rejectAccount = async function (uid, name) {
  const reason = prompt(`سبب رفض حساب "${name}" (اختياري):`);
  if (reason === null) return; // user cancelled
  showLoader('جاري معالجة الرفض...');
  try {
    await fsUpdate('users', uid, {
      isActive: false,
      isActivePending: false,
      isRejected: true,
      rejectionReason: reason || '—',
      rejectedAt: new Date(),
      rejectedBy: State.currentUser?.uid || 'admin',
    });

    // Notify user
    try {
      await fsAdd('notifications', {
        targetUserId: uid,
        type: 'account_rejected',
        title: '⚠️ تعذّر تفعيل حسابك',
        message: `عزيزي ${name}، بعد المراجعة تعذّر تفعيل حسابك${reason ? ` بسبب: ${reason}` : ''}. للاستفسار تواصل مع الدعم.`,
        read: false,
        createdAt: new Date(),
      });
    } catch (e) { console.warn('Notif failed', e); }

    if (typeof loadAllData === 'function') await loadAllData();
    hideLoader();
    toast(`تم رفض حساب "${name}"`, 'info');
    await render();
  } catch (e) {
    hideLoader();
    toast('حدث خطأ: ' + (e.message || e), 'error');
  }
};

// ── View Account Details ──
window.ph25_viewAccount = function (uid) {
  const u = (AppData.users || []).find(x => x.id === uid || x.uid === uid);
  if (!u) return;
  const roleLabels = { customer: 'عميل', driver: 'مندوب', vendor: 'مزود خدمة' };
  const genderLabels = { male: 'ذكر', female: 'أنثى' };
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">👤 ${escHtml(u.name || 'مستخدم')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:grid; gap:12px; padding:8px 0">
      <div class="ph9-info-row"><span>الدور:</span><strong>${roleLabels[u.role]||u.role}</strong></div>
      <div class="ph9-info-row"><span>الجنس:</span><strong>${genderLabels[u.gender]||'—'}</strong></div>
      <div class="ph9-info-row"><span>العمر:</span><strong>${u.age||'—'}</strong></div>
      <div class="ph9-info-row"><span>الجوال:</span><strong style="direction:ltr">${u.phone||'—'}</strong></div>
      <div class="ph9-info-row"><span>البريد:</span><strong style="direction:ltr; font-size:13px">${u.email||'—'}</strong></div>
      <div class="ph9-info-row"><span>المنطقة:</span><strong>${u.region||u.regionId||'—'}</strong></div>
      <div class="ph9-info-row"><span>العنوان:</span><strong>${u.locationText||'—'}</strong></div>
    </div>
    <div style="display:flex; gap:10px; margin-top:20px">
      <button class="btn btn-success btn-block" onclick="closeModal();ph25_approveAccount('${u.id}','${escAttr(u.name||'')}','${u.role}')">✅ تفعيل</button>
      <button class="btn btn-danger btn-block" onclick="closeModal();ph25_rejectAccount('${u.id}','${escAttr(u.name||'')}')">❌ رفض</button>
    </div>
  `);
};

// ── CSS Styles ──
(function injectStyles() {
  const css = `
  /* Role selection cards in signup */
  .su-role-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin: 0 0 10px;
  }
  @media (max-width: 480px) {
    .su-role-grid { grid-template-columns: 1fr; }
  }
  .su-role-card {
    background: var(--bg-hover);
    border: 2px solid var(--border);
    border-radius: 16px;
    padding: 20px 14px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .su-role-card:hover {
    border-color: var(--primary);
    background: rgba(124,58,237,0.1);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(124,58,237,0.2);
  }
  .su-role-icon { font-size: 40px; margin-bottom: 10px; }
  .su-role-title { font-weight: 800; font-size: 16px; margin-bottom: 6px; }
  .su-role-desc { color: var(--text-secondary); font-size: 12px; line-height: 1.5; }

  /* Warning banner in signup */
  .su-locked-warning {
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.4);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 13px;
    color: #d97706;
    margin-bottom: 20px;
    line-height: 1.6;
  }

  /* Locked field display */
  .ph9-locked-field {
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: not-allowed;
    opacity: 0.8;
  }
  .ph9-info-row-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

console.log('[Phase 25] Account Activation & Approval System loaded.');
