/* phase23.js - Real-time Order Tracking & Maps System */

// Global tracking references
let driverWatchId = null;
let currentTrackingMap = null;
let currentTrackingMarker = null;
let trackingUnsubscribe = null;

// ==========================================
// DRIVER SIDE: Start Tracking
// ==========================================
async function startDriverDelivery(orderId) {
  if (!navigator.geolocation) {
    toast('متصفحك لا يدعم تحديد الموقع (GPS)', 'error');
    return;
  }

  showLoader('جاري تحديد موقعك...');
  
  try {
    // 1. Update order status to 'with_driver'
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: 'with_driver',
      deliveryStartedAt: new Date().toISOString()
    });
    
    // 2. Request GPS tracking
    driverWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Update Firestore with driver's real-time location
        await orderRef.update({
          driverLocation: { lat, lng },
          lastLocationUpdate: new Date().toISOString()
        });
        
        hideLoader();
      },
      (err) => {
        hideLoader();
        console.error("GPS Error:", err);
        toast('يرجى تفعيل الـ GPS لتتبع موقعك أثناء التوصيل', 'error');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    toast('تم تفعيل نظام التتبع! سيتم نقل موقعك للعميل مباشرة.', 'success');
    render(); // refresh dashboard to show tracking active UI
    
  } catch (err) {
    hideLoader();
    console.error(err);
    toast('حدث خطأ أثناء تفعيل التتبع', 'error');
  }
}

async function stopDriverDelivery(orderId) {
  if (driverWatchId) {
    navigator.geolocation.clearWatch(driverWatchId);
    driverWatchId = null;
  }
  try {
    await db.collection('orders').doc(orderId).update({
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      driverLocation: null
    });
    toast('تم إنهاء التوصيل بنجاح!', 'success');
    render();
  } catch(e) {
    console.error(e);
  }
}

// ==========================================
// CUSTOMER SIDE: View Tracking Map
// ==========================================
window.openLiveTrackingModal = function(orderId) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📍 تتبع الطلب المباشر</h2>
      <button class="modal-close" onclick="closeTrackingModal()">✕</button>
    </div>
    
    <div class="tracking-status-bar" id="trk-status" style="display:flex; justify-content:space-between; align-items:center; padding:10px 20px; font-weight:700; color:var(--text-muted)">
      <div style="text-align:center"><div class="trk-dot active" style="width:16px;height:16px;border-radius:50%;background:var(--primary);margin:0 auto 5px"></div>قيد التجهيز</div>
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);margin:0 10px;position:relative;top:-10px"></div>
      <div style="text-align:center"><div class="trk-dot" id="trk-onway" style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.1);margin:0 auto 5px"></div>في الطريق</div>
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);margin:0 10px;position:relative;top:-10px"></div>
      <div style="text-align:center"><div class="trk-dot" id="trk-done" style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.1);margin:0 auto 5px"></div>تم التوصيل</div>
    </div>
    
    <div id="tracking-map" style="width: 100%; height: 400px; border-radius: 12px; margin-top: 20px; background:#1a1a24; border:1px solid rgba(255,255,255,0.1)">
      <!-- Leaflet map goes here -->
    </div>
    
    <div id="tracking-info" style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border:1px solid rgba(255,255,255,0.05)">
      <h4 style="margin:0; font-weight:700; color:var(--text-primary)">معلومات التوصيل</h4>
      <p id="trk-eta" style="margin:5px 0 0; color:var(--primary); font-weight:600">جاري جلب موقع المندوب...</p>
    </div>
  `);

  setTimeout(() => {
    initTrackingMap(orderId);
  }, 300);
};

function initTrackingMap(orderId) {
  if (currentTrackingMap) {
    currentTrackingMap = null;
  }
  if (typeof google === 'undefined') return;
  
  const mapOptions = {
    zoom: 13,
    center: { lat: 24.7136, lng: 46.6753 },
    mapId: 'DEMO_MAP_ID', // Optional: for advanced styling
    mapTypeControl: false,
    streetViewControl: false,
    styles: [ // Dark mode style for Google Maps
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
    ]
  };

  currentTrackingMap = new google.maps.Map(document.getElementById('tracking-map'), mapOptions);

  trackingUnsubscribe = db.collection('orders').doc(orderId).onSnapshot(doc => {
    if(!doc.exists) return;
    const data = doc.data();
    
    if(data.status === 'with_driver' || data.status === 'delivered' || data.status === 'completed') {
      const dot = document.getElementById('trk-onway');
      if (dot) dot.style.background = 'var(--gold)';
    }
    if (data.status === 'delivered' || data.status === 'completed') {
      const dot = document.getElementById('trk-done');
      if (dot) dot.style.background = 'var(--success)';
      const eta = document.getElementById('trk-eta');
      if (eta) {
        eta.innerText = "تم توصيل الطلب بنجاح! 🎉";
        eta.style.color = "var(--success)";
      }
    } else if (data.status === 'with_driver') {
       const eta = document.getElementById('trk-eta');
       if(eta) eta.innerText = "المندوب في طريقه إليك...";
    }

    if (data.driverLocation && data.driverLocation.lat) {
      const latLng = { lat: data.driverLocation.lat, lng: data.driverLocation.lng };
      
      if (currentTrackingMarker) {
        currentTrackingMarker.setPosition(latLng);
      } else {
        currentTrackingMarker = new google.maps.Marker({
          position: latLng,
          map: currentTrackingMap,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237c3aed" width="32" height="32"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="%237c3aed"/></svg>'),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          }
        });
        currentTrackingMap.setCenter(latLng);
        currentTrackingMap.setZoom(16);
      }
    }
  });
}

window.closeTrackingModal = function() {
  if (trackingUnsubscribe) {
    trackingUnsubscribe();
    trackingUnsubscribe = null;
  }
  if (currentTrackingMap) {
    currentTrackingMap.remove();
    currentTrackingMap = null;
  }
  currentTrackingMarker = null;
  closeModal();
};
