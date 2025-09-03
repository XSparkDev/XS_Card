# XSCard Widget Setup Guide

## 🎯 **Overview**
This guide explains how to set up and use XSCard widgets on both iOS and Android devices.

## 📱 **What Are XSCard Widgets?**
XSCard widgets display your digital business card QR codes directly on your device's home screen, making it easy for people to scan and save your contact information instantly.

## 🔧 **Setup Instructions**

### **iOS Setup (iPhone/iPad)**

#### **1. Build Requirements**
- Xcode 14.0 or later
- iOS 14.0 or later target
- App Groups capability enabled

#### **2. Xcode Configuration**
1. **Add Widget Extension Target:**
   - File → New → Target → iOS → Widget Extension
   - Name: "XSCardWidget"
   - Include Configuration Intent: No

2. **Enable App Groups:**
   - Select main app target → Signing & Capabilities → + Capability → App Groups
   - Add group: `group.com.xscard.widgets`
   - Repeat for widget extension target

3. **Add Widget Files:**
   - Copy all files from `ios/XSCardWidget/` to your widget extension
   - Add files to widget target in Xcode

#### **3. Build & Install**
```bash
cd ios
pod install
cd ..
npx expo run:ios
```

### **Android Setup**

#### **1. Build Requirements**
- Android Studio 4.0 or later
- Android API 21+ (Android 5.0)
- ZXing library for QR codes

#### **2. Configuration**
All Android files are already configured:
- Widget provider: `XSCardWidgetProvider.java`
- Layouts: `widget_small.xml`, `widget_medium.xml`
- Manifest registration: Complete
- Dependencies: ZXing library added

#### **3. Build & Install**
```bash
npx expo run:android
```

## 📲 **Adding Widgets to Home Screen**

### **iOS Instructions**
1. Long press on empty home screen area
2. Tap the "+" button (top left)
3. Search for "XSCard" or scroll to find it
4. Choose widget size (Small or Medium)
5. Tap "Add Widget"
6. Position widget on home screen

### **Android Instructions**
1. Long press on empty home screen area
2. Tap "Widgets" from the menu
3. Find "XSCard" in the widget list
4. Long press and drag to home screen
5. Choose widget size if prompted
6. Release to place widget

## ⚙️ **Widget Management**

### **In-App Settings**
1. Open XSCard app
2. Go to Settings → Features → Manage Widgets
3. Toggle widgets on/off for each card
4. Use "Preview Widgets" to test appearance
5. Use "Refresh All Widgets" to update home screen

### **Widget Sizes**
- **Small (2x2):** Pure QR code only
- **Medium (4x2):** QR code + card name

### **Automatic Updates**
- Widgets update when you change card data
- Manual refresh available in widget settings
- Updates respect device battery optimization

## 🔍 **Troubleshooting**

### **Widget Not Appearing**
1. Check that widgets are enabled in app settings
2. Verify you have cards created in the app
3. Try refreshing widgets from app settings
4. Restart the app and try again

### **QR Code Not Scanning**
1. Ensure good lighting when scanning
2. Hold camera steady and close enough
3. Verify card data is correct in app
4. Try refreshing the widget

### **Widget Not Updating**
1. Use "Refresh All Widgets" in app settings
2. Remove and re-add widget to home screen
3. Check internet connection
4. Restart device if needed

### **iOS Specific Issues**
- Ensure App Groups capability is enabled
- Check that both app and widget have same group ID
- Verify widget extension is built with app

### **Android Specific Issues**
- Check that widget provider is registered in manifest
- Verify SharedPreferences access
- Ensure ZXing library is included in build

## 🛡️ **Privacy & Security**
- Widget data is stored locally on device
- QR codes contain only public contact information
- No sensitive data is displayed in widgets
- Data sharing uses secure platform methods

## 📊 **Widget Data Flow**
```
App Settings → Widget Preferences → Platform Storage → Home Screen Widget
     ↓              ↓                    ↓                    ↓
Enable Cards → Save Preferences → Update Widget Data → Display QR Code
```

## 🔄 **Update Process**
1. User changes widget settings in app
2. App saves preferences to local storage
3. Widget data is updated via platform bridge
4. Home screen widgets refresh automatically
5. QR codes update with latest card information

## 📞 **Support**
If you encounter issues:
1. Check this troubleshooting guide
2. Try refreshing widgets from app settings
3. Restart the app and device
4. Contact support with specific error details

---

**Note:** Widgets require the main app to be installed and configured with at least one business card.

