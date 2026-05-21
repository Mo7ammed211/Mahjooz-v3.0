/* ============================================================
   phase34.js — خدمة المشاركة (Share Service)
   ============================================================ */

(function () {
  if (typeof I18N === 'undefined') return;

  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };

  add('share', 'مشاركة', 'Share');
  add('share_service', 'مشاركة الخدمة', 'Share Service');
  add('share_via', 'مشاركة عبر', 'Share Via');
  add('copy_link', 'نسخ الرابط', 'Copy Link');
  add('link_copied', 'تم نسخ الرابط', 'Link Copied');
  add('share_whatsapp', 'مشاركة واتساب', 'Share WhatsApp');
  add('share_facebook', 'مشاركة فيسبوك', 'Share Facebook');
  add('share_twitter', 'مشاركة تويتر', 'Share Twitter');
  add('share_email', 'مشاركة بريد', 'Share Email');
  add('invite_friend', 'دعوة صديق', 'Invite Friend');
  add('invite_message', 'رؤية خدمة رائعة! جربها', 'Check out this amazing service!');

})();

// ============================================================
// Share Service
// ============================================================

window.ph34_shareService = async function(serviceId) {
  const s = AppData.services.find(svc => svc.id === serviceId);
  if (!s) return;
  
  const shareData = {
    title: s.name,
    text: `${s.name}\n${s.provider ? `مقدم: ${s.provider}\n` : ''}${s.price ? `السعر: ${s.price} ريال\n` : ''}${s.desc ? `${s.desc}\n` : ''}`,
    url: `${window.location.origin}?service=${serviceId}`
  };
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📤 ${I18N.ar.share_service}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div class="ph34-service-preview" style="background:var(--bg-card);padding:16px;border-radius:12px;margin-bottom:20px">
      <div style="font-size:32px;margin-bottom:8px">${s.icon || '🔷'}</div>
      <div style="font-weight:700;font-size:18px">${s.name}</div>
      ${s.provider ? `<div style="color:var(--text-muted)">${s.provider}</div>` : ''}
      ${s.price ? `<div style="font-size:20px;font-weight:800;color:var(--primary)">${s.price} ريال</div>` : ''}
    </div>
    
    <div class="ph34-share-options">
      <button class="ph34-share-btn" onclick="ph34_copyLink('${serviceId}')">
        <span style="font-size:24px">🔗</span>
        <span>${I18N.ar.copy_link}</span>
      </button>
      
      <button class="ph34-share-btn" style="background:#25d366" onclick="ph34_shareWhatsApp('${serviceId}')">
        <span style="font-size:24px">💬</span>
        <span>${I18N.ar.share_whatsapp}</span>
      </button>
      
      <button class="ph34-share-btn" style="background:#1877f2" onclick="ph34_shareFacebook('${serviceId}')">
        <span style="font-size:24px">📘</span>
        <span>${I18N.ar.share_facebook}</span>
      </button>
      
      <button class="ph34-share-btn" style="background:#1da1f2" onclick="ph34_shareTwitter('${serviceId}')">
        <span style="font-size:24px">🐦</span>
        <span>${I18N.ar.share_twitter}</span>
      </button>
      
      <button class="ph34-share-btn" style="background:#ea4335" onclick="ph34_shareEmail('${serviceId}')">
        <span style="font-size:24px">📧</span>
        <span>${I18N.ar.share_email}</span>
      </button>
    </div>
  `);
};

window.ph34_copyLink = async function(serviceId) {
  const url = `${window.location.origin}?service=${serviceId}`;
  try {
    await navigator.clipboard.writeText(url);
    toast(I18N.ar.link_copied, 'success');
  } catch(e) {
    // Fallback
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    toast(I18N.ar.link_copied, 'success');
  }
};

window.ph34_shareWhatsApp = function(serviceId) {
  const s = AppData.services.find(svc => svc.id === serviceId);
  const text = `رؤية خدمة: ${s.name}\n${s.price ? `السعر: ${s.price} ريال\n` : ''}${s.desc ? `${s.desc}\n` : ''}\n${window.location.origin}?service=${serviceId}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.ph34_shareFacebook = function(serviceId) {
  const url = `${window.location.origin}?service=${serviceId}`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
};

window.ph34_shareTwitter = function(serviceId) {
  const s = AppData.services.find(svc => svc.id === serviceId);
  const text = `رؤية خدمة: ${s.name} - ${s.price || ''} ريال`;
  const url = `${window.location.origin}?service=${serviceId}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
};

window.ph34_shareEmail = function(serviceId) {
  const s = AppData.services.find(svc => svc.id === serviceId);
  const subject = `رؤية خدمة: ${s.name}`;
  const body = `مرحباً!\n\nرؤية هذه الخدمة المثيرة:\n\n${s.name}\n${s.provider ? `مقدم الخدمة: ${s.provider}\n` : ''}${s.price ? `السعر: ${s.price} ريال\n` : ''}${s.desc ? `الوصف: ${s.desc}\n` : ''}\nالرابط: ${window.location.origin}?service=${serviceId}\n\nتحياتي!`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
};

// ============================================================
// Render Share Button
// ============================================================

window.ph34_renderShareButton = function(serviceId, size = '') {
  return `<button class="ph34-share-btn-sm" onclick="ph34_shareService('${serviceId}')" style="background:none;border:none;font-size:${size === 'lg' ? '24px' : '18px'};cursor:pointer">📤</button>`;
};

// ============================================================
// Invite Friend ( Referral)
// ============================================================

window.ph34_inviteFriend = async function() {
  const referalCode = State.currentUser?.referralCode || ('REF' + Date.now().toString(36).toUpperCase());
  const url = `${window.location.origin}?ref=${referalCode}`;
  
  const text = `مرحباً!\n\nانضم لي في ${AppData.appName} - منصة الخدمات الرائدة!\n\nسجل عبر الرابط التالي واحصل على خصم:\n${url}\n\nتحياتي!`;
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">👥 ${I18N.ar.invite_friend}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div style="text-align:center;padding:20px">
      <div style="font-size:48px;margin-bottom:16px">🎁</div>
      <p style="margin-bottom:16px">دعوةصديق واستلمما بعد أول طلب!</p>
      
      <div style="background:var(--bg-card);padding:16px;border-radius:12px;margin:20px 0">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">رابط الدعوة</div>
        <div style="font-size:18px;font-weight:700;word-break:break-all">${url}</div>
      </div>
      
      <button class="btn btn-primary btn-block" onclick="ph34_copyLink('${referalCode}')">
        🔗 ��سخ ��لرابط
      </button>
      
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-secondary" style="flex:1;background:#25d366" onclick="window.open('https://wa.me/?text=${encodeURIComponent(text)}','_blank')">
          💬 واتساب
        </button>
      </div>
    </div>
  `);
};

// ============================================================
// Add Styles
// ============================================================

(function() {
  if (window.ph34_stylesAdded) return;
  window.ph34_stylesAdded = true;
  
  const style = document.createElement('style');
  style.textContent = `
    .ph34-share-options { display: flex; flex-direction: column; gap: 8px; }
    .ph34-share-btn { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #8b5cf6; border: none; border-radius: 12px; color: #fff; font-weight: 600; cursor: pointer; transition: transform 0.2s; text-align: start; }
    .ph34-share-btn:hover { transform: translateX(4px); }
    .ph34-share-btn-sm { }
  `;
  document.head.appendChild(style);
})();

console.log('[Phase 34] Share Service System loaded');