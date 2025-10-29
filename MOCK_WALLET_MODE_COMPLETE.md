# Mock Wallet Mode Implementation - COMPLETE ✅

## Overview
Mock mode has been successfully implemented! You can now fully test the wallet pass feature without Apple Developer certificates or Google Cloud setup.

## What's Been Implemented

### Backend

1. **Mock Wallet Service** (`backend/services/mockWalletService.js`)
   - Generates unsigned .pkpass files (Apple Wallet format)
   - Generates Google Wallet pass JSON
   - Includes all pass data, images, and QR codes
   - No certificate validation required

2. **Updated Wallet Pass Service** (`backend/services/walletPassService.js`)
   - Checks `WALLET_MOCK_MODE` environment variable
   - Routes to mock service when enabled
   - Routes to production services when disabled

3. **Updated Card Controller** (`backend/controllers/cardController.js`)
   - Detects mock mode
   - Adds `X-Mock-Mode: true` header to responses
   - Returns mock passes with appropriate MIME types
   - New preview endpoint: `GET /Cards/:userId/wallet/:cardIndex/preview`

4. **Environment Configuration**
   - Added `WALLET_MOCK_MODE=true` to environment variables
   - Easy toggle between mock and production mode

### Frontend

1. **Updated CardsScreen** (`src/screens/cards/CardsScreen.tsx`)
   - Detects mock mode from response headers
   - Saves mock passes to device storage
   - Shows appropriate success messages
   - File sharing functionality

2. **File Saving**
   - **iOS**: Saves to `Documents/wallet-passes/`
   - **Android**: Saves to `Files/wallet-passes/`
   - Can share files via native share sheet

3. **Dependencies Added**
- `expo-file-system` - File operations
- `expo-sharing` - Share functionality
- `archiver` (backend) - ZIP file creation
- `passkit-generator` (backend) - Apple Wallet pass generation

## How to Use Mock Mode

### 1. Enable Mock Mode

In your `backend/.env` file:
```bash
WALLET_MOCK_MODE=true
```

### 2. Start Your Backend

```bash
cd backend
npm install  # Install new dependencies
npm start
```

### 3. Rebuild Your App

```bash
npm install  # Install new frontend dependencies
npx expo run:android  # or npx expo run:ios
```

### 4. Test the Feature

1. Open the XS Card app
2. Go to Cards screen
3. Tap "Add to Wallet"
4. You'll see a success message with file location
5. Option to share the file

## What You Can Test (Without Certificates)

✅ **Pass Structure** - Verify pass.json contains all fields  
✅ **Data Population** - All card data appears correctly  
✅ **Image Loading** - Profile image and company logo included  
✅ **Image Download** - Images downloaded from URLs  
✅ **QR Code Generation** - Correct saveContact URL  
✅ **Template Selection** - Basic/premium templates  
✅ **RBAC** - Free vs premium user restrictions  
✅ **Platform Detection** - iOS vs Android handling  
✅ **API Flow** - Full request/response cycle  
✅ **Error Handling** - Missing data, network errors  
✅ **UI States** - Loading, success, error messages  
✅ **File Saving** - Save to device storage  
✅ **File Sharing** - Share via native options  

## How to Inspect Mock Passes

### Apple Wallet (.pkpass)

1. Find the file in `Documents/wallet-passes/`
2. Share the file to your computer or cloud storage
3. Rename from `.pkpass` to `.zip`
4. Unzip the file
5. View `pass.json` - Contains all pass data
6. View `manifest.json` - File hashes
7. Check images (logo.png, thumbnail.png, etc.)
8. Read `README_MOCK.txt` - Explains the mock pass

### Google Wallet (.json)

1. Find the file in `Files/wallet-passes/`
2. Share the file or open in text editor
3. View the complete Google Wallet pass structure
4. Verify all fields, barcode, and image URLs

## Mock Mode Features

### What's Included

- ✅ Complete pass structure (same as production)
- ✅ All user data (name, company, email, phone)
- ✅ Images embedded in pass
- ✅ QR code with saveContact URL
- ✅ Manifest with file hashes
- ✅ Template styling (colors, layout)
- ✅ README explaining it's a mock pass

### What's NOT Included

- ❌ Digital signature (requires Apple certificates)
- ❌ Wallet app integration (requires signing)
- ❌ Pass updates (requires production setup)

## Switching to Production Mode

When you have certificates configured:

1. **Update Environment Variable**
   ```bash
   WALLET_MOCK_MODE=false
   ```

2. **Add Certificates** (see `WALLET_PASS_SETUP_GUIDE.md`)
   - Place Apple certificates in `backend/certificates/`
   - Add Google service account JSON

3. **Restart Backend**
   ```bash
   cd backend
   npm start
   ```

4. **Test with Real Wallet Apps**
   - iOS: Passes open in Apple Wallet
   - Android: Passes open in Google Wallet

## File Locations

### Development
- iOS: `DocumentDirectory/wallet-passes/`
- Android: `Downloads/XSCard/wallet-passes/` (or app-specific directory)

### File Naming
- Format: `{name}_{cardIndex}_{timestamp}.pkpass` or `.json`
- Example: `JohnDoe_0_1234567890.pkpass`

## Testing Workflow

1. **Generate Pass**
   - Tap "Add to Wallet"
   - See "[Mock Mode] Generating..." in logs
   - File saved to device

2. **Inspect Pass**
   - Share file to computer
   - Unzip .pkpass or open .json
   - Verify all data correct

3. **Iterate**
   - Fix any data issues in your cards
   - Regenerate pass
   - Verify fixes

4. **Ready for Production**
   - All data verified ✅
   - Images loading ✅
   - QR code correct ✅
   - Switch to production mode
   - Add real certificates
   - Test in actual wallet apps

## Console Logs

Mock mode adds helpful logs:

```
🔧 [Mock Mode] Wallet Pass Service running in MOCK MODE
   Unsigned passes will be generated for testing
   Set WALLET_MOCK_MODE=false for production

[Mock Mode] Generating unsigned Apple Wallet pass
[Mock Mode] Unsigned .pkpass generated successfully
[Mock Mode] Sending mock wallet pass
[Mock Mode] Received mock wallet pass
[Mock Mode] Pass saved to: /path/to/file
```

## Success Messages

After generating a mock pass:

```
🔧 Mock Pass Saved!
File saved to: Documents/wallet-passes/

This is a mock pass for testing. 
You can inspect the file structure.

Note: Mock passes won't open in Apple/Google Wallet.

[Share File] [OK]
```

## Troubleshooting

### "Mock mode not working"
- Check `WALLET_MOCK_MODE=true` in backend/.env
- Restart backend server
- Check console for "[Mock Mode]" logs

### "File not saving"
- Check file system permissions
- Try sharing the file instead
- Check console for error messages

### "Images not in pass"
- Check image URLs are accessible
- Verify images load in Cards screen
- Check backend logs for image download errors

## Benefits of Mock Mode

✅ **Immediate Testing** - No setup required  
✅ **Data Validation** - Verify everything correct  
✅ **Image Verification** - Confirm images load  
✅ **Structure Inspection** - Understand pass format  
✅ **Quick Iteration** - Fast development cycle  
✅ **Learning Tool** - See how passes work  
✅ **Safe Development** - No production credentials  
✅ **Full Feature Testing** - Everything except signing  

## Next Steps

1. ✅ Mock mode is working
2. ⏳ Test on real devices
3. ⏳ Verify all card data appears correctly
4. ⏳ Check images are embedded
5. ⏳ Inspect pass structure
6. ⏳ Set up production certificates
7. ⏳ Switch to production mode
8. ⏳ Test with real wallet apps

## Support

If you encounter issues:
- Check console logs for detailed error messages
- Verify `WALLET_MOCK_MODE=true` in environment
- Ensure all dependencies installed
- Check file system permissions
- Review the mock pass README_MOCK.txt

The implementation is complete and ready for testing! 🎉
