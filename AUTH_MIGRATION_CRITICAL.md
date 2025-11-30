# 🚨 CRITICAL: Firebase Authentication Migration Issue

## The Problem

**Your user account exists in `xscard-addd4` but NOT in `xscard-dev`**

This is why you're getting "invalid credentials" - the account literally doesn't exist in the new project yet.

## Quick Solution (5 minutes)

### Option A: Create Your Account Manually in xscard-dev

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select the **xscard-dev** project
3. Click **Authentication** → **Users** tab
4. Click **"Add user"**
5. Fill in:
   - Email: `pule@xspark.co.za`
   - Password: `Password.10`
6. Click **"Add user"**
7. Find the user in the list and click the three dots → **"Verify email"**

**Now try logging in again - it should work!**

## Complete Solution: Migrate All Users

### Step 1: Get Service Account Keys

You need service account keys for both projects:

1. **For xscard-addd4 (source)**:
   - Go to Firebase Console → xscard-addd4
   - Settings (gear icon) → Service Accounts
   - Click "Generate New Private Key"
   - Save as: `backend/source-serviceAccount.json`

2. **For xscard-dev (destination)**:
   - Go to Firebase Console → xscard-dev
   - Settings (gear icon) → Service Accounts
   - Click "Generate New Private Key"
   - Save as: `backend/dest-serviceAccount.json`

### Step 2: Run Migration Script

```bash
cd backend

# Dry run first (see what would be migrated)
node scripts/migrate-auth-users.js --dry-run

# Actually migrate users
node scripts/migrate-auth-users.js
```

### Step 3: Important Password Note

⚠️ **Firebase cannot migrate password hashes between projects.**

After migration:
- Users will exist in xscard-dev
- BUT they'll need to reset their passwords
- Send password reset emails to all users:

```bash
# After migration, each user needs to reset password
# You can send bulk password reset emails via Firebase Console
```

## Alternative: Stay on xscard-addd4 For Now

If you're not ready to migrate, you can:

1. Keep using `xscard-addd4` (it has your Blaze plan anyway)
2. Update the backend to use `xscard-addd4` instead of `xscard-dev`
3. Update the frontend `.env` back to `xscard-addd4`

This is simpler if you haven't finished setting up `xscard-dev` yet.

## Recommendation

**For testing right now**: Use Option A - just create your account manually in xscard-dev

**For production**: 
- If you have many users → Stay on xscard-addd4
- If you have few users → Migrate all users and send password reset emails

## What Happens After

Once your account exists in xscard-dev:
1. Frontend authenticates against xscard-dev ✅
2. Gets token for xscard-dev ✅
3. Backend validates token from xscard-dev ✅
4. Everything works ✅

