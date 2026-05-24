// ══════════════════════════════════════════════════════════════════
//  محجوز — نظام أسعار التوصيل الذكي
//  delivery-pricing.js
//
//  المسؤوليات:
//  • تحميل المناطق والمسارات من Firestore
//  • حساب سعر التوصيل تلقائياً بناءً على (من → إلى)
//  • إشعار المدير عند وجود مسار غير مسجل
// ══════════════════════════════════════════════════════════════════

// ─── Cache للبيانات ───────────────────────────────────────────────
window.AppData.deliveryZones  = window.AppData.deliveryZones  || [];
window.AppData.deliverySubzones = window.AppData.deliverySubzones || [];
window.AppData.deliveryRoutes = window.AppData.deliveryRoutes || [];

// ─── تحميل المناطق من Firestore ──────────────────────────────────
window.dp_loadZones = async function() {
  try {
    const snap = await Promise.race([
      db.collection('delivery_zones').where('active','==',true).get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    AppData.deliveryZones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return AppData.deliveryZones;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المناطق:', e);
    return [];
  }
};

// ─── تحميل مسارات التوصيل من Firestore ──────────────────────────
window.dp_loadRoutes = async function(zoneId = null) {
  try {
    let query = db.collection('delivery_routes').where('active','==',true);
    if (zoneId) query = query.where('zoneId','==',zoneId);
    const snap = await Promise.race([
      query.get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    const routes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!zoneId) AppData.deliveryRoutes = routes;
    return routes;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المسارات:', e);
    return [];
  }
};

// ─── تحميل المناطق الفرعية (Neighborhoods) ──────────────────────
window.dp_loadSubzones = async function(zoneId = null) {
  try {
    let query = db.collection('delivery_subzones');
    if (zoneId) query = query.where('zoneId', '==', zoneId);
    const snap = await Promise.race([
      query.get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    const subzones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!zoneId) AppData.deliverySubzones = subzones;
    return subzones;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المناطق الفرعية:', e);
    return [];
  }
};

// ─── تحميل الكل دفعة واحدة ───────────────────────────────────────
window.dp_loadAll = async function() {
  await Promise.all([ dp_loadZones(), dp_loadRoutes(), dp_loadSubzones() ]);
};

// ─── حساب سعر التوصيل ────────────────────────────────────────────
// fromArea: نقطة الاستلام (موقع الخدمة/المزود)
// toArea:   نقطة التوصيل (موقع العميل)
// الإرجاع: { fee: number, found: boolean, routeId: string|null }
window.dp_calculateFee = function(fromArea, toArea) {
  if (!fromArea || !toArea) return { fee: 0, found: false, routeId: null };

  const normalize = s => (s || '').trim().toLowerCase()
    .replace(/\s+/g, ' ');

  const from = normalize(fromArea);
  const to   = normalize(toArea);

  const routes = AppData.deliveryRoutes || [];

  // البحث بالاتجاهين (A→B = B→A)
  const route = routes.find(r => {
    const rFrom = normalize(r.fromArea);
    const rTo   = normalize(r.toArea);
    return (rFrom === from && rTo === to) ||
           (rFrom === to   && rTo === from);
  });

  if (route) {
    return {
      fee: Number(route.price) || 0,
      found: true,
      routeId: route.id,
      zoneName: (AppData.deliveryZones || []).find(z => z.id === route.zoneId)?.name || '',
    };
  }

  // ─── مسار غير مسجل: إرسال إشعار للمدير ─────────────────────
  dp_notifyMissingRoute(fromArea, toArea);
  return { fee: 0, found: false, routeId: null };
};

// ─── إشعار المدير بمسار مفقود ────────────────────────────────────
let _missingRouteCache = new Set(); // تجنب التكرار في نفس الجلسة
window.dp_notifyMissingRoute = async function(fromArea, toArea) {
  const key = `${fromArea}→${toArea}`;
  if (_missingRouteCache.has(key)) return;
  _missingRouteCache.add(key);

  console.warn(`[DeliveryPricing] مسار غير مسجل: ${fromArea} → ${toArea}`);

  try {
    // البحث عن المديرين
    const admins = (AppData.users || []).filter(u => u.role === 'admin');
    for (const admin of admins) {
      if (typeof pushNotification === 'function') {
        await pushNotification({
          uid: admin.id || admin.uid,
          title: '⚠️ مسار توصيل غير مسجل',
          body: `يوجد طلب توصيل من "${fromArea}" إلى "${toArea}" بدون سعر. يرجى إضافته في إعدادات أسعار التوصيل.`,
          type: 'warning',
          link: 'admin?tab=delivery_pricing',
        });
      }
    }

    // حفظ السجل في Firestore لمراجعة لاحقة
    await db.collection('delivery_missing_routes').add({
      fromArea,
      toArea,
      reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolved: false,
    });
  } catch(e) {
    console.warn('[DeliveryPricing] فشل إرسال الإشعار:', e);
  }
};

// ─── تحميل المسارات المفقودة (للوحة المدير) ─────────────────────
window.dp_loadMissingRoutes = async function() {
  try {
    const snap = await db.collection('delivery_missing_routes')
      .where('resolved','==',false)
      .orderBy('reportedAt','desc')
      .limit(20)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
};

// ─── حل مسار مفقود (بعد إضافته) ─────────────────────────────────
window.dp_resolveMissingRoute = async function(missingId) {
  try {
    await db.collection('delivery_missing_routes').doc(missingId)
      .update({ resolved: true });
  } catch(e) {}
};

// ─── CRUD: المناطق ────────────────────────────────────────────────
window.dp_saveZone = async function(data, id = null) {
  try {
    const payload = {
      name: data.name?.trim(),
      active: data.active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_zones').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_zones').add(payload);
    }
    await dp_loadZones();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المنطقة:', e);
    return false;
  }
};

window.dp_deleteZone = async function(id) {
  try {
    // حذف المسارات المرتبطة
    const routes = await dp_loadRoutes(id);
    await Promise.all(routes.map(r =>
      db.collection('delivery_routes').doc(r.id).delete()
    ));
    await db.collection('delivery_zones').doc(id).delete();
    await dp_loadAll();
    return true;
  } catch(e) { return false; }
};

// ─── CRUD: المناطق الفرعية (العناوين) ───────────────────────────
window.dp_saveSubzone = async function(data, id = null) {
  try {
    const payload = {
      zoneId: data.zoneId,
      name: data.name?.trim(),
      vehicleType: data.vehicleType || 'motorcycle',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_subzones').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_subzones').add(payload);
    }
    await dp_loadSubzones();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المنطقة الفرعية:', e);
    return false;
  }
};

window.dp_deleteSubzone = async function(id) {
  try {
    await db.collection('delivery_subzones').doc(id).delete();
    await dp_loadSubzones();
    return true;
  } catch(e) { return false; }
};

// ─── CRUD: المسارات ───────────────────────────────────────────────
window.dp_saveRoute = async function(data, id = null) {
  try {
    const payload = {
      zoneId:      data.zoneId,
      fromArea:    data.fromArea?.trim(),
      toArea:      data.toArea?.trim(),
      price:       Number(data.price) || 0,
      weight:      data.weight ? Number(data.weight) : null,
      active:      data.active !== false,
      vehicleType: data.vehicleType || 'motorcycle',
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_routes').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_routes').add(payload);
    }
    await dp_loadRoutes();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المسار:', e);
    return false;
  }
};

window.dp_deleteRoute = async function(id) {
  try {
    await db.collection('delivery_routes').doc(id).delete();
    await dp_loadRoutes();
    return true;
  } catch(e) { return false; }
};

// ─── تحميل تلقائي عند بدء التطبيق ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  dp_loadAll().catch(() => {});
});
// أيضاً تحميل عند أي تحديث للبيانات
if (typeof window.AppData !== 'undefined') {
  dp_loadAll().catch(() => {});
}
