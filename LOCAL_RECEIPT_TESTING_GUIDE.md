# Local Receipt Extraction Guide

## How to Test Apple Receipt Validation Locally

### Step 1: Run Your App Locally

1. **Start your backend**:
   ```bash
   cd backend
   npm start
   ```

2. **Start your iOS app** (on a real device - receipts don't work well in simulator):
   ```bash
   cd ..
   npx react-native run-ios --device
   ```

### Step 2: Make a Purchase (if you haven't already)

1. Open your app
2. Go to "Unlock Premium"
3. Make a test purchase with your sandbox Apple ID

### Step 3: Extract Receipt Data

1. **Go to Settings** → **Manage Subscription**
2. **Scroll down** to the yellow "Development Testing" section
3. **Click** "Extract Receipt Data"
4. **Check your console logs** - the receipt data will be printed there
5. **Copy the entire base64 string**

### Step 4: Test with Real Receipt

1. **Edit the test file**:
   ```bash
   cd backend
   nano test-real-receipt.js
   ```

2. **Replace the placeholder**:
   ```javascript
   const RECEIPT_DATA_PLACEHOLDER = "PASTE_YOUR_RECEIPT_DATA_HERE";
   ```

3. **Run the test**:
   ```bash
   node test-real-receipt.js
   ```

### Step 5: Verify Results

You should see:
```
[Apple Receipt] Starting validation - trying production first
[Apple Receipt] Validating with production environment
[Apple Receipt] Response status: 21007
[Apple Receipt] Error 21007 - retrying with sandbox
[Apple Receipt] Validating with sandbox environment
[Apple Receipt] Response status: 0
[Apple Receipt] ✅ Valid receipt (sandbox)
```

This confirms:
- ✅ Production tried first
- ✅ Error 21007 detected (sandbox receipt in production)
- ✅ Automatic fallback to sandbox
- ✅ Sandbox validation succeeded

## Troubleshooting

### "Receipt file not found"
- Make sure you're on a **real device** (not simulator)
- Make sure you've **made a purchase**
- Try restarting the app

### "Running in simulator"
- Receipts are not available in simulator
- You **must use a real device**

### "Permission denied"
- Make sure the app has been installed via Xcode
- Try cleaning and rebuilding

## Notes

- The "Extract Receipt Data" button **only appears in development mode** (`__DEV__`)
- It **only appears on iOS** (Platform.OS === 'ios')
- It will **not appear in production builds**
- Receipt data is sensitive - don't share it publicly

## What This Tests

✅ **Apple receipt validation** - Confirms it works with real receipts
✅ **Production/sandbox fallback** - Confirms error 21007 triggers sandbox retry
✅ **Server communication** - Confirms backend can talk to Apple servers
✅ **Apple compliance** - Confirms implementation meets Apple's requirements

## Ready for App Store Submission

Once you see successful validation with a real receipt:
- ✅ Your implementation is working
- ✅ Apple review will pass the IAP validation
- ✅ You can confidently submit to the App Store

