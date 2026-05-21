# 📱 تطبيق محجوز للموبايل — React Native

**نسخة التطبيق:** v1.0  
**تاريخ الإنشاء:** 22 أبريل 2026  
**الحالة:** 🚀 جاهز للتطوير

---

## 🎯 نظرة عامة

تطبيق موبايل متكامل لمنصة محجوز يجمع بين:
- ✅ نفس الميزات الويب
- ✅ تجربة محسّنة للموبايل
- ✅ إشعارات فورية (Push Notifications)
- ✅ واجهة سلسة وسريعة
- ✅ دعم Apple و Android

---

## 🛠️ المتطلبات

```bash
# Node.js و npm/yarn
node --version  # v14+ مطلوب
npm --version   # v6+

# React Native CLI
npm install -g react-native-cli

# Firebase Realtime
npm install -g firebase-cli
```

---

## 📦 البنية الأساسية

```
mahjooz-mobile/
├── app.json                 # Expo Configuration
├── package.json             # Dependencies
├── .env.example             # Environment Variables
├── babel.config.js          # Babel Configuration
├── 
├── src/
│   ├── api/
│   │   ├── firebase.js      # Firebase Config & Setup
│   │   ├── auth.js          # Authentication API
│   │   ├── orders.js        # Orders API
│   │   ├── chat.js          # Chat API
│   │   └── notifications.js # Notifications API
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   ├── RegisterScreen.js
│   │   │   ├── OTPScreen.js
│   │   │   └── SettingsScreen.js
│   │   │
│   │   ├── customer/
│   │   │   ├── HomeScreen.js
│   │   │   ├── CategoriesScreen.js
│   │   │   ├── ServiceDetailScreen.js
│   │   │   ├── BookingScreen.js
│   │   │   ├── OrdersScreen.js
│   │   │   ├── OrderDetailScreen.js
│   │   │   └── WalletScreen.js
│   │   │
│   │   ├── vendor/
│   │   │   ├── VendorDashboard.js
│   │   │   ├── OrdersScreen.js
│   │   │   └── EarningsScreen.js
│   │   │
│   │   ├── driver/
│   │   │   ├── DeliveriesScreen.js
│   │   │   ├── MapScreen.js
│   │   │   └── RouteScreen.js
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatListScreen.js
│   │   │   ├── ChatScreen.js
│   │   │   └── SupportScreen.js
│   │   │
│   │   └── common/
│   │       ├── RatingScreen.js
│   │       ├── NotificationsScreen.js
│   │       └── ProfileScreen.js
│   │
│   ├── components/
│   │   ├── Common/
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   ├── Card.js
│   │   │   ├── Toast.js
│   │   │   ├── Loader.js
│   │   │   └── Modal.js
│   │   │
│   │   ├── Orders/
│   │   │   ├── OrderCard.js
│   │   │   ├── OrderTimeline.js
│   │   │   └── RatingCard.js
│   │   │
│   │   ├── Chat/
│   │   │   ├── MessageBubble.js
│   │   │   ├── ChatInput.js
│   │   │   └── TicketCard.js
│   │   │
│   │   └── Navigation/
│   │       ├── BottomTabNavigator.js
│   │       ├── AuthNavigator.js
│   │       └── AppNavigator.js
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useOrders.js
│   │   ├── useChat.js
│   │   ├── useNotifications.js
│   │   └── useWallet.js
│   │
│   ├── context/
│   │   ├── AuthContext.js
│   │   ├── ThemeContext.js
│   │   └── NotificationContext.js
│   │
│   ├── utils/
│   │   ├── constants.js
│   │   ├── colors.js
│   │   ├── fonts.js
│   │   ├── formatters.js
│   │   └── validators.js
│   │
│   └── App.js              # Root Component
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── ios/                     # iOS Native Code
├── android/                 # Android Native Code
│
└── README.md
```

---

## 🚀 البدء السريع

### 1. إنشاء المشروع

```bash
# استخدام Expo (الأسهل للبدء)
npx create-expo-app mahjooz-mobile
cd mahjooz-mobile

# أو استخدام React Native CLI
npx react-native init mahjooz-mobile
cd mahjooz-mobile
```

### 2. تثبيت المكتبات الأساسية

```bash
# Navigation
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# Firebase
npm install firebase react-native-firebase

# Notifications
npm install @react-native-firebase/messaging react-native-push-notification

# UI Components
npm install react-native-paper react-native-svg

# State Management
npm install redux react-redux redux-thunk

# Other
npm install axios moment react-native-maps react-native-image-picker
```

### 3. التكوين

```bash
# Copy environment
cp .env.example .env

# Edit .env with your Firebase credentials
nano .env

# Run on iOS (macOS only)
npm run ios

# Run on Android
npm run android
```

---

## 📱 الشاشات الرئيسية

### 🔑 شاشات المصادقة

#### LoginScreen.js
```javascript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/Common/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    await login(email, password);
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        🔐 دخول محجوز
      </Text>
      
      <TextInput
        placeholder="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15, borderRadius: 8 }}
      />
      
      <TextInput
        placeholder="كلمة المرور"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, marginBottom: 20, borderRadius: 8 }}
      />
      
      <Button 
        title={loading ? "جاري الدخول..." : "دخول"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}
```

#### OTPScreen.js
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Button from '../components/Common/Button';

export default function OTPScreen({ route, navigation }) {
  const [otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const { phone } = route.params;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerifyOTP = async () => {
    // Verify OTP logic
    console.log('Verifying OTP:', otp);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        ✅ التحقق من الرقم
      </Text>
      
      <Text style={{ marginBottom: 10, color: '#666' }}>
        تم إرسال رمز التحقق إلى {phone}
      </Text>
      
      <TextInput
        placeholder="أدخل رمز التحقق (6 أرقام)"
        value={otp}
        onChangeText={setOtp}
        keyboardType="numeric"
        maxLength={6}
        style={{ borderWidth: 1, padding: 15, marginBottom: 20, fontSize: 20, borderRadius: 8 }}
      />
      
      <Text style={{ marginBottom: 20, color: timeLeft < 120 ? 'red' : '#333' }}>
        ⏱️ الوقت المتبقي: {formatTime(timeLeft)}
      </Text>
      
      <Button 
        title="التحقق"
        onPress={handleVerifyOTP}
      />
    </View>
  );
}
```

### 🏠 شاشة العميل الرئيسية

#### HomeScreen.js
```javascript
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { getAds } from '../api/orders';

export default function HomeScreen({ navigation }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    const data = await getAds();
    setAds(data);
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          👋 مرحباً بك في محجوز
        </Text>

        {/* Featured Ads */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
          📢 العروض المميزة
        </Text>
        
        <FlatList
          data={ads}
          horizontal
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={{
                marginRight: 12,
                borderRadius: 12,
                overflow: 'hidden',
                width: 280
              }}
              onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.serviceId })}
            >
              <Image 
                source={{ uri: item.image }} 
                style={{ width: '100%', height: 150 }}
              />
              <View style={{ padding: 12, backgroundColor: '#f5f5f5' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  {item.title}
                </Text>
                <Text style={{ color: '#666', marginBottom: 8, fontSize: 12 }}>
                  {item.description}
                </Text>
                <TouchableOpacity style={{ backgroundColor: '#3b82f6', padding: 10, borderRadius: 6 }}>
                  <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    اطلب الآن
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Categories */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            📁 الأقسام
          </Text>
          <TouchableOpacity 
            style={{
              backgroundColor: '#f0f9ff',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderLeftWidth: 4,
              borderLeftColor: '#3b82f6'
            }}
            onPress={() => navigation.navigate('Categories')}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>🏨 الحجوزات</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>فنادق، سيارات، تذاكر</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              backgroundColor: '#f0fdf4',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderLeftWidth: 4,
              borderLeftColor: '#22c55e'
            }}
            onPress={() => navigation.navigate('Services')}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>🔧 الخدمات</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>صيانة، تصميم، تعليم</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              backgroundColor: '#fdf2f8',
              padding: 16,
              borderRadius: 12,
              borderLeftWidth: 4,
              borderLeftColor: '#ec4899'
            }}
            onPress={() => navigation.navigate('Pharmacy')}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>💊 المتاجر الطبية</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>صيدليات، مستلزمات طبية</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
```

### 💬 شاشة الدردشة

#### ChatScreen.js
```javascript
import React, { useState, useEffect } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useChat } from '../hooks/useChat';
import MessageBubble from '../components/Chat/MessageBubble';

export default function ChatScreen({ route }) {
  const { ticketId } = route.params;
  const [message, setMessage] = useState('');
  const { messages, sendMessage, loading } = useChat(ticketId);

  const handleSend = async () => {
    if (message.trim()) {
      await sendMessage(message);
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} />
          )}
          inverted
        />

        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: '#f9fafb'
              }}
              placeholder="اكتب رسالتك..."
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity 
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#3b82f6',
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onPress={handleSend}
              disabled={loading}
            >
              <Text style={{ fontSize: 18 }}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

---

## 🔔 نظام الإشعارات

```javascript
// src/utils/notifications.js
import messaging from '@react-native-firebase/messaging';
import notifee from '@react-native-firebase/messaging';

export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled = 
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('✅ Notifications enabled');
    const token = await messaging().getToken();
    return token;
  }
}

export function handleNotificationMessage(remoteMessage) {
  if (remoteMessage.notification) {
    const { title, body, data } = remoteMessage;
    console.log('Notification received:', title, body);
    // Handle notification
  }
}

// Configure foreground notifications
messaging().onMessage(handleNotificationMessage);

// Configure background notifications
messaging().setBackgroundMessageHandler(handleNotificationMessage);
```

---

## 🎨 الألوان والتصميم

```javascript
// src/utils/colors.js
export const colors = {
  primary: '#3b82f6',      // Azure Blue
  primary_hover: '#2563eb', // Darker Blue
  secondary: '#8b5cf6',     // Purple
  danger: '#ef4444',        // Red
  warning: '#f59e0b',       // Orange
  success: '#22c55e',       // Green
  
  bg_main: '#0f0c20',       // Dark Background
  bg_card: '#1a1631',       // Card Background
  bg_hover: '#262147',      // Hover State
  
  text_main: '#ffffff',     // Main Text
  text_muted: '#a7a5b8',    // Muted Text
  text_secondary: '#8b8a9a',
  
  border: '#3a3652',        // Border Color
};
```

---

## 🔐 أمان المصادقة

```javascript
// src/api/auth.js
import firebaseApp from './firebase';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const auth = getAuth(firebaseApp);

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}
```

---

## 📦 الحزم المطلوبة

```json
{
  "dependencies": {
    "@react-navigation/native": "^6.0.0",
    "@react-navigation/bottom-tabs": "^6.0.0",
    "@react-navigation/stack": "^6.0.0",
    "react": "^18.0.0",
    "react-native": "^0.70.0",
    "firebase": "^9.0.0",
    "@react-native-firebase/messaging": "^16.0.0",
    "react-native-push-notification": "^8.0.0",
    "react-native-paper": "^5.0.0",
    "react-native-svg": "^13.0.0",
    "redux": "^4.0.0",
    "react-redux": "^8.0.0",
    "redux-thunk": "^2.0.0",
    "axios": "^0.27.0",
    "moment": "^2.29.0",
    "react-native-maps": "^1.0.0",
    "react-native-image-picker": "^5.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "^18.0.0",
    "@types/react-native": "^0.70.0"
  }
}
```

---

## 🚀 خطوات النشر

### iOS
```bash
# Build
npm run ios

# Deploy to TestFlight
eas build --platform ios
eas submit --platform ios
```

### Android
```bash
# Build
npm run android

# Deploy to Play Store
eas build --platform android
eas submit --platform android
```

---

## 📊 الميزات المخطط لها

- ✅ نظام المصادقة الكامل
- ✅ تصفح الخدمات والحجز
- ✅ نظام الدردشة
- ✅ الإشعارات الفورية
- 🔄 تتبع الموقع GPS
- 🔄 الدفع المتقدم
- 🔄 التقييمات والآراء
- 🔄 المحفظة الداخلية

---

## 📝 ملاحظات مهمة

1. **Firebase Configuration** — تأكد من تفعيل Firestore و Authentication في Firebase Console
2. **Permissions** — أضف الأذونات اللازمة في `android/app/src/main/AndroidManifest.xml`
3. **Testing** — استخدم Firebase Emulator Suite للاختبار المحلي
4. **Performance** — استخدم React.memo و useMemo لتحسين الأداء

---

## 📞 الدعم

للمساعدة والدعم:
- 📧 Email: support@mahjooz.app
- 💬 Chat: في التطبيق
- 📖 Docs: /docs

**آخر تحديث:** 22 أبريل 2026
