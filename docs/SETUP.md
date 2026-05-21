# 🚀 دليل إعداد منصة محجوز مع Firebase

## الخطوة 1 — إنشاء مشروع Firebase

1. اذهب إلى [console.firebase.google.com](https://console.firebase.google.com)
2. اضغط **Add project** → ادخل اسم المشروع (مثل: `mahjooz-app`)
3. اضغط **Continue** ثم **Create project**

---

## الخطوة 2 — تفعيل Authentication

1. من القائمة الجانبية → **Build** → **Authentication**
2. اضغط **Get started**
3. من تبويب **Sign-in method** → اختر **Email/Password** → فعّله → احفظ

---

## الخطوة 3 — إنشاء Firestore Database

1. من القائمة → **Build** → **Firestore Database**
2. اضغط **Create database**
3. اختر **Start in test mode** (مؤقتاً للاختبار) → اختر المنطقة الأقرب → أنشئ

---

## الخطوة 4 — الحصول على إعدادات المشروع

1. من الصفحة الرئيسية للمشروع → اضغط أيقونة **</>** (Web)
2. اكتب اسم التطبيق → اضغط **Register app**
3. ستظهر لك `firebaseConfig` — **انسخها**

---

## الخطوة 5 — لصق الإعدادات في الملف

1. افتح الملف `d:\محجوز\firebase-config.js`
2. ضع الإعدادات التي نسختها بدلاً من القيم الموجودة:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← من Firebase
  authDomain:        "mahjooz-app.firebaseapp.com",
  projectId:         "mahjooz-app",
  storageBucket:     "mahjooz-app.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

---

## الخطوة 6 — نشر التطبيق أونلاين (Firebase Hosting)

### ثبّت Firebase CLI
```bash
npm install -g firebase-tools
```

### سجّل الدخول وابدأ الاستضافة
```bash
cd d:\محجوز
firebase login
firebase init hosting
```
عند السؤال:
- **What do you want to use as your public directory?** → اكتب `.` (نقطة)
- **Configure as a single-page app?** → `N`
- **Overwrite index.html?** → `N`

### انشر التطبيق
```bash
firebase deploy
```

ستحصل على رابط مثل: `https://mahjooz-app.web.app` ✅

---

## الخطوة 7 — حسابات الاختبار التجريبية

عند أول تشغيل للتطبيق يتم إنشاء هذه الحسابات تلقائياً:

| الدور | البريد | كلمة المرور |
|-------|--------|-----------|
| إدارة | `admin@mahjooz.app` | `admin123` |
| موظف | `staff@mahjooz.app` | `staff123` |
| صاحب خدمة | `vendor@mahjooz.app` | `vendor123` |
| مندوب | `driver@mahjooz.app` | `driver123` |
| عميل | `customer@mahjooz.app` | `customer123` |

> ⚠️ **غيّر كلمات المرور** بعد أول دخول من Firebase Console → Authentication → Users

---

## الخطوة 8 — هيكل الملفات

```
محجوز/
├── index.html          # الواجهة الرئيسية
├── index.css           # التصاميس الكاملة
├── firebase-config.js  # إعدادات Firebase
├── core.js             # الدوال الأساسية والحالة
├── pages.js            # صفحات العميل
├── dashboards.js       # لوحات التحكم (Admin, Vendor, Driver, Staff)
├── package.json        # المكتبات
├── firebase.json       # إعدادات Hosting
└── SETUP.md            # هذه التعليمات
```

---

## الخطوة 9 — قواعد Firestore الموصى بها (للإنتاج)

بعد الاختبار، استبدل قواعد Firestore بما يلي من Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ─── المستخدمون ────────────────────────
    match /users/{uid} {
      allow read: if request.auth.uid == uid || request.auth.token.role == 'admin';
      allow write: if request.auth.uid == uid || request.auth.token.role == 'admin';
    }
    
    // ─── المحفظات ──────────────────────────
    match /wallets/{uid} {
      allow read: if request.auth.uid == uid || request.auth.token.role == 'admin';
      allow write: if request.auth.uid == uid || request.auth.token.role == 'admin';
    }
    
    // ─── المعاملات ─────────────────────────
    match /transactions/{transId} {
      allow create: if request.auth != null;
      allow read: if request.auth.uid == resource.data.uid || request.auth.token.role == 'admin';
    }
    
    // ─── الطلبات ───────────────────────────
    match /orders/{orderId} {
      allow create: if request.auth != null && request.auth.token.role == 'customer';
      allow read: if request.auth.uid == resource.data.customerId 
                     || request.auth.uid == resource.data.vendorId
                     || request.auth.uid == resource.data.driverId
                     || request.auth.token.role == 'admin';
      allow update: if request.auth.uid == resource.data.customerId 
                       || request.auth.uid == resource.data.vendorId
                       || request.auth.uid == resource.data.driverId
                       || request.auth.token.role == 'admin';
    }
    
    // ─── التقييمات ────────────────────────
    match /ratings/{ratingId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.customerId;
      allow read: if true;
    }
    
    // ─── الإعلانات ────────────────────────
    match /ads/{adId} {
      allow read: if true;
      allow write: if request.auth.token.role == 'admin';
    }
    
    // ─── الخدمات والتصنيفات ─────────────
    match /services/{svcId} {
      allow read: if true;
      allow write: if request.auth.token.role == 'admin' || request.auth.token.role == 'staff';
    }
    match /categories/{catId} {
      allow read: if true;
      allow write: if request.auth.token.role == 'admin';
    }
    
    // ─── طلبات الشحن والسحب ──────────────
    match /recharge_requests/{reqId} {
      allow create: if request.auth != null;
      allow read: if request.auth.uid == resource.data.userId || request.auth.token.role == 'admin' || request.auth.token.role == 'staff';
      allow update: if request.auth.token.role == 'admin';
    }
    match /withdrawal_requests/{reqId} {
      allow create: if request.auth != null;
      allow read: if request.auth.uid == resource.data.userId || request.auth.token.role == 'admin';
      allow update: if request.auth.token.role == 'admin';
    }
  }
}
```

---

## الخطوة 10 — نشر التطبيق على الويب

```bash
cd d:\محجوز
npm install -g firebase-tools
firebase login
firebase deploy
```

ستحصل على رابط مثل: `https://mahjooz-85c96.web.app` ✅

---

## المميزات المتوفرة الآن ✅

✅ نظام المصادقة (Admin, Staff, Vendor, Driver, Customer)  
✅ صفحة البائعين والخدمات  
✅ نظام الحجوزات والطلبات  
✅ محفظة داخلية وشحن الرصيد  
✅ إدارة المستخدمين والخدمات والتصنيفات  
✅ الإعلانات المميزة  
✅ نظام التقييمات  
✅ الفواتير التلقائية  
✅ لوحات التحكم المتقدمة  

---

## المميزات قيد التطوير 🔄

⏳ Google Maps Integration (تتبع حي الموقع)  
⏳ نظام الدفع المتقدم (بطاقات، محافظ رقمية)  
⏳ نظام الإشعارات الفورية  
⏳ تقارير متقدمة وإحصائيات  

---

## الدعم والتواصل

للمزيد من المعلومات والدعم الفني: [support@mahjooz.app](mailto:support@mahjooz.app)

© 2026 منصة محجوز — جميع الحقوق محفوظة
    }
    // التصنيفات والخدمات: الكل يقرأ، المدير فقط يكتب
    match /categories/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /services/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    // الحجوزات: المستخدم يكتب حجوزاته، المدير يدير الكل
    match /bookings/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```
