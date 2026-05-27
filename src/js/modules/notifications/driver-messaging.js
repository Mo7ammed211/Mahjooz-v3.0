/* ============================================================
   Driver Messaging — مراسلة المندوبين من المدير
   ------------------------------------------------------------
   يمكّن المدير/الموظف من إرسال رسائل فورية لأي مندوب
   مرتبط بحساب مستخدم (linkedUserId). الرسالة تُكتب في
   مجموعة Firestore `driver_messages` ويلتقطها
   driver-alerts.js على جهاز المندوب فوراً.

   واجهات عامة:
     adminSendDriverMessage(uid, name)   — modal الإرسال
     adminViewDriverMessages(uid, name)  — سجل المحادثة
   ============================================================ */
(function () {
  'use strict';

  const COL = 'driver_messages';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }
  function fmtDT(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
      return d.toLocaleString('ar', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    } catch (e) { return ''; }
  }

  /* ══════════════════════════════════════════════════
     Modal الإرسال
  ══════════════════════════════════════════════════ */
  window.adminSendDriverMessage = function (uid, name) {
    if (!uid) { toast('المندوب غير مرتبط بحساب مستخدم — لا يمكن الإرسال', 'error'); return; }

    openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📨 مراسلة المندوب</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px;font-family:'Cairo',sans-serif">

      <!-- مستلم -->
      <div style="display:flex;align-items:center;gap:12px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 14px">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0">
          ${esc((name||'م').charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:var(--text-main)">${esc(name||'المندوب')}</div>
          <div style="font-size:11px;color:var(--text-muted)">🚚 مندوب توصيل</div>
        </div>
      </div>

      <!-- نص الرسالة -->
      <div>
        <label style="font-size:13px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px">نص الرسالة <span style="color:#ef4444">*</span></label>
        <textarea id="dm-msg-text" rows="4"
          style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:12px;background:var(--glass-bg);color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;resize:vertical;box-sizing:border-box;transition:border-color 0.2s;direction:rtl"
          placeholder="اكتب رسالتك هنا... مثال: تم تعيين طلب جديد لك، يرجى التحرك فوراً"
          onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      </div>

      <!-- قوالب سريعة -->
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">📋 رسائل سريعة:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${[
            ['🚀 تحرك فوراً','يرجى التحرك فوراً لاستلام الطلب المعيّن'],
            ['📍 تأكيد موقعك','يرجى تأكيد موقعك الحالي والمسافة المتوقعة'],
            ['⚠️ تنبيه عاجل','تنبيه عاجل من الإدارة — يرجى التواصل الفوري'],
            ['✅ طلب جاهز','الطلب جاهز لدى المزود — يمكنك الانتقال للاستلام'],
          ].map(([label, text]) => `
          <button onclick="document.getElementById('dm-msg-text').value='${text.replace(/'/g,"&#39;")}'"
            style="background:rgba(139,92,246,0.07);border:1px solid rgba(139,92,246,0.2);color:var(--primary);border-radius:20px;padding:5px 10px;font-size:12px;font-family:'Cairo',sans-serif;cursor:pointer;font-weight:600">
            ${esc(label)}
          </button>`).join('')}
        </div>
      </div>

      <!-- أزرار الإجراء -->
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" id="dm-send-btn" onclick="adminSendDriverMessageSubmit('${uid}','${esc(name||'')}')">
          📨 إرسال الآن
        </button>
      </div>

      <!-- سجل المحادثة (يُحمّل بعد الفتح) -->
      <div id="dm-history" style="margin-top:4px"></div>
    </div>`);

    _loadDMHistory(uid);
  };

  /* ══════════════════════════════════════════════════
     إرسال الرسالة
  ══════════════════════════════════════════════════ */
  window.adminSendDriverMessageSubmit = async function (toUid, toName) {
    const msg = document.getElementById('dm-msg-text')?.value?.trim();
    if (!msg) { toast('الرجاء كتابة نص الرسالة', 'error'); return; }

    const btn = document.getElementById('dm-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...'; }

    try {
      const u = window.State?.currentUser;
      await db.collection(COL).add({
        toUid,
        toName:   toName || 'المندوب',
        fromUid:  u?.uid  || 'admin',
        fromName: u?.name || u?.email || 'الإدارة',
        message:  msg,
        read:     false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      toast('تم إرسال الرسالة للمندوب بنجاح ✅', 'success');
      document.getElementById('dm-msg-text').value = '';
      _loadDMHistory(toUid);
    } catch (e) {
      console.error('[DM] send error', e);
      toast('فشل الإرسال: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📨 إرسال الآن'; }
    }
  };

  /* ══════════════════════════════════════════════════
     سجل المحادثة (آخر 15 رسالة)
  ══════════════════════════════════════════════════ */
  async function _loadDMHistory(toUid) {
    const el = document.getElementById('dm-history');
    if (!el) return;
    el.innerHTML = `<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:12px">⏳ جاري تحميل السجل...</div>`;
    try {
      const snap = await db.collection(COL)
        .where('toUid','==',toUid)
        .orderBy('createdAt','desc')
        .limit(15)
        .get();

      if (snap.empty) {
        el.innerHTML = `<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:12px">لا توجد رسائل سابقة</div>`;
        return;
      }

      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() })).reverse();
      el.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">📜 الرسائل السابقة (${rows.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto">
            ${rows.map(r => `
            <div style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.15);border-radius:10px;padding:10px 12px;position:relative">
              <div style="font-size:13px;color:var(--text-main);line-height:1.5">${esc(r.message)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                <span style="font-size:10px;color:var(--text-muted)">من: ${esc(r.fromName||'الإدارة')}</span>
                <span style="font-size:10px;color:var(--text-muted)">${fmtDT(r.createdAt)}</span>
              </div>
              ${r.read ? `<span style="position:absolute;top:8px;left:10px;font-size:10px;color:#10b981">✓ مقروءة</span>` : ''}
            </div>`).join('')}
          </div>
        </div>`;
    } catch (e) {
      el.innerHTML = `<div style="text-align:center;padding:10px;color:#ef4444;font-size:12px">⚠️ ${esc(e.message)}</div>`;
    }
  }

  /* ══════════════════════════════════════════════════
     عرض سجل رسائل مندوب (standalone)
  ══════════════════════════════════════════════════ */
  window.adminViewDriverMessages = function (uid, name) {
    openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📜 سجل رسائل المندوب — ${esc(name||'')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div id="dm-history-standalone" style="padding:16px;max-height:70vh;overflow-y:auto;font-family:'Cairo',sans-serif">
      <div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ جاري التحميل...</div>
    </div>`, 'medium');

    (async () => {
      const el = document.getElementById('dm-history-standalone');
      if (!el) return;
      try {
        const snap = await db.collection(COL).where('toUid','==',uid).orderBy('createdAt','desc').limit(30).get();
        if (snap.empty) { el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted)">لا توجد رسائل مرسلة لهذا المندوب</div>`; return; }
        const rows = snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${rows.map(r=>`
        <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;padding:12px 14px">
          <div style="font-size:14px;color:var(--text-main);line-height:1.6">${esc(r.message)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:4px">
            <span style="font-size:11px;color:var(--text-muted)">👤 ${esc(r.fromName||'الإدارة')}</span>
            <div style="display:flex;gap:8px;align-items:center">
              ${r.read ? `<span style="font-size:11px;color:#10b981">✓ مقروءة</span>` : `<span style="font-size:11px;color:var(--text-muted)">○ لم تُقرأ</span>`}
              <span style="font-size:11px;color:var(--text-muted)">${fmtDT(r.createdAt)}</span>
            </div>
          </div>
        </div>`).join('')}</div>`;
      } catch (e) {
        el.innerHTML = `<div style="padding:20px;color:#ef4444;text-align:center">${esc(e.message)}</div>`;
      }
    })();
  };

  console.log('[DriverMessaging] نظام مراسلة المندوبين جاهز 📨');
})();
