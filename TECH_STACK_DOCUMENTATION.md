# XSCard Mobile Application - Technical Stack Documentation

## 📱 Application Overview

**XS Card** is a comprehensive digital business card solution built as a cross-platform mobile application. It enables users to create, share, and manage professional digital business cards with premium features including event management, contact sharing, and subscription-based services.

---

## 🏗️ Core Architecture

### **Platform & Framework**
- **Framework**: React Native 0.76.9
- **Development Platform**: Expo SDK 52.0.47
- **Language**: TypeScript 5.3.3
- **Architecture**: Cross-platform (iOS & Android)
- **New Architecture**: Disabled (Legacy React Native architecture)

### **Build & Deployment**
- **Build System**: EAS Build (Expo Application Services)
- **Project ID**: `75e89bdc-a27b-4ca7-bce8-f76c910d1d47`
- **Bundle Identifiers**:
  - iOS: `com.p.zzles.xscard`
  - Android: `com.p.zzles.xscard`
- **Version Management**: Automated with `version-adjuster.js`
- **Current Version**: 207 (Build 25 for iOS)

---

## 🎨 Frontend Technologies

### **Core React Native Libraries**
```json
{
  "react": "*",
  "react-native": "0.76.9",
  "@react-navigation/native": "^7.0.14",
  "@react-navigation/native-stack": "^7.2.0",
  "@react-navigation/bottom-tabs": "*",
  "@react-navigation/stack": "^7.1.1"
}
```

### **UI & Design System**
- **Icons**: `@expo/vector-icons` (~14.0.4)
- **Fonts**: `@expo-google-fonts/montserrat` (^0.2.3)
- **Styling**: React Native StyleSheet with custom theme system
- **Color Management**: Custom color picker (`react-native-wheel-color-picker`)
- **Gradients**: `expo-linear-gradient` (~14.0.2)
- **Blur Effects**: `expo-blur` (~14.0.3)

### **Navigation & User Experience**
- **Navigation**: React Navigation v7 (Stack, Tab, Native Stack)
- **Safe Areas**: `react-native-safe-area-context` (4.12.0)
- **Screens**: `react-native-screens` (~4.4.0)
- **Gestures**: `react-native-gesture-handler` (~2.20.2)
- **Keyboard Handling**: `react-native-keyboard-aware-scroll-view` (^0.9.5)
- **Modals**: `react-native-modal` (^14.0.0-rc.1)

### **Media & Camera**
- **Camera**: `expo-camera` (~16.0.18)
- **Image Picker**: `expo-image-picker` (~16.0.6) + `react-native-image-picker` (^8.2.1)
- **Image Processing**: Custom image utilities and helpers
- **Screen Capture**: `expo-screen-capture` (~7.0.1)

### **Data & Storage**
- **Local Storage**: `@react-native-async-storage/async-storage` (1.23.1)
- **State Management**: React Context API
- **Authentication**: Firebase Authentication
- **Real-time Data**: Socket.io client (^4.8.1)

---

## 🔧 Backend Technologies

### **Server Framework**
- **Runtime**: Node.js
- **Framework**: Express.js (^4.21.2)
- **Language**: JavaScript (ES6+)
- **Port**: 8383
- **Environment**: Production-ready with comprehensive error handling

### **Database & Storage**
- **Primary Database**: Firebase Firestore
- **File Storage**: Firebase Storage (`xscard-addd4.firebasestorage.app`)
- **Authentication**: Firebase Admin SDK (^13.0.2)
- **Real-time Features**: Socket.io (^4.8.1)

### **Backend Dependencies**
```json
{
  "express": "^4.21.2",
  "firebase-admin": "^13.0.2",
  "socket.io": "^4.8.1",
  "multer": "^1.4.5-lts.1",
  "axios": "^1.7.9",
  "nodemailer": "^7.0.9",
  "@sendgrid/mail": "^8.1.4",
  "twilio": "^5.8.0",
  "express-rate-limit": "^8.1.0",
  "dotenv": "^16.4.7"
}
```

---

## 💳 Payment & Subscription Systems

### **Primary Payment Provider**
- **Platform**: RevenueCat (Unified iOS & Android)
- **Service**: `react-native-purchases` (^8.12.0)
- **Implementation**: Platform-agnostic with server-side verification
- **Security**: Webhook signature verification, zero-trust architecture

### **Payment Configuration**
- **iOS**: Apple App Store with RevenueCat
- **Android**: Google Play Store with RevenueCat
- **Web**: Paystack (legacy support)
- **Products**: Monthly and Annual subscription tiers

### **Payment Features**
- ✅ Server-side purchase verification
- ✅ Webhook integration for real-time updates
- ✅ Comprehensive error handling
- ✅ Restore purchases functionality
- ✅ Audit logging for compliance
- ✅ Atomic database transactions

---

## 🔐 Authentication & Security

### **Authentication System**
- **Provider**: Firebase Authentication
- **Methods**: Email/Password, Custom tokens
- **Token Management**: JWT with refresh token support
- **Security**: Token blacklisting, comprehensive validation

### **Security Features**
- **Rate Limiting**: Express rate limiting middleware
- **CORS**: Configured for cross-origin requests
- **File Upload Security**: MIME type validation, size limits
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses without data leakage

---

## 📧 Communication Services

### **Email Services**
- **Primary**: SendGrid (^8.1.4)
- **Fallback**: Nodemailer (^7.0.9) with SMTP
- **SMTP Server**: `srv144.hostserv.co.za:465`
- **Features**: Transactional emails, notifications, contact sharing

### **SMS Services**
- **Provider**: Twilio (^5.8.0)
- **Features**: SMS notifications, verification codes

---

## 🎯 Business Features

### **Digital Business Cards**
- **QR Code Generation**: `react-native-qrcode-svg` (^6.3.15)
- **vCard Export**: Custom vCard generator
- **Contact Sharing**: Native sharing (`react-native-share`)
- **Profile Management**: Complete profile system with image uploads

### **Event Management System**
- **Event Creation**: Full event lifecycle management
- **QR Code Scanning**: Custom QR scanner implementation
- **Bulk Registration**: Advanced bulk registration system
- **Analytics**: Event analytics and reporting
- **Payment Integration**: Paid event support

### **Contact Management**
- **Contact Storage**: Firebase Firestore
- **Contact Sharing**: Multiple sharing methods
- **Contact Import/Export**: vCard support
- **Contact Analytics**: Interaction tracking

---

## 🛠️ Development Tools & Configuration

### **Development Environment**
- **Metro Bundler**: Custom configuration for Windows optimization
- **TypeScript**: Strict mode enabled
- **Babel**: Expo Babel configuration
- **ESLint**: Code quality enforcement

### **Build Configuration**
- **EAS Build**: Production builds
- **Gradle**: Android build system
- **Xcode**: iOS build system
- **Environment Variables**: Comprehensive .env management

### **Testing & Quality**
- **Test Framework**: Jest (via Expo)
- **Type Checking**: TypeScript strict mode
- **Code Quality**: ESLint configuration
- **Error Handling**: Comprehensive error boundaries

---

## 📱 Platform-Specific Features

### **iOS Features**
- **Bundle ID**: `com.p.zzles.xscard`
- **Build Number**: 25
- **Permissions**: Camera, Photo Library
- **App Store**: RevenueCat integration
- **Push Notifications**: Firebase Cloud Messaging

### **Android Features**
- **Package Name**: `com.p.zzles.xscard`
- **Permissions**: Camera, Storage, Internet
- **Google Play**: RevenueCat integration
- **APK Generation**: Automated build process

---

## 🔄 Real-time Features

### **WebSocket Integration**
- **Library**: Socket.io (^4.8.1)
- **Authentication**: JWT-based socket authentication
- **Features**: Real-time event updates, live notifications
- **Fallback**: HTTP polling for offline scenarios

---

## 📊 Analytics & Monitoring

### **Event Tracking**
- **Custom Analytics**: Event interaction tracking
- **User Behavior**: Contact sharing analytics
- **Performance**: App performance monitoring
- **Error Tracking**: Comprehensive error logging

---

## 🚀 Deployment & Infrastructure

### **Backend Deployment**
- **Server**: Node.js production server
- **Database**: Firebase Firestore (production)
- **Storage**: Firebase Storage (production)
- **CDN**: Firebase hosting for static assets

### **Mobile Deployment**
- **iOS**: App Store via EAS Build
- **Android**: Google Play Store via EAS Build
- **OTA Updates**: Expo Updates (when applicable)

---

## 📋 Key Dependencies Summary

### **Frontend Dependencies (59 packages)**
- React Native ecosystem
- Expo SDK modules
- Navigation libraries
- UI/UX components
- Media handling libraries
- Payment integration
- Real-time communication

### **Backend Dependencies (17 packages)**
- Express.js ecosystem
- Firebase services
- Communication services
- File handling
- Security middleware
- Development tools

---

## 🔧 Configuration Files

### **Core Configuration**
- `app.json` - Expo app configuration
- `eas.json` - EAS Build configuration
- `package.json` - Frontend dependencies
- `backend/package.json` - Backend dependencies
- `tsconfig.json` - TypeScript configuration
- `metro.config.js` - Metro bundler configuration

### **Environment Configuration**
- `.env` - Environment variables
- `backend/.env` - Backend environment variables
- Firebase configuration files
- RevenueCat configuration files

---

## 📈 Performance Optimizations

### **Frontend Optimizations**
- Metro bundler optimizations for Windows
- Image optimization and caching
- Lazy loading for screens
- Memory management for large lists

### **Backend Optimizations**
- Rate limiting for API endpoints
- Database query optimization
- File upload streaming
- Caching strategies

---

## 🔒 Security Implementation

### **Data Protection**
- Firebase security rules
- JWT token validation
- File upload validation
- Input sanitization
- CORS configuration

### **Financial Security**
- RevenueCat webhook verification
- Server-side purchase validation
- Audit logging for all transactions
- Zero-trust architecture for payments

---

*This documentation represents the complete technical stack of the XSCard mobile application as of October 2025. The application is production-ready with comprehensive features for digital business card management, event handling, and subscription services.*
