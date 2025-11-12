# React Native Crash Debugging Guide

## 🚨 CRASH FIXED: translateX String to Number Conversion

### **Crash Details:**
- **Date:** [Current Date]
- **Error:** `FATAL EXCEPTION: main`
- **Root Cause:** `com.facebook.react.bridge.UnexpectedNativeTypeException: Value for translateX cannot be cast from String to double`
- **Location:** React Native Bridge → TransformHelper.processTransform()

### **What Happened:**
The app crashed immediately after showing "Welcome back" message due to invalid CSS transform values in React Native.

### **The Problem:**
```typescript
// ❌ CAUSED CRASH
transform: [{ translateX: '-50%' }],  // String value
```

### **The Solution:**
```typescript
// ✅ FIXED
transform: [{ translateX: -50 }],     // Numeric value
```

### **Files Fixed:**
1. `src/components/AdminHeader.tsx` - Line 171
2. `src/components/Header.tsx` - Line 316

---

## 🔍 Debugging Method: ADB Logcat

### **Prerequisites:**
- Android device connected via USB
- USB debugging enabled
- ADB installed: `C:\Users\[username]\AppData\Local\Android\Sdk\platform-tools\`

### **Step-by-Step Process:**

#### **1. Connect Device**
```bash
adb devices
# Should show: R58NB1WMSQF device
```

#### **2. Clear Log Buffer**
```bash
adb logcat -c
```

#### **3. Start Logging**
```bash
adb logcat > crash_logs.txt
```

#### **4. Reproduce Crash**
- Open the app
- Perform action that causes crash
- Wait 3-5 seconds after crash

#### **5. Stop Logging**
- Press `Ctrl+C` to stop

#### **6. Analyze Logs**
```bash
# Search for your app package
grep "com.p.zzles.xscard" crash_logs.txt

# Search for fatal errors
grep "FATAL\|AndroidRuntime\|ReactNativeJS" crash_logs.txt

# Get logs for specific process
adb shell logcat -d --pid=[PID_NUMBER]
```

### **Key Log Patterns to Look For:**
- `FATAL EXCEPTION: main`
- `AndroidRuntime: Shutting down VM`
- `ReactNativeJS: [Error]`
- `com.facebook.react.bridge.UnexpectedNativeTypeException`

---

## 🛠️ Common React Native Crash Causes:

### **1. Type Mismatches (Like Our Case)**
- String values where numbers expected
- Object values where primitives expected
- Solution: Convert to correct type

### **2. Navigation Errors**
- Screen not found
- Navigator not properly configured
- Solution: Check navigation setup

### **3. Native Module Issues**
- Missing native dependencies
- Incorrect native module setup
- Solution: Check native module configuration

### **4. Memory Issues**
- Large image processing
- Infinite loops
- Solution: Optimize memory usage

---

## 📱 Production vs Development Crashes:

### **Development Mode:**
- Shows detailed error messages
- Red screen with stack trace
- Easier to debug

### **Production Mode (APK):**
- Silent crashes
- Need ADB logs to debug
- Use this guide's method

---

## 🔧 Quick Fix Checklist:

1. **Check for type mismatches** in transform properties
2. **Verify navigation setup** and screen names
3. **Check native module dependencies**
4. **Look for memory leaks** or infinite loops
5. **Verify all imports** are correct
6. **Check for null/undefined** values

---

## 📞 When to Use This Method:

- App crashes silently in production
- No error messages shown
- Development mode works fine
- Need to debug native-level issues
- React Native bridge errors

---

*Last Updated: [Current Date]*
*Branch: androiddeploys*
