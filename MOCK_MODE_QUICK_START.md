# Mock Wallet Mode - Quick Start Guide

## TL;DR

Mock mode lets you test wallet passes **without** Apple/Google certificates. Passes are saved to your device for inspection.

## Quick Setup (3 Steps)

### 1. Enable Mock Mode
```bash
# backend/.env
WALLET_MOCK_MODE=true
```

### 2. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend (in project root)
npm install
```

**Note:** If you get package version errors, the dependencies have been updated to use correct versions:
- `passkit-generator` instead of `@walletpass/pass-js`
- `expo-sharing@~12.0.1` instead of `~13.0.3`

### 3. Start Testing
```bash
# Backend
cd backend
npm start

# Frontend (new terminal)
npx expo run:android  # or npx expo run:ios
```

## How It Works

1. **Tap "Add to Wallet"** in your app
2. **Pass generates** without certificates  
3. **File saves** to device storage
4. **Alert shows** with file location
5. **Option to share** the file

## What You Get

- ✅ Complete `.pkpass` (iOS) or `.json` (Android) file
- ✅ All your card data included
- ✅ Images embedded
- ✅ QR code generated
- ✅ Can be inspected/shared

## File Locations

**iOS**: `Documents/wallet-passes/`  
**Android**: `Files/wallet-passes/`

## Inspect the Pass

### iOS (.pkpass)
```bash
# 1. Get file from device
# 2. Rename file.pkpass to file.zip
# 3. Unzip
# 4. Open pass.json
```

### Android (.json)
```bash
# 1. Get file from device
# 2. Open in text editor
# 3. View the JSON structure
```

## Switch to Production

```bash
# backend/.env
WALLET_MOCK_MODE=false

# Then add your certificates (see WALLET_PASS_SETUP_GUIDE.md)
```

## Troubleshooting

**Not working?**
1. Check `WALLET_MOCK_MODE=true` in backend/.env
2. Restart backend: `npm start`
3. Check logs for "[Mock Mode]"

**Can't find file?**
- Use "Share File" button in success alert
- Check app file permissions

**Images missing?**
- Check images load in Cards screen
- Verify image URLs are accessible

## Console Logs to Look For

```
🔧 [Mock Mode] Wallet Pass Service running in MOCK MODE
[Mock Mode] Generating unsigned Apple Wallet pass
[Mock Mode] Pass saved to: /path/to/file
```

## What's Being Tested

✅ Pass data structure  
✅ All card fields  
✅ Image loading & embedding  
✅ QR code generation  
✅ File saving  
✅ Share functionality  

## What's NOT Tested

❌ Pass signing (needs certificates)  
❌ Wallet app integration (needs signing)  
❌ Opening in Apple/Google Wallet  

---

**That's it!** You're now testing the full wallet pass feature without any certificates. When ready for production, just switch `WALLET_MOCK_MODE=false` and add your certificates.

For detailed instructions, see:
- `MOCK_WALLET_MODE_COMPLETE.md` - Full implementation details
- `WALLET_PASS_SETUP_GUIDE.md` - Certificate setup for production
