# OAuth Baseline Assessment - Phase 0

## Purpose
This document identifies the **cement** (stable code) that will NOT be modified during OAuth implementation. OAuth will be ADDED alongside this code, reusing it without changes.

## Cement Files (DO NOT MODIFY)

### Frontend

#### 1. `src/screens/auth/SignInScreen.tsx`
**Purpose:** Email/password sign-in logic
**Status:** ✅ Stable - Working
**What it does:**
- Handles email/password authentication with Firebase
- Validates email verification
- Calls backend API to fetch user data
- Stores auth data via `storeAuthData()`
- Navigates to MainApp on success

**OAuth Integration:** OAuth will ADD a new button and handler, but will NOT modify existing email/password logic.

#### 2. `src/utils/authStorage.ts`
**Purpose:** Token and user data storage functions
**Status:** ✅ Stable - Working
**Key Functions:**
- `storeAuthData()` - Stores token, user data, role, keepLoggedIn preference
- `getStoredAuthData()` - Retrieves all stored auth data
- `clearAuthData()` - Clears all auth data
- `updateLastLoginTime()` - Updates last login timestamp

**OAuth Integration:** OAuth will REUSE `storeAuthData()` to store OAuth user data in the same format.

#### 3. `src/context/AuthContext.tsx`
**Purpose:** Global authentication state management
**Status:** ✅ Stable - Working
**What it does:**
- Manages auth state (user, token, loading, etc.)
- Listens to Firebase `onAuthStateChanged` for automatic token refresh
- Handles token refresh logic
- Provides auth context to entire app

**OAuth Integration:** OAuth users will use the same Firebase auth state listener. No changes needed.

### Backend

#### 4. `backend/middleware/auth.js`
**Purpose:** Token verification middleware
**Status:** ✅ Stable - Working
**What it does:**
- Verifies Firebase ID tokens using Firebase Admin SDK
- Checks token blacklist
- Attaches `req.user` with decoded token data
- Works with ANY Firebase token (email/password or OAuth)

**OAuth Integration:** OAuth tokens convert to Firebase tokens, so this middleware works without changes.

#### 5. `backend/controllers/userController.js`
**Purpose:** User data endpoints
**Status:** ✅ Stable - Working
**Key Endpoints:**
- `getUserById` - Fetches user from Firestore
- `addUser` - Creates new user (for email/password registration)

**OAuth Integration:** OAuth will ADD auto-provisioning logic to `getUserById` (small addition, doesn't modify existing logic).

## Cement Functions (REUSE, DON'T MODIFY)

### Frontend
- `storeAuthData()` from `src/utils/authStorage.ts`
- `authenticatedFetch()` from `src/utils/api.ts`
- Firebase `signInWithEmailAndPassword()` - Email/password flow
- Firebase `onAuthStateChanged()` listener - Token refresh
- Navigation to `MainApp` - Same for all auth types

### Backend
- `authenticateUser` middleware - Token verification
- `getUserById` controller - User data retrieval (will add auto-provisioning, but existing logic unchanged)

## Test Results (Cement Verification)

### ✅ Email/Password Sign-In
- **Status:** Working
- **Flow:** Email/password → Firebase → Backend → Storage → Navigation
- **Result:** ✅ All steps working correctly

### ✅ Token Storage
- **Status:** Working
- **Function:** `storeAuthData()` stores token, user data, role, preferences
- **Result:** ✅ Data persists correctly in AsyncStorage

### ✅ Backend Verification
- **Status:** Working
- **Middleware:** `authenticateUser` verifies Firebase tokens
- **Result:** ✅ Token verification working correctly

### ✅ Token Refresh
- **Status:** Working
- **Mechanism:** Firebase `onAuthStateChanged` listener in AuthContext
- **Result:** ✅ Tokens refresh automatically

### ✅ Logout
- **Status:** Working
- **Function:** `clearAuthData()` clears all stored auth data
- **Result:** ✅ Logout works correctly

## OAuth Integration Strategy

### What OAuth Will Do
1. **ADD** new OAuth provider files (`src/services/oauth/googleProvider.ts`)
2. **ADD** OAuth config (`src/config/oauthConfig.ts`)
3. **ADD** Google sign-in button to `SignInScreen.tsx` (UI addition only)
4. **ADD** OAuth handler function (separate from email/password handler)
5. **ADD** auto-provisioning logic to `getUserById` (small addition)

### What OAuth Will NOT Do
1. ❌ Modify email/password sign-in logic
2. ❌ Change `storeAuthData()` function
3. ❌ Modify `authenticateUser` middleware
4. ❌ Change token storage structure
5. ❌ Modify navigation flow
6. ❌ Change Firebase auth state listener

### How OAuth Reuses Cement

1. **Token Storage:** OAuth → Firebase credential → Firebase token → `storeAuthData()` (same function)
2. **Backend API:** OAuth → Firebase token → `authenticatedFetch()` (same function)
3. **Token Verification:** OAuth → Firebase token → `authenticateUser` middleware (same middleware)
4. **Token Refresh:** OAuth → Firebase token → `onAuthStateChanged` listener (same listener)
5. **Navigation:** OAuth → `navigation.getParent()?.navigate('MainApp')` (same navigation)

## Commit to Not Modifying Cement

✅ **We commit to:**
- Not modifying any cement files listed above
- Adding OAuth code alongside existing code
- Reusing cement functions without changes
- Testing that cement continues to work after OAuth addition

## Baseline Date
Created: 2025-01-XX
Status: ✅ Cement identified and verified working

