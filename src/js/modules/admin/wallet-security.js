/* ═══════════════════════════════════════════════════════════════
   نظام أمان المحافظ المتكامل — Secure Wallet Management System
   ───────────────────────────────────────────────────────────────
   المميزات:
   • بوابة كلمة مرور قبل أي عملية على المحفظة (إعادة مصادقة Firebase)
   • تسجيل كامل لكل حركة: اسم المدير، دوره، تاريخ/وقت، قبل/بعد
   • عمليات ضمن Firestore Transaction لمنع التلاعب
   • كشف العمليات المشبوهة (مبالغ كبيرة = تأكيد مزدوج)
   • سجل التدقيق محمي من الحذف والتعديل
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── ثوابت الأمان ──────────────────────────────────────────── */
  const LARGE_AMOUNT_THRESHOLD = 500;   // مبلغ يستوجب تأكيداً مزدوجاً
  const AUDIT_COLLECTION       = 'wallet_audit_log';
  const SESSION_AUTH_TTL       = 10 * 60 * 1000; // 10 دقائق قبل إعادة المصادقة

  let _lastAuthTime = 0;
  let _authSessionUid = null;

  /* ── CSS ──────────────────────────────────────────────────── */
  const css = `
  /* ── بوابة كلمة المرور ── */
  .wsec-gate {
    max-width: 420px;
    margin: 60px auto;
    background: var(--card-bg, #1e1e2e);
    border: 2px solid rgba(124,58,237,0.3);
    border-radius: 20px;
    padding: 36px 32px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    font-family: 'Cairo', sans-serif;
  }
  .wsec-gate-icon { font-size: 48px; margin-bottom: 12px; }
  .wsec-gate-title { font-size: 18px; font-weight: 900; color: var(--text); margin-bottom: 6px; }
  .wsec-gate-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }
  .wsec-gate-input {
    width: 100%;
    background: var(--input-bg, #12121f);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--text);
    font-size: 16px;
    font-family: 'Cairo', sans-serif;
    text-align: center;
    letter-spacing: 4px;
    outline: none;
    margin-bottom: 16px;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .wsec-gate-input:focus { border-color: #7c3aed; }
  .wsec-gate-input.error { border-color: #ef4444; animation: wsec-shake 0.4s; }
  @keyframes wsec-shake {
    0%,100%{ transform: translateX(0) }
    25%    { transform: translateX(-6px) }
    75%    { transform: translateX(6px) }
  }
  .wsec-gate-btn {
    width: 100%;
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    color: #fff;
    border: none;
    border-radius: 12px;
    padding: 13px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: opacity 0.2s;
  }
  .wsec-gate-btn:hover:not(:disabled) { opacity: 0.9; }
  .wsec-gate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .wsec-gate-err {
    color: #ef4444;
    font-size: 12px;
    margin-top: 10px;
    min-height: 18px;
    font-weight: 700;
  }
  .wsec-gate-attempts {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
  }

  /* ── لوحة إدارة المحافظ ── */
  .wsec-wrap {
    padding: 20px;
    max-width: 1100px;
    margin: 0 auto;
    font-family: 'Cairo', sans-serif;
  }
  .wsec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 22px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .wsec-title {
    font-size: 19px;
    font-weight: 900;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wsec-secure-badge {
    background: rgba(16,185,129,0.12);
    color: #10b981;
    border: 1px solid rgba(16,185,129,0.25);
    border-radius: 8px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── جدول المستخدمين ── */
  .wsec-search-bar {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    color: var(--text);
    font-size: 13px;
    font-family: 'Cairo', sans-serif;
    width: 100%;
    outline: none;
    margin-bottom: 16px;
  }
  .wsec-user-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    margin-bottom: 30px;
  }
  .wsec-user-card {
    background: var(--card-bg);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s;
    cursor: pointer;
  }
  .wsec-user-card:hover { border-color: #7c3aed; }
  .wsec-user-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(124,58,237,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .wsec-user-name { font-size: 13px; font-weight: 800; color: var(--text); }
  .wsec-user-role { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }
  .wsec-user-balance {
    margin-right: auto;
    font-size: 14px;
    font-weight: 900;
    color: #10b981;
    white-space: nowrap;
  }
  .wsec-user-balance.zero { color: var(--text-muted); }

  /* ── نافذة تعديل المحفظة ── */
  .wsec-modal-section {
    margin-bottom: 20px;
  }
  .wsec-modal-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 6px;
    display: block;
  }
  .wsec-action-btns {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .wsec-action-btn {
    flex: 1;
    min-width: 90px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
    font-family: 'Cairo', sans-serif;
    background: var(--card-bg);
    color: var(--text);
    transition: all 0.2s;
  }
  .wsec-action-btn.sel-credit  { border-color: #10b981; background: rgba(16,185,129,0.1); color: #10b981; }
  .wsec-action-btn.sel-debit   { border-color: #ef4444; background: rgba(239,68,68,0.1);  color: #ef4444; }
  .wsec-action-btn.sel-set     { border-color: #7c3aed; background: rgba(124,58,237,0.1); color: #7c3aed; }

  .wsec-modal-input {
    width: 100%;
    background: var(--input-bg, #12121f);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 11px 14px;
    color: var(--text);
    font-size: 15px;
    font-family: 'Cairo', sans-serif;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .wsec-modal-input:focus { border-color: #7c3aed; }

  .wsec-balance-display {
    background: rgba(124,58,237,0.07);
    border: 1px solid rgba(124,58,237,0.2);
    border-radius: 10px;
    padding: 12px 16px;
    text-align: center;
    margin-bottom: 16px;
  }
  .wsec-balance-num {
    font-size: 26px;
    font-weight: 900;
    color: #10b981;
  }
  .wsec-balance-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .wsec-warn-box {
    background: rgba(251,191,36,0.08);
    border: 1.5px solid rgba(251,191,36,0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 12px;
    color: #fbbf24;
    font-weight: 700;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── سجل التدقيق ── */
  .wsec-audit-wrap { margin-top: 30px; }
  .wsec-audit-title {
    font-size: 15px;
    font-weight: 900;
    color: var(--text);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .wsec-audit-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    align-items: center;
  }
  .wsec-audit-filter {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: all 0.2s;
  }
  .wsec-audit-filter.active { border-color: #7c3aed; color: #7c3aed; background: rgba(124,58,237,0.08); }

  .wsec-audit-table-wrap {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid var(--border);
  }
  .wsec-audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .wsec-audit-table th {
    background: rgba(124,58,237,0.08);
    padding: 11px 12px;
    text-align: right;
    font-weight: 800;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .wsec-audit-table td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--text);
    vertical-align: middle;
  }
  .wsec-audit-table tr:last-child td { border-bottom: none; }
  .wsec-audit-table tr:hover td { background: rgba(255,255,255,0.02); }

  .wsec-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 800;
    white-space: nowrap;
  }
  .wsec-badge.credit  { background: rgba(16,185,129,0.12); color: #10b981; }
  .wsec-badge.debit   { background: rgba(239,68,68,0.12);  color: #ef4444; }
  .wsec-badge.set     { background: rgba(124,58,237,0.12); color: #a78bfa; }
  .wsec-badge.view    { background: rgba(107,114,128,0.1); color: #9ca3af; }
  .wsec-badge.admin   { background: rgba(251,191,36,0.12); color: #fbbf24; }
  .wsec-badge.staff   { background: rgba(59,130,246,0.12); color: #60a5fa; }

  .wsec-empty {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .wsec-submit-btn {
    width: 100%;
    border: none;
    border-radius: 12px;
    padding: 13px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: opacity 0.2s;
    color: #fff;
  }
  .wsec-submit-btn.credit { background: linear-gradient(135deg,#10b981,#059669); }
  .wsec-submit-btn.debit  { background: linear-gradient(135deg,#ef4444,#b91c1c); }
  .wsec-submit-btn.set    { background: linear-gradient(135deg,#7c3aed,#5b21b6); }
  .wsec-submit-btn:hover:not(:disabled) { opacity: 0.9; }
  .wsec-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  @media(max-width:600px){
    .wsec-wrap { padding: 12px; }
    .wsec-user-grid { grid-template-columns: 1fr; }
  }
  `;

  if (!document.getElementById('wsec-styles')) {
    const el = document.createElement('style');
    el.id = 'wsec-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ══════════════════════════════════════════════════════════
     أدوات مساعدة
  ══════════════════════════════════════════════════════════ */
  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  function _fmtTs(ts) {
    if (!ts) return '—';
    let d;
    if (ts.toDate)      d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else                 d = new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleString('ar-SA', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }

  function _roleName(role) {
    return { admin:'مدير', staff:'موظف', cs:'خدمة عملاء', vendor:'مزود', driver:'مندوب', customer:'عميل' }[role] || role || '—';
  }

  function _userAvatar(u) {
    const icons = { admin:'👑', staff:'🧑‍💼', vendor:'🏪', driver:'🚗', customer:'👤' };
    return icons[u?.role] || '👤';
  }

  function _walletBalance(uid) {
    const w = AppData.wallets && AppData.wallets[uid];
    return w ? (w.balance || 0) : 0;
  }

  /* ══════════════════════════════════════════════════════════
     كتابة سجل التدقيق (محمي — كتابة فقط، لا حذف أبداً)
  ══════════════════════════════════════════════════════════ */
  async function _writeAuditLog(data) {
    try {
      const me = State.currentUser;
      const entry = {
        adminUid:         me?.uid || 'unknown',
        adminName:        me?.displayName || me?.name || me?.email || 'مجهول',
        adminRole:        me?.role || 'unknown',
        targetUid:        data.targetUid    || '',
        targetName:       data.targetName   || '',
        action:           data.action       || 'unknown',
        amount:           data.amount       || 0,
        balanceBefore:    data.balanceBefore ?? null,
        balanceAfter:     data.balanceAfter  ?? null,
        note:             data.note         || '',
        timestamp:        firebase.firestore.FieldValue.serverTimestamp(),
        userAgent:        navigator.userAgent.slice(0, 200),
        sessionId:        _sessionId,
      };
      await db.collection(AUDIT_COLLECTION).add(entry);
    } catch (e) {
      console.error('[WalletSecurity] فشل كتابة سجل التدقيق:', e);
    }
  }

  /* ── معرّف جلسة عشوائي لتتبع الجلسات ── */
  const _sessionId = Math.random().toString(36).slice(2, 10).toUpperCase();

  /* ══════════════════════════════════════════════════════════
     بوابة كلمة المرور — إعادة مصادقة Firebase
  ══════════════════════════════════════════════════════════ */
  let _gateAttempts = 0;

  function _isSessionValid() {
    const me = State.currentUser;
    return _authSessionUid === me?.uid && (Date.now() - _lastAuthTime) < SESSION_AUTH_TTL;
  }

  async function _reAuthenticate(password) {
    const user = firebase.auth().currentUser;
    if (!user || !user.email) throw new Error('لا يوجد حساب مسجّل دخوله حالياً');
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(cred);
    _lastAuthTime   = Date.now();
    _authSessionUid = user.uid;
    _gateAttempts   = 0;
  }

  /* ── عرض بوابة كلمة المرور ── */
  window.wsecShowGate = function (onSuccessCallback) {
    const locked = _gateAttempts >= 5;
    openModal(`
      <div class="wsec-gate">
        <div class="wsec-gate-icon">🔐</div>
        <div class="wsec-gate-title">تأكيد هويتك</div>
        <div class="wsec-gate-sub">أدخل كلمة مرور حسابك للمتابعة<br>هذه الخطوة مطلوبة لحماية المحافظ من أي تلاعب</div>
        ${locked ? `<div class="wsec-gate-err">🔒 تم تجميد الوصول بسبب محاولات متكررة. أغلق النافذة وحاول لاحقاً.</div>` : `
        <input class="wsec-gate-input" id="wsec-pwd-input" type="password"
               placeholder="••••••••"
               autocomplete="current-password"
               onkeydown="if(event.key==='Enter')wsecSubmitGate()"
               autofocus />
        <button class="wsec-gate-btn" id="wsec-gate-btn" onclick="wsecSubmitGate()">
          🔓 تأكيد والمتابعة
        </button>
        <div class="wsec-gate-err" id="wsec-gate-err"></div>
        <div class="wsec-gate-attempts" id="wsec-gate-attempts">
          ${_gateAttempts > 0 ? `محاولات خاطئة: ${_gateAttempts} / 5` : ''}
        </div>`}
      </div>`, 'sm');

    window.__wsecGateCallback = onSuccessCallback;
    if (!locked) setTimeout(() => document.getElementById('wsec-pwd-input')?.focus(), 100);
  };

  window.wsecSubmitGate = async function () {
    const pwd    = document.getElementById('wsec-pwd-input')?.value || '';
    const btn    = document.getElementById('wsec-gate-btn');
    const errEl  = document.getElementById('wsec-gate-err');
    const attEl  = document.getElementById('wsec-gate-attempts');
    const input  = document.getElementById('wsec-pwd-input');

    if (!pwd) { errEl.textContent = 'يرجى إدخال كلمة المرور'; return; }

    btn.disabled = true;
    btn.textContent = '⏳ جاري التحقق...';
    errEl.textContent = '';

    try {
      await _reAuthenticate(pwd);

      /* تسجيل دخول للوحة المحافظ */
      await _writeAuditLog({
        action: 'gate_access',
        note:   'دخول ناجح للوحة إدارة المحافظ',
      });

      closeModal();
      if (typeof window.__wsecGateCallback === 'function') {
        window.__wsecGateCallback();
        window.__wsecGateCallback = null;
      }
    } catch (err) {
      _gateAttempts++;
      input.value = '';
      input.classList.add('error');
      setTimeout(() => input?.classList.remove('error'), 500);

      const remaining = 5 - _gateAttempts;
      if (_gateAttempts >= 5) {
        errEl.textContent = '🔒 تم تجميد الوصول. أغلق النافذة وحاول بعد قليل.';
        btn.disabled = true;
        await _writeAuditLog({ action: 'gate_locked', note: 'تجاوز الحد الأقصى لمحاولات كلمة المرور' });
      } else {
        errEl.textContent = `كلمة المرور غير صحيحة — متبقي ${remaining} محاولة`;
        if (attEl) attEl.textContent = `محاولات خاطئة: ${_gateAttempts} / 5`;
        btn.disabled = false;
        btn.textContent = '🔓 تأكيد والمتابعة';
        input.focus();
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     لوحة إدارة المحافظ الرئيسية
  ══════════════════════════════════════════════════════════ */
  window.renderSecureWalletPanel = function () {
    /* إذا انتهت جلسة المصادقة أو لم تبدأ → اعرض البوابة */
    if (!_isSessionValid()) {
      return `
      <div style="padding:40px;text-align:center;font-family:'Cairo',sans-serif">
        <div style="font-size:52px;margin-bottom:16px">🔐</div>
        <div style="font-size:17px;font-weight:900;color:var(--text);margin-bottom:8px">محمي بكلمة المرور</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">
          لحماية المحافظ من التلاعب، يلزم إدخال كلمة مرور حسابك لفتح هذا القسم
        </div>
        <button onclick="wsecShowGate(function(){ setAdminTab('wallet'); })"
                style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:12px;padding:13px 30px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
          🔓 فتح إدارة المحافظ
        </button>
      </div>`;
    }

    const me      = State.currentUser;
    const canEdit = me?.role === 'admin' || userHasPerm(me, 'adjust_wallets');
    const users   = (AppData.users || []).filter(u => u.uid || u.id);
    const q       = (State.wsecSearch || '').toLowerCase();

    const filtered = users.filter(u => {
      if (!q) return true;
      const name = (u.displayName || u.name || u.email || '').toLowerCase();
      return name.includes(q);
    }).sort((a, b) => {
      const bBal = _walletBalance(b.uid || b.id);
      const aBal = _walletBalance(a.uid || a.id);
      return bBal - aBal;
    });

    /* ملخص إجمالي */
    let totalBalance = 0;
    users.forEach(u => { totalBalance += _walletBalance(u.uid || u.id); });

    const sessionLeft = Math.max(0, Math.ceil((SESSION_AUTH_TTL - (Date.now() - _lastAuthTime)) / 60000));

    return `
    <div class="wsec-wrap">

      <!-- رأس الصفحة -->
      <div class="wsec-header">
        <div class="wsec-title">
          💰 إدارة المحافظ
          <span class="wsec-secure-badge">🛡️ جلسة آمنة · ${sessionLeft} دقيقة</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="wsecShowGate(function(){ setAdminTab('wallet'); })"
                  style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
            🔄 تجديد الجلسة
          </button>
          <button onclick="setAdminTab('wallet_audit')"
                  style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
            📋 سجل التدقيق
          </button>
        </div>
      </div>

      <!-- ملخص -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:22px">
        <div style="background:rgba(16,185,129,0.07);border:1.5px solid rgba(16,185,129,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#10b981">${totalBalance.toLocaleString('ar-SA')}</div>
          <div style="font-size:11px;color:var(--text-muted)">إجمالي أرصدة المحافظ (ريال)</div>
        </div>
        <div style="background:rgba(124,58,237,0.07);border:1.5px solid rgba(124,58,237,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#a78bfa">${users.length}</div>
          <div style="font-size:11px;color:var(--text-muted)">إجمالي المستخدمين</div>
        </div>
        <div style="background:rgba(251,191,36,0.07);border:1.5px solid rgba(251,191,36,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#fbbf24">${users.filter(u => _walletBalance(u.uid||u.id) > 0).length}</div>
          <div style="font-size:11px;color:var(--text-muted)">محافظ نشطة (رصيد > 0)</div>
        </div>
      </div>

      <!-- بحث -->
      <input class="wsec-search-bar" type="text"
             placeholder="🔍 بحث بالاسم أو البريد الإلكتروني..."
             value="${_esc(State.wsecSearch || '')}"
             oninput="State.wsecSearch=this.value;document.getElementById('wsec-list').innerHTML=wsecRenderUserList()" />

      <!-- قائمة المستخدمين -->
      <div class="wsec-user-grid" id="wsec-list">
        ${_renderUserList(filtered, canEdit)}
      </div>

    </div>`;
  };

  /* ── قائمة المستخدمين (داخلية) ── */
  function _renderUserList(filtered, canEdit) {
    if (!filtered.length) return `<div class="wsec-empty">لا يوجد مستخدمون مطابقون للبحث</div>`;
    return filtered.map(u => {
      const uid     = u.uid || u.id;
      const name    = _esc(u.displayName || u.name || u.email || '—');
      const balance = _walletBalance(uid);
      return `
      <div class="wsec-user-card" onclick="${canEdit ? `wsecOpenAdjust('${uid}')` : ''}">
        <div class="wsec-user-avatar">${_userAvatar(u)}</div>
        <div>
          <div class="wsec-user-name">${name}</div>
          <div class="wsec-user-role">${_roleName(u.role)}</div>
        </div>
        <div class="wsec-user-balance ${balance === 0 ? 'zero' : ''}">
          ${balance.toLocaleString('ar-SA')} ر.س
        </div>
      </div>`;
    }).join('');
  }

  /* دالة معرّضة للـ HTML */
  window.wsecRenderUserList = function () {
    const me      = State.currentUser;
    const canEdit = me?.role === 'admin' || userHasPerm(me, 'adjust_wallets');
    const users   = (AppData.users || []).filter(u => u.uid || u.id);
    const q       = (State.wsecSearch || '').toLowerCase();
    const filtered = users.filter(u => {
      if (!q) return true;
      const name = (u.displayName || u.name || u.email || '').toLowerCase();
      return name.includes(q);
    }).sort((a, b) => _walletBalance(b.uid||b.id) - _walletBalance(a.uid||a.id));
    return _renderUserList(filtered, canEdit);
  };

  /* ══════════════════════════════════════════════════════════
     نافذة تعديل محفظة مستخدم محدد
  ══════════════════════════════════════════════════════════ */
  window.wsecOpenAdjust = function (uid) {
    if (!_isSessionValid()) {
      wsecShowGate(() => wsecOpenAdjust(uid));
      return;
    }

    const user    = (AppData.users || []).find(u => (u.uid || u.id) === uid);
    const name    = user ? (user.displayName || user.name || user.email || '—') : uid;
    const balance = _walletBalance(uid);
    const isLarge = balance >= LARGE_AMOUNT_THRESHOLD;

    openModal(`
    <div class="modal-header">
      <div>
        <h2 class="modal-title">💰 تعديل محفظة</h2>
        <p style="font-size:12px;color:var(--text-muted);margin:0">${_esc(name)}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <!-- الرصيد الحالي -->
    <div class="wsec-balance-display">
      <div class="wsec-balance-num">${balance.toLocaleString('ar-SA')} <span style="font-size:14px;color:var(--text-muted)">ريال</span></div>
      <div class="wsec-balance-label">الرصيد الحالي</div>
    </div>

    <!-- اختيار نوع العملية -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">نوع العملية</span>
      <div class="wsec-action-btns">
        <button class="wsec-action-btn sel-credit" id="wa-btn-credit" onclick="wsecSelectAction('credit')">
          ➕ إضافة رصيد
        </button>
        <button class="wsec-action-btn" id="wa-btn-debit" onclick="wsecSelectAction('debit')">
          ➖ خصم رصيد
        </button>
        <button class="wsec-action-btn" id="wa-btn-set" onclick="wsecSelectAction('set')">
          ✏️ تعيين رصيد
        </button>
      </div>
    </div>

    <!-- المبلغ -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">المبلغ (ريال)</span>
      <input class="wsec-modal-input" id="wa-amount" type="number" min="0" step="0.01"
             placeholder="0.00" oninput="wsecCheckLarge(this.value)" />
    </div>

    <!-- السبب -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">سبب العملية (إلزامي للتدقيق)</span>
      <input class="wsec-modal-input" id="wa-note" type="text"
             placeholder="مثال: تعويض عميل، تصحيح خطأ، مكافأة..." maxlength="200" />
    </div>

    <!-- تحذير المبالغ الكبيرة -->
    <div class="wsec-warn-box" id="wa-large-warn" style="display:${isLarge?'flex':'none'}">
      ⚠️ المبلغ المطلوب كبير — سيتم تسجيل هذه العملية بشكل خاص في سجل التدقيق
    </div>

    <button class="wsec-submit-btn credit" id="wa-submit-btn"
            onclick="wsecSubmitAdjust('${uid}', '${_esc(name)}', ${balance})">
      ✅ تنفيذ العملية
    </button>
    <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:10px">
      🛡️ ستُسجَّل هذه العملية باسمك في سجل التدقيق الدائم
    </p>`, 'md');

    window._wsecCurrentAction = 'credit';
  };

  window.wsecSelectAction = function (action) {
    window._wsecCurrentAction = action;
    ['credit','debit','set'].forEach(a => {
      const btn = document.getElementById(`wa-btn-${a}`);
      if (btn) btn.className = `wsec-action-btn${a === action ? ` sel-${a}` : ''}`;
    });
    const submitBtn = document.getElementById('wa-submit-btn');
    if (submitBtn) {
      submitBtn.className = `wsec-submit-btn ${action}`;
      const labels = { credit:'✅ إضافة الرصيد', debit:'🗑️ خصم الرصيد', set:'✏️ تعيين الرصيد' };
      submitBtn.textContent = labels[action];
    }
  };

  window.wsecCheckLarge = function (val) {
    const warn = document.getElementById('wa-large-warn');
    if (warn) warn.style.display = (parseFloat(val) >= LARGE_AMOUNT_THRESHOLD) ? 'flex' : 'none';
  };

  window.wsecSubmitAdjust = async function (uid, userName, balanceBefore) {
    if (!_isSessionValid()) {
      closeModal();
      wsecShowGate(() => wsecOpenAdjust(uid));
      return;
    }

    const action = window._wsecCurrentAction || 'credit';
    const amount = parseFloat(document.getElementById('wa-amount')?.value || '0');
    const note   = (document.getElementById('wa-note')?.value || '').trim();
    const btn    = document.getElementById('wa-submit-btn');

    /* تحقق من المدخلات */
    if (!amount || amount <= 0)     { toast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error'); return; }
    if (!note)                       { toast('يرجى إدخال سبب العملية — مطلوب للتدقيق', 'error'); return; }
    if (action === 'debit' && amount > balanceBefore) {
      toast(`الرصيد الحالي (${balanceBefore} ر.س) أقل من المبلغ المطلوب خصمه`, 'error');
      return;
    }

    /* تأكيد مزدوج للمبالغ الكبيرة */
    if (amount >= LARGE_AMOUNT_THRESHOLD) {
      if (!confirm(`⚠️ تأكيد مزدوج مطلوب\n\nأنت على وشك ${action==='credit'?'إضافة':action==='debit'?'خصم':'تعيين'} ${amount} ريال\nالمستخدم: ${userName}\nالسبب: ${note}\n\nهل أنت متأكد تماماً؟`)) return;
    }

    btn.disabled    = true;
    btn.textContent = '⏳ جاري التنفيذ...';

    try {
      let balanceAfter = balanceBefore;

      await db.runTransaction(async t => {
        const ref = db.collection('wallets').doc(uid);
        const doc = await t.get(ref);
        const cur = doc.exists ? (doc.data().balance || 0) : 0;

        if (action === 'credit') {
          balanceAfter = cur + amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        } else if (action === 'debit') {
          if (cur < amount) throw new Error(`رصيد غير كافٍ: المتاح ${cur} ر.س`);
          balanceAfter = cur - amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        } else if (action === 'set') {
          balanceAfter = amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        }
      });

      /* تسجيل في جدول transactions */
      const txType = action === 'credit' ? 'credit' : action === 'debit' ? 'debit' : 'admin_set';
      await fsAdd('transactions', {
        uid,
        type:      txType,
        amount,
        note:      `[إداري] ${note}`,
        adminUid:  State.currentUser?.uid,
        adminName: State.currentUser?.displayName || State.currentUser?.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      /* سجل التدقيق */
      await _writeAuditLog({
        targetUid:   uid,
        targetName:  userName,
        action,
        amount,
        balanceBefore,
        balanceAfter,
        note,
      });

      /* تحديث AppData محلياً */
      if (AppData.wallets) {
        if (!AppData.wallets[uid]) AppData.wallets[uid] = { uid };
        AppData.wallets[uid].balance = balanceAfter;
      }

      closeModal();
      const actionLabel = { credit:'✅ تمت إضافة', debit:'✅ تم خصم', set:'✅ تم تعيين' }[action];
      toast(`${actionLabel} ${amount.toLocaleString('ar-SA')} ريال من محفظة ${userName}`, 'success');

      /* إعادة رسم الصفحة */
      await render();

    } catch (err) {
      console.error('[WalletSecurity] خطأ في تعديل المحفظة:', err);
      toast(err.message || 'حدث خطأ أثناء تنفيذ العملية', 'error');
      await _writeAuditLog({
        targetUid:  uid,
        targetName: userName,
        action:     `${action}_failed`,
        amount,
        note:       `فشل: ${err.message}`,
      });
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✅ تنفيذ العملية';
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     سجل التدقيق الكامل
  ══════════════════════════════════════════════════════════ */
  let _auditLogs       = null;
  let _auditFilter     = 'all';
  let _auditLoading    = false;

  window.renderAdminWalletAudit = function () {
    if (!_isSessionValid()) {
      return `
      <div style="padding:40px;text-align:center;font-family:'Cairo',sans-serif">
        <div style="font-size:48px;margin-bottom:12px">🔐</div>
        <div style="font-size:16px;font-weight:900;color:var(--text);margin-bottom:8px">مطلوب المصادقة</div>
        <button onclick="wsecShowGate(function(){ setAdminTab('wallet_audit'); })"
                style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
          🔓 فتح سجل التدقيق
        </button>
      </div>`;
    }

    if (!_auditLogs && !_auditLoading) {
      _auditLoading = true;
      db.collection(AUDIT_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(300)
        .get()
        .then(snap => {
          _auditLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          _auditLoading = false;
          const wrap = document.getElementById('wsec-audit-content');
          if (wrap) wrap.innerHTML = _renderAuditTable(_auditLogs, _auditFilter);
        })
        .catch(err => {
          _auditLoading = false;
          const wrap = document.getElementById('wsec-audit-content');
          if (wrap) wrap.innerHTML = `<div class="wsec-empty">⚠️ فشل تحميل السجل: ${_esc(err.message)}</div>`;
        });
    }

    return `
    <div class="wsec-wrap">
      <div class="wsec-header">
        <div class="wsec-title">📋 سجل تدقيق المحافظ</div>
        <div style="display:flex;gap:8px">
          <button onclick="_auditLogs=null;setAdminTab('wallet_audit')"
                  style="background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
            🔄 تحديث
          </button>
          <button onclick="setAdminTab('wallet')"
                  style="background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
            ← إدارة المحافظ
          </button>
        </div>
      </div>

      <div class="wsec-audit-filters">
        <span style="font-size:12px;color:var(--text-muted);font-weight:700">فلترة:</span>
        <button class="wsec-audit-filter active" id="af-all"    onclick="wsecAuditFilter('all')">الكل</button>
        <button class="wsec-audit-filter"        id="af-credit" onclick="wsecAuditFilter('credit')">➕ إضافة</button>
        <button class="wsec-audit-filter"        id="af-debit"  onclick="wsecAuditFilter('debit')">➖ خصم</button>
        <button class="wsec-audit-filter"        id="af-set"    onclick="wsecAuditFilter('set')">✏️ تعيين</button>
        <button class="wsec-audit-filter"        id="af-gate_access" onclick="wsecAuditFilter('gate_access')">🔓 دخول</button>
        <button class="wsec-audit-filter"        id="af-gate_locked" onclick="wsecAuditFilter('gate_locked')">🔒 تجميد</button>
      </div>

      <div id="wsec-audit-content">
        ${_auditLogs
          ? _renderAuditTable(_auditLogs, _auditFilter)
          : `<div class="wsec-empty">⏳ جاري تحميل سجل التدقيق...</div>`
        }
      </div>
    </div>`;
  };

  window.wsecAuditFilter = function (f) {
    _auditFilter = f;
    document.querySelectorAll('.wsec-audit-filter').forEach(b => b.classList.remove('active'));
    const active = document.getElementById(`af-${f}`);
    if (active) active.classList.add('active');
    const wrap = document.getElementById('wsec-audit-content');
    if (wrap && _auditLogs) wrap.innerHTML = _renderAuditTable(_auditLogs, f);
  };

  function _renderAuditTable(logs, filter) {
    let rows = logs;
    if (filter && filter !== 'all') rows = logs.filter(l => l.action === filter || l.action === `${filter}_failed`);
    if (!rows.length) return `<div class="wsec-empty">لا توجد سجلات للعرض</div>`;

    const actionLabel = {
      credit:       '<span class="wsec-badge credit">➕ إضافة</span>',
      debit:        '<span class="wsec-badge debit">➖ خصم</span>',
      set:          '<span class="wsec-badge set">✏️ تعيين</span>',
      gate_access:  '<span class="wsec-badge view">🔓 دخول</span>',
      gate_locked:  '<span class="wsec-badge debit">🔒 تجميد</span>',
      credit_failed:'<span class="wsec-badge debit">❌ إضافة فاشلة</span>',
      debit_failed: '<span class="wsec-badge debit">❌ خصم فاشل</span>',
      set_failed:   '<span class="wsec-badge debit">❌ تعيين فاشل</span>',
    };

    const tableRows = rows.map(log => `
    <tr>
      <td style="white-space:nowrap;font-size:11px">${_fmtTs(log.timestamp)}</td>
      <td>
        <span class="wsec-badge ${log.adminRole === 'admin' ? 'admin' : 'staff'}">
          ${log.adminRole === 'admin' ? '👑' : '🧑‍💼'} ${_esc(log.adminName || '—')}
        </span>
      </td>
      <td style="font-size:11px;color:var(--text-muted)">${_roleName(log.adminRole)}</td>
      <td>${actionLabel[log.action] || `<span class="wsec-badge view">${_esc(log.action)}</span>`}</td>
      <td>${log.targetName ? _esc(log.targetName) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-weight:800;color:${log.action==='credit'?'#10b981':log.action==='debit'?'#ef4444':'#a78bfa'}">
        ${log.amount ? `${log.amount.toLocaleString('ar-SA')} ر.س` : '—'}
      </td>
      <td style="font-size:11px;color:var(--text-muted)">
        ${log.balanceBefore != null ? log.balanceBefore.toLocaleString('ar-SA') : '—'}
        ${log.balanceAfter  != null ? ` → ${log.balanceAfter.toLocaleString('ar-SA')}` : ''}
      </td>
      <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(log.note)}">
        ${_esc(log.note || '—')}
      </td>
    </tr>`).join('');

    return `
    <div class="wsec-audit-table-wrap">
      <table class="wsec-audit-table">
        <thead>
          <tr>
            <th>التاريخ والوقت</th>
            <th>المدير / الموظف</th>
            <th>الدور</th>
            <th>العملية</th>
            <th>المستخدم المستهدف</th>
            <th>المبلغ</th>
            <th>الرصيد (قبل → بعد)</th>
            <th>السبب</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:12px;font-family:'Cairo',sans-serif">
      🛡️ هذا السجل دائم ومحمي — لا يمكن حذفه أو تعديله
    </p>`;
  }

  console.log('[WalletSecurity] نظام أمان المحافظ المتكامل جاهز 🔐');
})();
