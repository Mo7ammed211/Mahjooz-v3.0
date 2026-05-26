// ═══════════════════════════════════════════════════════════════
//  محجوز — Section Visibility & Maintenance Control System
//  نظام التحكم الكامل في أقسام وعناصر المنصة
// ═══════════════════════════════════════════════════════════════

(function () {
  const LS_KEY   = 'sv_config_v2';
  const FS_DOC   = 'section_visibility';
  const FS_COL   = 'platform_config';

  const DEFAULTS = {
    hero: true,
    ads: true,
    bookings: true,       bookings_maint: false, bookings_maint_msg: 'قسم الحجوزات تحت الصيانة حالياً، نعود قريباً 🔧',
    services: true,       services_maint: false, services_maint_msg: 'قسم الخدمات المهنية تحت الصيانة، نعود قريباً 🔧',
    stores: true,         stores_maint:   false, stores_maint_msg:   'قسم المتاجر تحت الصيانة حالياً، نعود قريباً 🔧',
    digital: true,        digital_maint:  false, digital_maint_msg:  'قسم المتاجر الرقمية تحت الصيانة، نعود قريباً 🔧',
    offers: true,         offers_maint:   false, offers_maint_msg:   'قسم العروض تحت الصيانة حالياً، نعود قريباً 🔧',
    featured: true,
    full_maint: false,
    full_maint_msg: 'المنصة تحت الصيانة حالياً، نعود إليكم قريباً 🔧',
  };

  window.SV = {
    _data: { ...DEFAULTS },
    _loaded: false,

    async load() {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) {
        try { this._data = { ...DEFAULTS, ...JSON.parse(cached) }; } catch (e) { /* ignore */ }
      }
      try {
        const doc = await db.collection(FS_COL).doc(FS_DOC).get();
        if (doc.exists) {
          this._data = { ...DEFAULTS, ...doc.data() };
          localStorage.setItem(LS_KEY, JSON.stringify(this._data));
        }
      } catch (e) { console.warn('[SV] Firebase load failed, using cache:', e.message); }
      this._loaded = true;
      this._applyFullMaint();
    },

    get(key) {
      return this._data[key] ?? DEFAULTS[key] ?? true;
    },

    isVisible(key) {
      if (window.State?.currentUser?.role === 'admin') return true;
      return this._data[key] !== false;
    },

    isMaintenance(key) {
      if (window.State?.currentUser?.role === 'admin') return false;
      return !!this._data[key + '_maint'];
    },

    isAccessible(key) {
      if (window.State?.currentUser?.role === 'admin') return true;
      if (this._data[key] === false) return false;
      if (this._data[key + '_maint']) return false;
      return true;
    },

    maintenanceMsg(key) {
      return this._data[key + '_maint_msg'] || 'هذا القسم تحت الصيانة حالياً، نعود قريباً 🔧';
    },

    async set(key, value) {
      this._data[key] = value;
      localStorage.setItem(LS_KEY, JSON.stringify(this._data));
      try {
        await db.collection(FS_COL).doc(FS_DOC).set(this._data, { merge: true });
      } catch (e) { console.error('[SV] Save error:', e); showToast('خطأ في الحفظ: ' + e.message, 'error'); return; }
      this._applyFullMaint();
    },

    async toggle(key) {
      await this.set(key, !this._data[key]);
    },

    async setMsg(key, msg) {
      await this.set(key + '_maint_msg', msg);
    },

    _applyFullMaint() {
      const isAdmin = window.State?.currentUser?.role === 'admin';
      let overlay = document.getElementById('sv-full-maint-overlay');
      if (this._data.full_maint && !isAdmin) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'sv-full-maint-overlay';
          document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
          <div class="sv-maint-wrap">
            <div class="sv-maint-icon-wrap">
              <div class="sv-maint-glow"></div>
              <span class="sv-maint-icon">🔧</span>
            </div>
            <h2 class="sv-maint-title">المنصة تحت الصيانة</h2>
            <p class="sv-maint-msg">${escHtml ? escHtml(this._data.full_maint_msg || '') : (this._data.full_maint_msg || '')}</p>
            <div class="sv-maint-dots">
              <span></span><span></span><span></span>
            </div>
          </div>`;
      } else if (overlay) {
        overlay.remove();
      }
    },
  };

  // Auto-load after Firebase is ready
  const _tryLoad = () => {
    if (typeof db !== 'undefined') {
      window.SV.load();
    } else {
      setTimeout(_tryLoad, 400);
    }
  };
  setTimeout(_tryLoad, 600);

  // ─── Maintenance page helper ────────────────────────────────
  window.svMaintenancePage = function (key) {
    const msg = window.SV.maintenanceMsg(key);
    return `
    <div id="app-content" style="min-height:60vh;display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;padding:48px 24px;max-width:420px;margin:0 auto">
        <div style="font-size:64px;margin-bottom:20px;animation:sv-bounce 1.6s infinite">🔧</div>
        <h2 style="font-size:24px;font-weight:800;color:var(--text-main);margin-bottom:12px">قسم تحت الصيانة</h2>
        <p style="color:var(--text-secondary);font-size:15px;line-height:1.7;margin-bottom:32px">${msg}</p>
        <button class="btn btn-primary" onclick="navigate('home')" style="border-radius:99px;padding:12px 36px">
          ← العودة للرئيسية
        </button>
      </div>
    </div>`;
  };

  // ─── Admin Render Function ──────────────────────────────────
  window.renderAdminSectionVisibility = function () {
    const sv = window.SV;
    const d  = sv._data;

    const MAIN_SECTIONS = [
      { key: 'bookings', icon: '📅', label: 'الحجوزات',          desc: 'فنادق، قاعات ومرافق الحجز', color: '#8b5cf6' },
      { key: 'services', icon: '🔧', label: 'الخدمات المهنية',    desc: 'كهربائي، سباك، نجار وأكثر',  color: '#10b981' },
      { key: 'stores',   icon: '🏪', label: 'متاجر محجوز',        desc: 'منتجات وتسوق إلكتروني',      color: '#f59e0b' },
      { key: 'digital',  icon: '🛒', label: 'المتاجر الرقمية',    desc: 'بطاقات شبكة وأكواد رقمية',    color: '#06b6d4' },
      { key: 'offers',   icon: '🏷️', label: 'العروض والخصومات',   desc: 'عروض جميع الأقسام',          color: '#ef4444' },
    ];

    const UI_ELEMENTS = [
      { key: 'hero',     icon: '🎯', label: 'البانر الرئيسي',      desc: 'قسم الترحيب وشريط البحث' },
      { key: 'ads',      icon: '📢', label: 'الإعلانات المتحركة', desc: 'السلايدر في الصفحة الرئيسية' },
      { key: 'featured', icon: '⭐', label: 'أبرز الخدمات',        desc: 'قسم أبرز الخدمات في الرئيسية' },
    ];

    const visibleCount   = MAIN_SECTIONS.filter(s => d[s.key] !== false).length;
    const maintenanceCount = MAIN_SECTIONS.filter(s => !!d[s.key + '_maint']).length;
    const hiddenCount    = MAIN_SECTIONS.filter(s => d[s.key] === false).length;

    const sectionCard = (s) => {
      const visible = d[s.key] !== false;
      const maint   = !!d[s.key + '_maint'];
      const maintMsg = d[s.key + '_maint_msg'] || '';
      return `
      <div class="sv-section-card${!visible ? ' sv-hidden' : ''}${maint ? ' sv-maint' : ''}" id="sv-card-${s.key}">
        <div class="sv-card-header">
          <div class="sv-card-icon" style="background:${s.color}18;color:${s.color}">${s.icon}</div>
          <div class="sv-card-info">
            <div class="sv-card-title">${s.label}</div>
            <div class="sv-card-desc">${s.desc}</div>
          </div>
          <div class="sv-card-badges">
            ${!visible ? '<span class="sv-badge sv-badge-hidden">مخفي</span>' : '<span class="sv-badge sv-badge-visible">مرئي</span>'}
            ${maint ? '<span class="sv-badge sv-badge-maint">صيانة</span>' : ''}
          </div>
        </div>

        <div class="sv-card-controls">
          <div class="sv-control-row">
            <div class="sv-control-label">
              <span class="sv-ctrl-icon">${visible ? '👁️' : '🙈'}</span>
              <span>${visible ? 'ظاهر للمستخدمين' : 'مخفي عن المستخدمين'}</span>
            </div>
            <label class="sv-toggle" title="${visible ? 'اضغط لإخفاء القسم' : 'اضغط لإظهار القسم'}">
              <input type="checkbox" ${visible ? 'checked' : ''} onchange="svToggleKey('${s.key}', this)">
              <span class="sv-toggle-track">
                <span class="sv-toggle-thumb"></span>
              </span>
            </label>
          </div>

          <div class="sv-control-row sv-control-maint-row">
            <div class="sv-control-label">
              <span class="sv-ctrl-icon">🔧</span>
              <span>${maint ? 'وضع الصيانة فعّال' : 'وضع الصيانة معطّل'}</span>
            </div>
            <label class="sv-toggle sv-toggle-warn" title="وضع الصيانة يُظهر رسالة للمستخدمين">
              <input type="checkbox" ${maint ? 'checked' : ''} onchange="svToggleKey('${s.key}_maint', this)">
              <span class="sv-toggle-track">
                <span class="sv-toggle-thumb"></span>
              </span>
            </label>
          </div>

          <div class="sv-maint-msg-row" id="sv-msg-row-${s.key}" style="${maint ? '' : 'display:none'}">
            <input class="sv-msg-input" id="sv-msg-${s.key}" value="${maintMsg.replace(/"/g, '&quot;')}"
              placeholder="رسالة الصيانة التي يراها المستخدم..."
              onblur="svSaveMsg('${s.key}', this.value)">
            <button class="sv-msg-save-btn" onclick="svSaveMsg('${s.key}', document.getElementById('sv-msg-${s.key}').value)">حفظ</button>
          </div>
        </div>
      </div>`;
    };

    const uiCard = (el) => {
      const visible = d[el.key] !== false;
      return `
      <div class="sv-ui-card${!visible ? ' sv-hidden' : ''}">
        <div class="sv-ui-icon">${el.icon}</div>
        <div class="sv-ui-info">
          <div class="sv-ui-label">${el.label}</div>
          <div class="sv-ui-desc">${el.desc}</div>
        </div>
        <label class="sv-toggle">
          <input type="checkbox" ${visible ? 'checked' : ''} onchange="svToggleKey('${el.key}', this)">
          <span class="sv-toggle-track"><span class="sv-toggle-thumb"></span></span>
        </label>
      </div>`;
    };

    return `
    <div class="sv-admin-wrap">

      <!-- ══ رأس الصفحة ══ -->
      <div class="sv-page-header">
        <div class="sv-page-header-content">
          <div class="sv-page-icon">🛡️</div>
          <div>
            <h1 class="sv-page-title">التحكم في أقسام المنصة</h1>
            <p class="sv-page-sub">أخفِ أي قسم أو فعّل وضع الصيانة الفردية بضغطة واحدة — التغييرات فورية لجميع المستخدمين</p>
          </div>
        </div>
        <div class="sv-stat-chips">
          <div class="sv-stat-chip sv-chip-green">
            <span class="sv-chip-val">${visibleCount}</span>
            <span class="sv-chip-lbl">أقسام مرئية</span>
          </div>
          <div class="sv-stat-chip sv-chip-red">
            <span class="sv-chip-val">${hiddenCount}</span>
            <span class="sv-chip-lbl">أقسام مخفية</span>
          </div>
          <div class="sv-stat-chip sv-chip-amber">
            <span class="sv-chip-val">${maintenanceCount}</span>
            <span class="sv-chip-lbl">تحت الصيانة</span>
          </div>
        </div>
      </div>

      <!-- ══ صيانة كاملة ══ -->
      <div class="sv-full-maint-card${d.full_maint ? ' sv-full-maint-active' : ''}" id="sv-full-maint-card">
        <div class="sv-full-maint-left">
          <div class="sv-full-maint-icon">${d.full_maint ? '🔴' : '🟢'}</div>
          <div>
            <div class="sv-full-maint-title">وضع الصيانة الكاملة للمنصة</div>
            <div class="sv-full-maint-desc">
              ${d.full_maint
                ? '⚠️ المنصة مغلقة الآن — المستخدمون يرون شاشة الصيانة'
                : 'المنصة تعمل بشكل طبيعي — المستخدمون يرون كل المحتوى'}
            </div>
          </div>
        </div>
        <label class="sv-toggle sv-toggle-danger">
          <input type="checkbox" id="sv-full-maint-chk" ${d.full_maint ? 'checked' : ''}
            onchange="svToggleFullMaint(this)">
          <span class="sv-toggle-track"><span class="sv-toggle-thumb"></span></span>
        </label>
      </div>
      <div class="sv-full-maint-msg-wrap" id="sv-full-maint-msg-wrap" style="${d.full_maint ? '' : 'display:none'}">
        <input class="sv-msg-input" id="sv-full-maint-msg-input"
          value="${(d.full_maint_msg || '').replace(/"/g, '&quot;')}"
          placeholder="رسالة الصيانة الكاملة التي يراها المستخدمون...">
        <button class="sv-msg-save-btn" onclick="svSaveFullMaintMsg()">💾 حفظ الرسالة</button>
      </div>

      <!-- ══ الأقسام الرئيسية ══ -->
      <div class="sv-section-label">
        <span class="sv-section-label-icon">🏗️</span>
        الأقسام الرئيسية
      </div>
      <div class="sv-sections-grid">
        ${MAIN_SECTIONS.map(sectionCard).join('')}
      </div>

      <!-- ══ عناصر واجهة الرئيسية ══ -->
      <div class="sv-section-label">
        <span class="sv-section-label-icon">🎨</span>
        عناصر الصفحة الرئيسية
      </div>
      <div class="sv-ui-grid">
        ${UI_ELEMENTS.map(uiCard).join('')}
      </div>

    </div>`;
  };

  // ─── Event handlers (global) ────────────────────────────────

  window.svToggleKey = async function (key, chkEl) {
    const btn = chkEl.closest('.sv-toggle');
    if (btn) btn.classList.add('sv-saving');
    await window.SV.toggle(key);
    if (btn) btn.classList.remove('sv-saving');

    // Refresh maintenance msg row visibility
    const baseKey = key.endsWith('_maint') ? key.replace('_maint', '') : null;
    if (baseKey) {
      const row = document.getElementById('sv-msg-row-' + baseKey);
      if (row) row.style.display = window.SV.get(key) ? '' : 'none';
    }

    // Refresh card classes
    const allKeys = ['bookings', 'services', 'stores', 'digital', 'offers'];
    allKeys.forEach(k => {
      const card = document.getElementById('sv-card-' + k);
      if (!card) return;
      const vis  = window.SV.get(k) !== false;
      const maint = !!window.SV.get(k + '_maint');
      card.classList.toggle('sv-hidden', !vis);
      card.classList.toggle('sv-maint', maint);
    });

    showToast(window.SV.get(key) ? '✅ تم التفعيل وحفظ التغيير' : '🙈 تم الإخفاء وحفظ التغيير', 'success');
  };

  window.svSaveMsg = async function (key, msg) {
    await window.SV.set(key + '_maint_msg', msg);
    showToast('✅ تم حفظ رسالة الصيانة', 'success');
  };

  window.svToggleFullMaint = async function (chkEl) {
    const val = chkEl.checked;
    const card = document.getElementById('sv-full-maint-card');
    const wrap = document.getElementById('sv-full-maint-msg-wrap');

    if (val) {
      const confirmed = await new Promise(res => {
        const modal = document.getElementById('modal-body');
        const overlay = document.getElementById('modal-overlay');
        if (!modal || !overlay) { res(true); return; }
        modal.innerHTML = `
          <div style="text-align:center;padding:32px 24px">
            <div style="font-size:48px;margin-bottom:16px">⚠️</div>
            <h3 style="font-size:20px;font-weight:800;margin-bottom:12px;color:var(--text-main)">تأكيد إغلاق المنصة</h3>
            <p style="color:var(--text-secondary);margin-bottom:24px;line-height:1.7">
              سيرى <strong>جميع المستخدمين</strong> شاشة الصيانة ولن يتمكنوا من استخدام المنصة.<br>أنت كمدير ستظل قادراً على الدخول.
            </p>
            <div style="display:flex;gap:12px;justify-content:center">
              <button class="btn" style="border-radius:99px;background:var(--bg-hover);color:var(--text-main);padding:10px 28px"
                onclick="document.getElementById('modal-overlay').classList.remove('active'); window._svMaintResolve(false)">إلغاء</button>
              <button class="btn" style="border-radius:99px;background:#ef4444;color:#fff;padding:10px 28px;font-weight:700"
                onclick="document.getElementById('modal-overlay').classList.remove('active'); window._svMaintResolve(true)">نعم، أغلق المنصة</button>
            </div>
          </div>`;
        window._svMaintResolve = res;
        overlay.classList.add('active');
      });

      if (!confirmed) {
        chkEl.checked = false;
        return;
      }
    }

    await window.SV.set('full_maint', val);
    if (card) {
      card.classList.toggle('sv-full-maint-active', val);
      card.querySelector('.sv-full-maint-icon').textContent = val ? '🔴' : '🟢';
      card.querySelector('.sv-full-maint-desc').textContent = val
        ? '⚠️ المنصة مغلقة الآن — المستخدمون يرون شاشة الصيانة'
        : 'المنصة تعمل بشكل طبيعي — المستخدمون يرون كل المحتوى';
    }
    if (wrap) wrap.style.display = val ? '' : 'none';
    showToast(val ? '🔴 المنصة أُغلقت للصيانة' : '🟢 المنصة مفتوحة للمستخدمين', val ? 'error' : 'success');
  };

  window.svSaveFullMaintMsg = async function () {
    const inp = document.getElementById('sv-full-maint-msg-input');
    if (!inp) return;
    await window.SV.set('full_maint_msg', inp.value);
    showToast('✅ تم حفظ رسالة الصيانة الكاملة', 'success');
  };

  window.svShowMaintMsg = function (key) {
    const msg = window.SV.maintenanceMsg(key);
    const modal  = document.getElementById('modal-body');
    const overlay = document.getElementById('modal-overlay');
    if (!modal || !overlay) return;
    modal.innerHTML = `
      <div style="text-align:center;padding:36px 24px">
        <div style="font-size:56px;margin-bottom:16px;animation:sv-bounce 1.4s infinite">🔧</div>
        <h3 style="font-size:20px;font-weight:800;margin-bottom:12px;color:var(--text-main)">هذا القسم تحت الصيانة</h3>
        <p style="color:var(--text-secondary);margin-bottom:28px;line-height:1.7;max-width:320px;margin-inline:auto">${msg}</p>
        <button class="btn btn-primary" style="border-radius:99px;padding:10px 32px"
          onclick="document.getElementById('modal-overlay').classList.remove('active')">حسناً، شكراً</button>
      </div>`;
    overlay.classList.add('active');
  };

  console.log('[SV] Section Visibility System loaded ✅');
})();
