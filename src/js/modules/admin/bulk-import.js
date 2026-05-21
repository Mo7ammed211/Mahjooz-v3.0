/* phase16.js — Bulk import for Categories & Services from CSV / Excel.
   Adds "📥 استيراد" buttons on admin Categories and admin Services tabs.
   Lets admins:
     1. Download a ready-to-fill template (.xlsx).
     2. Upload .csv / .xlsx / .xls files.
     3. Preview rows with validation (matches catId/regionId by name).
     4. Bulk-write to Firestore via fsAdd().
   Depends on SheetJS (xlsx) loaded from CDN in index.html.
*/
(function () {
  function ensureXLSX(cb) {
    if (window.XLSX) return cb();
    let tries = 0;
    const t = setInterval(() => {
      if (window.XLSX) { clearInterval(t); cb(); }
      else if (++tries > 50) { clearInterval(t); toast('تعذّر تحميل مكتبة Excel','error'); }
    }, 200);
  }

  const CAT_HEADERS = {
    name:        ['name','الاسم','اسم','اسم_التصنيف'],
    icon:        ['icon','الأيقونة','الايقونة','ايقونة','رمز'],
    section:     ['section','القسم','قسم'],
    description: ['description','desc','الوصف','وصف']
  };
  const SVC_HEADERS = {
    catName:    ['category','cat','التصنيف','تصنيف','اسم_التصنيف'],
    name:       ['name','الاسم','اسم','اسم_الخدمة'],
    provider:   ['provider','مقدم_الخدمة','المزود','مزود'],
    desc:       ['desc','description','الوصف','وصف'],
    price:      ['price','السعر','سعر'],
    icon:       ['icon','الأيقونة','الايقونة','ايقونة'],
    regionName: ['region','المنطقة','منطقة'],
    address:    ['address','العنوان','عنوان'],
    phone:      ['phone','الجوال','هاتف','phone_number'],
    whatsapp:   ['whatsapp','واتساب','whatsapp_number'],
    lat:        ['lat','latitude','خط_العرض'],
    lng:        ['lng','longitude','خط_الطول']
  };
  const SECTION_MAP = {
    'bookings':'bookings','الحجوزات':'bookings','حجوزات':'bookings',
    'services':'services','الخدمات':'services','خدمات':'services','الخدمات_المهنية':'services',
    'stores':'stores','المتاجر':'stores','متاجر':'stores'
  };

  function normHeader(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,'_'); }
  function findKey(row, candidates){
    const keys = Object.keys(row);
    const cset = new Set(candidates.map(c=>c.toLowerCase()));
    for (const k of keys) {
      if (cset.has(normHeader(k))) return k;
    }
    return null;
  }
  function pick(row, candidates){
    const k = findKey(row, candidates);
    return k ? row[k] : '';
  }
  function val(v){
    if (v===null || v===undefined) return '';
    return String(v).trim();
  }

  async function parseFile(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type:'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval:'' });
          resolve(rows);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function normalizeCatRow(row){
    const name = val(pick(row, CAT_HEADERS.name));
    const icon = val(pick(row, CAT_HEADERS.icon));
    const sectionRaw = normHeader(pick(row, CAT_HEADERS.section));
    const description = val(pick(row, CAT_HEADERS.description));
    const section = SECTION_MAP[sectionRaw] || 'services';
    const obj = { name, icon, section, description };
    obj._valid = !!name;
    obj._reason = obj._valid ? '' : 'اسم التصنيف مطلوب';
    return obj;
  }

  function normalizeSvcRow(row){
    const cats = (window.AppData && AppData.cats) || [];
    const regs = (window.AppData && AppData.regions) || [];
    const catName = val(pick(row, SVC_HEADERS.catName));
    const cat = cats.find(c => c.name && c.name.trim().toLowerCase() === catName.toLowerCase());
    const regName = val(pick(row, SVC_HEADERS.regionName));
    const region = regs.find(r => r.name && r.name.trim().toLowerCase() === regName.toLowerCase());
    const priceRaw = val(pick(row, SVC_HEADERS.price));
    const price = priceRaw ? parseFloat(priceRaw) : null;
    const latRaw = val(pick(row, SVC_HEADERS.lat));
    const lngRaw = val(pick(row, SVC_HEADERS.lng));
    const obj = {
      name:     val(pick(row, SVC_HEADERS.name)),
      provider: val(pick(row, SVC_HEADERS.provider)),
      desc:     val(pick(row, SVC_HEADERS.desc)),
      icon:     val(pick(row, SVC_HEADERS.icon)) || '🔷',
      address:  val(pick(row, SVC_HEADERS.address)),
      phone:    val(pick(row, SVC_HEADERS.phone)),
      whatsapp: val(pick(row, SVC_HEADERS.whatsapp)),
      catId:    cat ? cat.id : '',
      regionId: region ? region.id : '',
      _catName: catName,
      _regionName: regName
    };
    if (price !== null && !isNaN(price)) obj.price = price;
    if (latRaw && !isNaN(parseFloat(latRaw))) obj.lat = parseFloat(latRaw);
    if (lngRaw && !isNaN(parseFloat(lngRaw))) obj.lng = parseFloat(lngRaw);
    obj._valid = !!obj.name && !!obj.catId;
    obj._reason = !obj.name
      ? 'اسم الخدمة مطلوب'
      : (!obj.catId ? `تصنيف غير موجود: ${catName||'(فارغ)'}` : '');
    return obj;
  }

  function downloadTemplate(kind){
    let header, sample;
    if (kind === 'cats') {
      header = ['name','icon','section','description'];
      sample = [
        ['فنادق','🏨','bookings','حجز فنادق وشقق فندقية'],
        ['كهربائي','⚡','services','خدمات صيانة الكهرباء'],
        ['صيدلية','💊','stores','صيدليات وأدوية']
      ];
    } else {
      header = ['category','name','provider','desc','price','icon','region','address','phone','whatsapp','lat','lng'];
      sample = [
        ['فنادق','جناح ملكي','الفندق الذهبي','جناح فاخر بإطلالة بحرية','450','🏨','الرياض','شارع الملك فهد','0501234567','966501234567','24.7136','46.6753'],
        ['كهربائي','صيانة منزلية','أبو محمد','معاينة وإصلاح كهرباء','100','⚡','جدة','حي السلامة','0509876543','966509876543','21.4858','39.1925']
      ];
    }
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind === 'cats' ? 'categories' : 'services');
    XLSX.writeFile(wb, kind === 'cats' ? 'mahjooz_categories_template.xlsx' : 'mahjooz_services_template.xlsx');
  }

  window.ph16_openImportModal = function(kind){
    const isCat = kind === 'cats';
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">📥 استيراد ${isCat?'تصنيفات':'خدمات'} (CSV / Excel)</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="ph16-import">
        <div class="ph16-help">
          <p>ارفع ملف <b>CSV</b> أو <b>Excel (.xlsx)</b> يحتوي على الأعمدة المطلوبة. يمكنك تحميل نموذج جاهز للبدء.</p>
          ${isCat
            ? `<p class="ph16-hint">الأعمدة: <code>name</code>, <code>icon</code>, <code>section</code> (bookings/services/stores), <code>description</code></p>`
            : `<p class="ph16-hint">الأعمدة: <code>category</code> (اسم تصنيف موجود), <code>name</code>, <code>provider</code>, <code>desc</code>, <code>price</code>, <code>icon</code>, <code>region</code>, <code>address</code>, <code>phone</code>, <code>whatsapp</code>, <code>lat</code>, <code>lng</code></p>`}
          <button class="btn btn-secondary" onclick="ph16_downloadTemplate('${kind}')">⬇️ تحميل نموذج جاهز</button>
        </div>
        <div class="form-group">
          <label class="form-label">اختر الملف</label>
          <input type="file" id="ph16-file" class="form-control" accept=".csv,.xlsx,.xls" onchange="ph16_previewFile('${kind}')">
        </div>
        <div id="ph16-preview"></div>
      </div>`);
  };

  window.ph16_downloadTemplate = function(kind){
    ensureXLSX(() => downloadTemplate(kind));
  };

  window.ph16_previewFile = function(kind){
    const fileInput = document.getElementById('ph16-file');
    const file = fileInput && fileInput.files && fileInput.files[0];
    const host = document.getElementById('ph16-preview');
    if (!file) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="ph16-loading">⏳ جاري قراءة الملف...</div>';
    ensureXLSX(async () => {
      try {
        const rows = await parseFile(file);
        if (!rows.length) { host.innerHTML = '<div class="ph16-error">الملف فارغ أو لا يحتوي على بيانات</div>'; return; }
        const normalize = kind === 'cats' ? normalizeCatRow : normalizeSvcRow;
        const norm = rows.map(normalize);
        window.__ph16_rows = norm;
        const valid = norm.filter(r => r._valid).length;
        const invalid = norm.length - valid;
        const headers = kind === 'cats'
          ? [['الاسم','name'],['الأيقونة','icon'],['القسم','section'],['الوصف','description'],['الحالة','_status']]
          : [['الاسم','name'],['التصنيف','_catName'],['المزود','provider'],['السعر','price'],['المنطقة','_regionName'],['الجوال','phone'],['الحالة','_status']];
        const tableRows = norm.slice(0, 50).map(r => {
          const status = r._valid
            ? '<span class="badge badge-teal">✅ صالح</span>'
            : `<span class="badge badge-rose">⚠️ ${r._reason||'بيانات ناقصة'}</span>`;
          const cells = headers.map(([_, k]) => {
            if (k === '_status') return `<td>${status}</td>`;
            const v = r[k];
            const t = (v===undefined || v===null || v==='') ? '—' : String(v);
            return `<td>${t.replace(/</g,'&lt;')}</td>`;
          }).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        host.innerHTML = `
          <div class="ph16-summary">
            <div class="ph16-stat"><b>${rows.length}</b><span>إجمالي الصفوف</span></div>
            <div class="ph16-stat ph16-ok"><b>${valid}</b><span>صالح للاستيراد</span></div>
            <div class="ph16-stat ph16-bad"><b>${invalid}</b><span>غير صالح</span></div>
          </div>
          <div class="ph16-table-wrap">
            <table class="admin-table ph16-table">
              <thead><tr>${headers.map(h=>`<th>${h[0]}</th>`).join('')}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            ${norm.length>50?`<div class="ph16-note">عرض أول 50 صف من أصل ${norm.length}.</div>`:''}
          </div>
          <button class="btn btn-primary btn-block" id="ph16-run-btn" ${valid===0?'disabled':''} onclick="ph16_runImport('${kind}')">
            🚀 استيراد ${valid} ${kind==='cats'?'تصنيف':'خدمة'}
          </button>`;
      } catch (err) {
        console.error('[phase16] parse error', err);
        host.innerHTML = `<div class="ph16-error">تعذّر قراءة الملف: ${err.message||err}</div>`;
      }
    });
  };

  window.ph16_runImport = async function(kind){
    const rows = (window.__ph16_rows || []).filter(r => r._valid);
    if (!rows.length) { toast('لا توجد صفوف صالحة للاستيراد','error'); return; }
    const btn = document.getElementById('ph16-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الاستيراد...'; }
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        if (kind === 'cats') {
          const collectionName = (r.section === 'bookings') ? 'categories' : 'professions_categories';
          await fsAdd(collectionName, {
            name: r.name,
            icon: r.icon || '📌',
            section: r.section || 'services',
            description: r.description || ''
          });
        } else {
          const payload = {
            catId: r.catId,
            name: r.name,
            provider: r.provider || '',
            desc: r.desc || '',
            icon: r.icon || '🔷'
          };
          if (r.price !== undefined && r.price !== null && !isNaN(r.price)) payload.price = r.price;
          if (r.regionId) payload.regionId = r.regionId;
          if (r.address)  payload.address  = r.address;
          if (r.phone)    payload.phone    = r.phone;
          if (r.whatsapp) payload.whatsapp = r.whatsapp;
          if (r.lat !== undefined) payload.lat = r.lat;
          if (r.lng !== undefined) payload.lng = r.lng;
          await fsAdd('services', payload);
        }
        ok++;
      } catch (err) {
        console.error('[phase16] import row failed', err, r);
        fail++;
      }
    }
    toast(`تم استيراد ${ok} ${kind==='cats'?'تصنيف':'خدمة'}${fail?` — فشل ${fail}`:''}`, fail?'error':'success');
    closeModal();
    delete window.__ph16_rows;
    try { if (typeof loadAllData === 'function') await loadAllData(); } catch(e){}
    try { await render(); } catch(e){}
  };

  function injectImportButton(html, kind){
    const onclick = kind === 'cats' ? 'showAddCatModal()' : 'showAddSvcModal()';
    const btn = `<button class="btn btn-secondary" onclick="ph16_openImportModal('${kind}')" style="margin-left:8px">📥 استيراد</button>`;
    const re = new RegExp('(<button class="btn btn-primary" onclick="' + onclick.replace(/[()]/g,'\\$&') + '">[^<]*</button>)');
    return html.replace(re, `${btn}$1`);
  }

  const _ras = window.renderAdminServices;
  if (typeof _ras === 'function') {
    window.renderAdminServices = function(){ return injectImportButton(_ras.apply(this, arguments), 'svcs'); };
  }
  const _rac = window.renderAdminCats;
  if (typeof _rac === 'function') {
    window.renderAdminCats = function(){ return injectImportButton(_rac.apply(this, arguments), 'cats'); };
  }

  const css = `
    .ph16-import { padding: 4px 0; }
    .ph16-help { background: var(--bg-hover); padding:12px 16px; border-radius:10px; margin-bottom:14px; display:flex; flex-direction:column; gap:8px; }
    .ph16-help p { margin:0; color:var(--text-muted); font-size:14px; line-height:1.7; }
    .ph16-hint code { background:rgba(124,58,237,.08); color:#7c3aed; padding:1px 6px; border-radius:4px; font-size:12px; margin:0 2px; direction:ltr; display:inline-block; }
    .ph16-loading, .ph16-error { padding:14px; text-align:center; border-radius:10px; }
    .ph16-loading { background: var(--bg-hover); color: var(--text-muted); }
    .ph16-error { background: #fee2e2; color:#b91c1c; }
    .ph16-summary { display:flex; gap:12px; margin:14px 0; }
    .ph16-stat { flex:1; background:var(--bg-hover); border-radius:10px; padding:12px; text-align:center; }
    .ph16-stat b { display:block; font-size:22px; color:var(--text-main); }
    .ph16-stat span { font-size:12px; color:var(--text-muted); }
    .ph16-stat.ph16-ok b { color:#0d9488; }
    .ph16-stat.ph16-bad b { color:#dc2626; }
    .ph16-table-wrap { max-height:300px; overflow:auto; border:1px solid var(--border); border-radius:10px; margin-bottom:14px; }
    .ph16-table { font-size:13px; }
    .ph16-table th { position:sticky; top:0; z-index:1; }
    .ph16-note { padding:8px 12px; font-size:12px; color:var(--text-muted); background:var(--bg-hover); border-top:1px solid var(--border); }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  console.log('[Phase 16] Bulk import (CSV/Excel) for categories & services loaded.');
})();
