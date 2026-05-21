/* phase24.js - User Phone and Email Verification System */

let VerificationState = {
  type: null,
  pendingOTP: null,
  targetValue: null
};

window.startVerification = function(type) {
  const u = State.currentUser;
  if (!u) return;

  VerificationState.type = type;
  
  if (type === 'phone' && !u.phone) {
    toast('يرجى إضافة رقم الجوال في ملفك الشخصي أولاً', 'error');
    return;
  }
  if (type === 'email' && !u.email) {
    toast('حسابك لا يحتوي على بريد إلكتروني', 'error');
    return;
  }

  // Generate 4 digit OTP
  VerificationState.pendingOTP = String(Math.floor(1000 + Math.random() * 9000));
  VerificationState.targetValue = type === 'phone' ? u.phone : u.email;

  // Simulate sending
  showLoader('جاري إرسال رمز التحقق...');
  
  setTimeout(() => {
    hideLoader();
    const typeLabel = type === 'phone' ? 'رسالة نصية (SMS)' : 'البريد الإلكتروني';
    
    // Test helper toast
    toast(`تم إرسال الرمز عبر ${typeLabel}. (للاختبار الرمز هو: ${VerificationState.pendingOTP})`, 'info');
    
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">🔐 توثيق الحساب</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="text-align:center; padding: 20px 0;">
        <p style="color:var(--text-secondary); margin-bottom:20px;">
          الرجاء إدخال رمز التحقق المكون من 4 أرقام المرسل إلى:
          <br><strong style="color:var(--text-primary); font-size:18px;">${VerificationState.targetValue}</strong>
        </p>
        <div class="form-group">
          <input id="verification-otp-input" class="form-control" type="number" placeholder="••••" style="text-align:center; font-size:24px; letter-spacing:8px; font-weight:bold" maxlength="4">
        </div>
        <button class="btn btn-primary btn-block btn-lg" onclick="confirmVerificationOTP()" style="margin-top:20px">
          تأكيد الرمز
        </button>
        <p id="verification-error" style="color:var(--rose); margin-top:12px; display:none;">❌ الرمز غير صحيح، حاول مجدداً</p>
      </div>
    `);
  }, 1000);
};

window.confirmVerificationOTP = async function() {
  const input = document.getElementById('verification-otp-input').value.trim();
  const err = document.getElementById('verification-error');
  
  if (input !== VerificationState.pendingOTP) {
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  showLoader('جاري تحديث حالة التوثيق...');

  try {
    const u = State.currentUser;
    const field = VerificationState.type === 'phone' ? 'phoneVerified' : 'emailVerified';
    
    await fsUpdate('users', u.uid, { [field]: true });
    
    // Update local state
    State.currentUser[field] = true;
    
    hideLoader();
    closeModal();
    toast('✅ تم التوثيق بنجاح!', 'success');
    
    // Refresh settings page
    if (State.currentPage === 'settings') {
      await render();
    }
  } catch (error) {
    hideLoader();
    console.error(error);
    toast('حدث خطأ أثناء حفظ التوثيق', 'error');
  }
};

// Check Account Activation
window.checkAccountActive = function() {
  const u = State.currentUser;
  if (!u) return false;
  // Admin, staff, and guest are always considered active
  if (['admin', 'staff', 'guest'].includes(u.role)) return true;
  // Quick-demo users (no uid in db) are always active
  if (!u.uid) return true;

  if (u.isActive === false) {
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">⏳ حسابك قيد المراجعة</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="text-align:center; padding: 24px 0;">
        <div style="font-size:64px; margin-bottom:16px">🔐</div>
        <h3 style="margin-bottom:12px">عذراً، لا يمكنك الوصول لهذه الخدمة</h3>
        <p style="color:var(--text-secondary); line-height:1.8; margin-bottom:20px">
          حسابك لم يُفعَّل بعد. يراجع فريق الإدارة بياناتك حالياً
          وسيصلك إشعار بمجرد تفعيل حسابك.
          <br><br>
          إذا طال الانتظار، يرجى التواصل مع الدعم.
        </p>
        <button class="btn btn-primary" onclick="closeModal()">حسناً، سأنتظر</button>
      </div>
    `);
    return false;
  }
  return true;
};

// Check Mandatory Verification
window.checkMandatoryVerification = function() {
  const u = State.currentUser;
  if (!u) return false;
  
  // Exclude admin and staff from mandatory verification
  if (['admin', 'staff', 'guest'].includes(u.role)) return true;

  // First check account is active
  if (!checkAccountActive()) return false;
  
  // Only phone verification is mandatory
  if (!u.phoneVerified) {
    toast('⚠️ عذراً، يجب توثيق رقم الجوال من الإعدادات لتتمكن من إتمام الطلب', 'error');
    navigate('settings');
    return false;
  }
  return true;
};
