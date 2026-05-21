# 🚀 تسريع البدء — Quick Start

## 1️⃣ الخطوة التجريبية السريعة (5 دقائق)

### أ. فتح المتصفح
```
اذهب إلى: https://mahjooz-85c96.web.app
أو انسخ index.html في متصفحك المحلي
```

### ب. اختر صفة الدخول
```
👑 مدير:        admin@mahjooz.app / admin123
🖥️ موظف:        staff@mahjooz.app / staff123
🏪 صاحب خدمة:    vendor@mahjooz.app / vendor123
🚗 مندوب:        driver@mahjooz.app / driver123
👤 عميل:        customer@mahjooz.app / customer123
👁️ زائر:        لا تحتاج بيانات
```

### ج. استكشف الميزات
- **كعميل:** ابحث، احجز، ادفع من المحفظة، قيّم
- **كبائع:** استقبل طلبات، اقبلها، متابعة الأرباح
- **كمدير:** أضف خدمات، أدر الطلبات، وافق على الشحن

---

## 2️⃣ التثبيت المحلي (15 دقيقة)

### أ. متطلبات النظام
```bash
- متصفح حديث (Chrome, Firefox, Edge)
- Node.js 14+ (اختياري، للتطوير)
- اتصال إنترنت
```

### ب. نسخ المشروع
```bash
git clone https://github.com/your-username/mahjooz.git
cd mahjooz
```

### ج. تشغيل محلي (باستخدام Python)
```bash
# Python 3:
python -m http.server 8000

# أو Python 2:
python -m SimpleHTTPServer 8000

# ثم افتح: http://localhost:8000
```

### د. أو تشغيل بـ Node.js
```bash
npm install -g http-server
http-server .
```

---

## 3️⃣ إعدادات Firebase (30 دقيقة)

### أ. أنشئ حساب Firebase
1. اذهب إلى https://console.firebase.google.com
2. اضغط "Add Project"
3. اكتب اسم المشروع
4. اضغط "Create project"

### ب. فعّل Authentication
1. من القائمة الجانبية → Build → Authentication
2. اضغط "Get started"
3. اختر "Email/Password"
4. اضغط "Enable"

### ج. أنشئ Firestore Database
1. من القائمة → Build → Firestore Database
2. اضغط "Create database"
3. اختر "Start in test mode"
4. اختر المنطقة الأقرب
5. اضغط "Create"

### د. احصل على بيانات المشروع
1. من الصفحة الرئيسية اضغط أيقونة </> (Web)
2. سجل التطبيق
3. انسخ الإعدادات
4. الصقها في `firebase-config.js`

### هـ. حدّث firebase-config.js
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 4️⃣ اختبر المشروع

### أ. تسجيل الدخول
```
اختر: "دخول كمدير"
سيتم إنشاء الحساب تلقائياً
```

### ب. أضف بيانات تجريبية
انظر إلى `sample-data.js` وأضف البيانات:
```javascript
// في console المتصفح:
seedSampleData();
```

### ج. اختبر كل دور
- مدير: أضف تصنيف
- عميل: احجز خدمة
- بائع: قبل الطلب
- مندوب: حدث حالة التوصيل

---

## 5️⃣ النشر على الويب (45 دقيقة)

### أ. ثبّت Firebase CLI
```bash
npm install -g firebase-tools
```

### ب. سجّل الدخول
```bash
firebase login
```

### ج. ابدأ Hosting
```bash
firebase init hosting
```

### د. نشّر
```bash
firebase deploy
```

### هـ. احصل على الرابط
```
Your web app is live at: https://your-project.web.app
```

---

## 📋 قائمة التحقق

- [ ] تثبيت المشروع محلياً
- [ ] إعداد Firebase (Auth + Firestore)
- [ ] تحديث firebase-config.js
- [ ] اختبار جميع الأدوار
- [ ] إضافة بيانات تجريبية
- [ ] نشر على Firebase Hosting
- [ ] اختبار النسخة المباشرة

---

## 🆘 استحالة حل المشاكل الشائعة

### ❌ "Firebase is not defined"
**الحل:** تأكد من تحميل firebase-config.js قبل الأكواد الأخرى

### ❌ "Database permission denied"
**الحل:** تحقق من Firestore Rules (استخدم Test Mode أولاً)

### ❌ "CORS error"
**الحل:** استخدم http-server بدلاً من فتح الملف مباشرة

### ❌ "Auth error"
**الحل:** تأكد من تفعيل Email/Password في Firebase Console

### ❌ "رسالة عربية غريبة"
**الحل:** تحقق من ترميز UTF-8 في الملفات

---

## 📞 الدعم

- 📖 اقرأ README.md
- 🛠️ اقرأ SETUP.md
- ✨ اقرأ FEATURES.md
- 📋 اقرأ IMPLEMENTATION.md

---

**هل تواجه مشكلة؟ اسأل في قسم Issues! 📌**
