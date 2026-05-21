/* ============================================================
   phase27.js — Professional Ads Management System (Simplified)
   ============================================================ */

// Translations
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('ads_management', 'إدارة الإعلانات', 'Ads Management');
  add('ad_type_banner', 'بانر', 'Banner');
  add('ad_type_popup', 'نافذة منبثقة', 'Popup');
  add('ad_type_slider', 'شريط التمرير', 'Slider');
  add('ad_type_interstitial', 'بيني', 'Interstitial');
  add('ad_type_native', 'مدمج', 'Native');
  add('ad_status_active', 'نشط', 'Active');
  add('ad_status_paused', 'متوقف', 'Paused');
  add('ad_status_expired', 'منتهي', 'Expired');
  add('ad_status_draft', 'مسودة', 'Draft');
  add('ad_impressions', 'المشاهدات', 'Impressions');
  add('ad_clicks', 'النقرات', 'Clicks');
  add('ad_ctr', 'نسبة النقر', 'CTR');
  add('ad_budget', 'الميزانية', 'Budget');
  add('ad_spent', 'المُنفق', 'Spent');
  add('ad_targeting', 'الاستهداف', 'Targeting');
  add('ad_priority', 'الأولوية', 'Priority');
  add('create_ad', 'إنشاء إعلان', 'Create Ad');
  add('edit_ad', 'تعديل إعلان', 'Edit Ad');
  add('duplicate_ad', 'نسخ الإعلان', 'Duplicate Ad');
  add('pause_ad', 'إيقاف مؤقت', 'Pause Ad');
  add('activate_ad', 'تفعيل', 'Activate Ad');
  add('delete_ad', 'حذف الإعلان', 'Delete Ad');
  add('confirm_delete_ad', 'هل أنت متأكد من حذف هذا الإعلان؟', 'Are you sure?');
  add('no_ads', 'لا توجد إعلانات', 'No ads');
  add('create_first_ad', 'أنشئ أول إعلان لك', 'Create your first ad');
})();

// Ad Types
const AD_TYPES = {
  banner: { icon: '🟦', label: 'Banner', width: 728, height: 90 },
  popup: { icon: '🎯', label: 'Popup', width: 400, height: 300 },
  slider: { icon: '🎠', label: 'Slider', width: 320, height: 100 },
  interstitial: { icon: '📱', label: 'Interstitial', width: 320, height: 480 },
  native: { icon: '📝', label: 'Native', width: 300, height: 250 }
};

// Helper function
function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Main Render Function
window.renderAdminAds = function() {
  try {
    if (typeof AppData === 'undefined' || !AppData.ads) {
      return '<div style="padding:40px;text-align:center;color:var(--text-muted)">جاري تحميل البيانات...</div>';
    }
    
    const ads = AppData.ads || [];
    const searchQuery = (State.adminSearch || '').toLowerCase();
    
    const filteredAds = searchQuery 
      ? ads.filter(a => (a.title || '').toLowerCase().includes(searchQuery))
      : ads;
    
    const totals = {
      active: ads.filter(a => a.status === 'active').length,
      paused: ads.filter(a => a.status === 'paused').length,
      totalViews: ads.reduce((sum, a) => sum + (a.impressions || 0), 0),
      totalClicks: ads.reduce((sum, a) => sum + (a.clicks || 0), 0)
    };
    
    let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">';
    html += '<div style="display:flex;align-items:center;gap:12px"><h2>📢 ' + (I18N.ar.ads_management || 'Ads Management') + '</h2><span class="badge badge-teal">' + totals.active + ' نشط</span></div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    html += '<input type="text" class="form-control" id="admin-ads-search" placeholder="🔍 ابحث..." value="' + (State.adminSearch || '') + '" oninput="State.adminSearch=this.value;render();" style="width:250px">';
    html += '<button class="btn btn-primary" onclick="ph27_showCreateAdModal()">➕ إنشاء إعلان</button>';
    html += '</div></div>';
    
    // Stats Cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += '<div class="stat-card"><div class="stat-num" style="color:#10b981">' + totals.active + '</div><div class="stat-label">نشط</div></div>';
    html += '<div class="stat-card"><div class="stat-num" style="color:#f59e0b">' + totals.paused + '</div><div class="stat-label">متوقف</div></div>';
    html += '<div class="stat-card"><div class="stat-num" style="color:#3b82f6">' + totals.totalViews.toLocaleString() + '</div><div class="stat-label">المشاهدات</div></div>';
    html += '<div class="stat-card"><div class="stat-num" style="color:#8b5cf6">' + totals.totalClicks.toLocaleString() + '</div><div class="stat-label">النقرات</div></div>';
    html += '</div>';
    
    if (filteredAds.length > 0) {
      html += '<div class="table-wrap"><table class="admin-table"><thead><tr><th>العنوان</th><th>النوع</th><th>الميزانية</th><th>المشاهدات</th><th>النقرات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
      
      for (const a of filteredAds) {
        const ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : 0;
        const statusColor = { active: 'badge-teal', paused: 'badge-gold', expired: 'badge-rose', draft: 'badge-purple' }[a.status] || 'badge-purple';
        const statusIcon = { active: '🔴', paused: '⏸️', expired: '❌', draft: '📝' }[a.status] || '📝';
        
        html += '<tr>';
        html += '<td style="font-weight:600">' + escHtml(a.title) + '</td>';
        html += '<td><span class="badge badge-purple">' + (AD_TYPES[a.type]?.icon || '📢') + ' ' + (I18N.ar['ad_type_' + a.type] || a.type) + '</span></td>';
        html += '<td style="font-weight:600;color:#10b981">' + ((a.budget || 0).toLocaleString()) + ' ر</td>';
        html += '<td>' + ((a.impressions || 0).toLocaleString()) + '</td>';
        html += '<td><span style="font-weight:600">' + ((a.clicks || 0).toLocaleString()) + '</span> <span style="font-size:11px;color:#8b5cf6">(' + ctr + '%)</span></td>';
        html += '<td><span class="badge ' + statusColor + '">' + statusIcon + ' ' + (I18N.ar['ad_status_' + a.status] || a.status) + '</span></td>';
        html += '<td>';
        html += '<div style="display:flex;gap:4px">';
        html += '<button class="btn btn-sm btn-secondary" onclick="ph27_showEditAdModal(\'' + a.id + '\')" title="تعديل">✏️</button>';
        
        if (a.status === 'active') {
          html += '<button class="btn btn-sm btn-warning" onclick="ph27_toggleStatus(\'' + a.id + '\', \'paused\')" title="إيقاف">⏸️</button>';
        } else {
          html += '<button class="btn btn-sm btn-success" onclick="ph27_toggleStatus(\'' + a.id + '\', \'active\')" title="تفعيل">▶️</button>';
        }
        
        html += '<button class="btn btn-sm btn-danger" onclick="ph27_deleteAd(\'' + a.id + '\')" title="حذف">🗑️</button>';
        html += '</div></td></tr>';
      }
      
      html += '</tbody></table></div>';
    } else {
      html += '<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-title">لا توجد إعلانات</div><button class="btn btn-primary" onclick="ph27_showCreateAdModal()">➕ إنشاء إعلان</button></div>';
    }
    
    return html;
  } catch (err) {
    console.error('[Phase 27] Error:', err);
    return '<div style="padding:40px;text-align:center;color:red">خطأ: ' + err.message + '</div>';
  }
};

// Show Create/Edit Modal
window.ph27_showCreateAdModal = function(adId) {
  const ad = adId ? (AppData.ads || []).find(a => a.id === adId) : null;
  const isEdit = !!ad;
  
  let html = '<div class="modal-header"><h2 class="modal-title">' + (isEdit ? '✏️ تعديل' : '➕ إنشاء') + ' إعلان</h2><button class="modal-close" onclick="closeModal()">✕</button></div>';
  html += '<div style="max-height:70vh;overflow-y:auto;padding:4px">';
  html += '<div class="form-group"><label class="form-label">العنوان *</label><input class="form-control" id="ph27-title" value="' + escHtml(ad?.title || '') + '" placeholder="عنوان الإعلان"></div>';
  html += '<div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="ph27-desc" rows="3">' + escHtml(ad?.description || '') + '</textarea></div>';
  
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  html += '<div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="ph27-type">';
  for (const [k, v] of Object.entries(AD_TYPES)) {
    html += '<option value="' + k + '"' + (ad?.type === k ? ' selected' : '') + '>' + v.icon + ' ' + v.label + '</option>';
  }
  html += '</select></div>';
  
  html += '<div class="form-group"><label class="form-label">الميزانية</label><input class="form-control" id="ph27-budget" type="number" value="' + (ad?.budget || 0) + '"></div>';
  html += '</div>';
  
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  html += '<div class="form-group"><label class="form-label">تاريخ البدء</label><input class="form-control" id="ph27-start" type="date" value="' + (ad?.startDate || '').split('T')[0] + '"></div>';
  html += '<div class="form-group"><label class="form-label">تاريخ الانتهاء</label><input class="form-control" id="ph27-end" type="date" value="' + (ad?.endDate || '').split('T')[0] + '"></div>';
  html += '</div>';
  
  html += '<div class="form-group"><label class="form-label">الأولوية (1-10)</label><input class="form-control" id="ph27-priority" type="number" min="1" max="10" value="' + (ad?.priority || 5) + '"></div>';
  html += '<div class="form-group"><label class="form-label">رابط الإعلان</label><input class="form-control" id="ph27-url" value="' + escHtml(ad?.targetUrl || '') + '" placeholder="https://..."></div>';
  html += '<div class="form-group"><label class="form-label">صورة الإعلان</label><input class="form-control" id="ph27-img" type="file" accept="image/*"></div>';
  html += '</div>';
  
  html += '<div style="display:flex;gap:12px;margin-top:16px">';
  html += '<button class="btn btn-primary btn-block" onclick="ph27_saveAd(\'' + (adId || '') + '\')">' + (isEdit ? 'حفظ التغييرات' : 'إنشاء') + '</button>';
  html += '<button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>';
  html += '</div>';
  
  openModal(html);
};

// Save Ad
async function ph27_saveAd(adId) {
  const title = document.getElementById('ph27-title').value.trim();
  if (!title) { toast('أدخل العنوان', 'error'); return; }
  
  const data = {
    title: title,
    description: document.getElementById('ph27-desc').value.trim(),
    type: document.getElementById('ph27-type').value,
    budget: parseInt(document.getElementById('ph27-budget').value) || 0,
    startDate: document.getElementById('ph27-start').value,
    endDate: document.getElementById('ph27-end').value,
    priority: parseInt(document.getElementById('ph27-priority').value) || 5,
    targetUrl: document.getElementById('ph27-url').value.trim(),
    status: 'active',
    impressions: adId ? (AppData.ads.find(a => a.id === adId)?.impressions || 0) : 0,
    clicks: adId ? (AppData.ads.find(a => a.id === adId)?.clicks || 0) : 0,
    spent: adId ? (AppData.ads.find(a => a.id === adId)?.spent || 0) : 0
  };
  
  const file = document.getElementById('ph27-img')?.files[0];
  if (file) {
    data.imageBase64 = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
  }
  
  if (adId) {
    await fsUpdate('ads', adId, data);
    toast('تم التحديث', 'success');
  } else {
    await fsAdd('ads', data);
    toast('تم الإنشاء', 'success');
  }
  
  closeModal();
  await render();
}

// Toggle Status
window.ph27_toggleStatus = async function(adId, newStatus) {
  await fsUpdate('ads', adId, { status: newStatus });
  toast(newStatus === 'active' ? 'تم التفعيل' : 'تم الإيقاف', 'success');
  await render();
};

// Delete Ad
window.ph27_deleteAd = async function(adId) {
  if (!confirm('حذف هذا الإعلان؟')) return;
  await fsDelete('ads', adId);
  toast('تم الحذف', 'success');
  await render();
};

// Edit Modal shortcut
window.ph27_showEditAdModal = function(adId) {
  ph27_showCreateAdModal(adId);
};

console.log('[Phase 27] Professional Ads System loaded.');