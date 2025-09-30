# StoreKit Configuration Setup Instructions

## 🎯 Goal: Configure Xcode to Use StoreKit Configuration File

The StoreKit configuration file has been created at:
`ios/XSCardApp/StoreKit_Configuration.storekit`

## 📋 Manual Xcode Configuration Steps

### Step 1: Open Xcode Project
```bash
# Navigate to iOS directory and open workspace
cd /Users/mac/Desktop/Pule_Work/React/Cursor/WORK/XSCard_App/ios
open XSCardApp.xcworkspace
```

### Step 2: Add StoreKit Configuration to Project
1. **In Xcode Project Navigator:**
   - Right-click on `XSCardApp` folder
   - Select "Add Files to 'XSCardApp'"
   - Navigate to `ios/XSCardApp/StoreKit_Configuration.storekit`
   - Select the file and click "Add"

2. **Verify File is Added:**
   - You should see `StoreKit_Configuration.storekit` in the project navigator
   - Make sure it's added to the target (check the checkbox)

### Step 3: Configure Scheme for StoreKit Testing
1. **Edit Scheme:**
   - In Xcode: Product → Scheme → Edit Scheme
   - Select "Run" on the left sidebar
   - Go to "Options" tab

2. **Set StoreKit Configuration:**
   - Find "StoreKit Configuration" dropdown
   - Select "StoreKit_Configuration.storekit"
   - Click "Close"

### Step 4: Build and Test
1. **Clean Build:**
   - Product → Clean Build Folder (Cmd+Shift+K)
   - Product → Build (Cmd+B)

2. **Run in Simulator:**
   - Product → Run (Cmd+R)
   - Select iOS Simulator

## 🧪 Testing Verification

### Expected Logs (Success):
```
RevenueCat: Configuring SDK...
RevenueCat: SDK configured successfully with StoreKit support
RevenueCat: Fetching available packages...
RevenueCat: Found 2 packages
RevenueCat: Fetching subscription status...
RevenueCat initialized successfully
```

### Expected Behavior:
- ✅ No "No active account" errors
- ✅ Products load successfully
- ✅ Purchase flow works in simulator
- ✅ Subscription status checking works

## 🔧 Troubleshooting

### Issue: "No packages found"
**Solution:** Verify StoreKit configuration is selected in scheme

### Issue: "StoreKit configuration not found"
**Solution:** Ensure file is added to Xcode project target

### Issue: Products still show "READY_TO_SUBMIT"
**Solution:** This is expected - StoreKit config overrides App Store Connect

## 📱 Testing Scenarios

### Simulator Testing:
1. **Product Loading:** Should show 2 packages (Monthly/Annual)
2. **Purchase Flow:** Should complete without real payment
3. **Subscription Status:** Should update immediately
4. **Restore Purchases:** Should work in simulator

### Expected Results:
- Monthly: R159.99, 7-day free trial
- Annual: R1800.00, 7-day free trial
- Both products should be available for testing

## 🎯 Next Steps After Configuration

1. **Test in Simulator:** Verify all flows work
2. **Check Logs:** Ensure no configuration errors
3. **Test Purchase Flow:** Complete end-to-end testing
4. **Verify Webhook:** Check backend receives events (if configured)

## 📞 Support

If you encounter issues:
1. Check Xcode console for detailed logs
2. Verify StoreKit configuration is selected in scheme
3. Ensure file is properly added to project target
4. Clean and rebuild project

The StoreKit configuration file is ready - just needs to be added to Xcode project!
