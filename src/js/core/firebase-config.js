// ═══════════════════════════════════════════════════
//  محجوز — Firebase Real Configuration
//  Project: mahjooz-b502f
// ═══════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyA7ACdMvXQ5xiUIz7QfUbnSA4RcugOdCtM",
  authDomain:        "mahjooz-b502f.firebaseapp.com",
  projectId:         "mahjooz-b502f",
  storageBucket:     "mahjooz-b502f.firebasestorage.app",
  messagingSenderId: "1056495725021",
  appId:             "1:1056495725021:web:33a9b2ba7e96e8e288ae34",
  measurementId:     "G-Y1JYGN8J6K"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose globally — app.js uses these directly
window.db   = firebase.firestore();
window.auth = firebase.auth();

// Firebase Cloud Messaging (FCM) - للإشعارات الفورية
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// Initialize Messaging and handle background messages
try {
  const messaging = firebase.messaging();
  
  // طلب إذن المستخدم (سيظهر قبل أول إشعار)
  messaging.requestPermission().then(() => {
    console.log('✅ تم السماح بالإشعارات');
    return messaging.getToken();
  }).then(token => {
    if (token) {
      window.fcmToken = token;
      console.log('FCM Token:', token);
      // حفظ الـ Token في Firestore مع بيانات المستخدم
      if (firebase.auth().currentUser) {
        firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid)
          .update({ fcmToken: token })
          .catch(err => console.log('Token update error:', err));
      }
    }
  }).catch(err => {
    console.log('Notification permission denied or unavailable:', err);
  });
  
  // معالجة الإشعارات في المقدمة (عندما يكون التطبيق مفتوحاً)
  messaging.onMessage(payload => {
    console.log('Foreground message received:', payload);
    const notificationData = {
      title: payload.notification?.title || 'إشعار جديد',
      body: payload.notification?.body || '',
      data: payload.data || {},
    };
    
    // استدعاء notification handler من notifications.js
    if (window.handleFCMMessage) {
      window.handleFCMMessage(notificationData);
    }
  });
} catch (e) {
  console.log('Firebase Messaging not supported in this browser');
}

// Firestore FieldValue (used for serverTimestamp in app.js)
window.firebase = firebase;
