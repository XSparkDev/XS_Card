# RBAC Backend Values → UI Elements Mapping

This document provides a visual mapping of which backend values control which UI elements in the XSCard app.

---

## Backend Value: `plan`

**Type:** `'free' | 'premium' | 'enterprise'`  
**Source:** Backend API `/Users` endpoint  
**Storage:** `AsyncStorage.userData.plan` + `AuthContext.user.plan`

### UI Elements Controlled

#### ✅ When `plan === 'free'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Unlock Premium" button | ✅ SHOWN | SettingsScreen.tsx | 325-332 |
| **SettingsScreen** | "Manage Subscription" button | ❌ HIDDEN | SettingsScreen.tsx | 334-341 |
| **Header** | "Add Card" button | ❌ HIDDEN | Header.tsx | 217-223 |
| **Header** | "Dashboard" menu item | ❌ HIDDEN | Header.tsx | 240-248 |
| **UnlockPremium** | Pricing & payment UI | ✅ SHOWN | UnlockPremium.tsx | 590-783 |
| **UnlockPremium** | Premium status badge | ❌ HIDDEN | UnlockPremium.tsx | 587-588 |
| **CreateEvent** | Image upload limit | 1 image max | CreateEventScreen.tsx | 95-96 |
| **Cards** | Card creation limit | 1 card max | Via Header add button | 217 |

#### ✅ When `plan === 'premium'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Unlock Premium" button | ❌ HIDDEN | SettingsScreen.tsx | 325-332 |
| **SettingsScreen** | "Manage Subscription" button | ✅ SHOWN | SettingsScreen.tsx | 334-341 |
| **SettingsScreen** | Plan badge shows "Premium" | ✅ SHOWN | SettingsScreen.tsx | 314 |
| **Header** | "Add Card" button | ✅ SHOWN | Header.tsx | 217-223 |
| **Header** | "Dashboard" menu item | ✅ SHOWN | Header.tsx | 240-248 |
| **UnlockPremium** | Pricing & payment UI | ❌ HIDDEN | UnlockPremium.tsx | 590-783 |
| **UnlockPremium** | Premium status badge | ✅ SHOWN | UnlockPremium.tsx | 517-573 |
| **UnlockPremium** | "Cancel Subscription" button | ✅ SHOWN | UnlockPremium.tsx | 562-570 |
| **AdminDashboard** | Full dashboard access | ✅ ALLOWED | AdminDashboard.tsx | 119 |
| **CreateEvent** | Image upload limit | 5 images max | CreateEventScreen.tsx | 95-96 |
| **Cards** | Card creation limit | 10 cards max | Via Header add button | 217 |

#### ✅ When `plan === 'enterprise'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **Header** | "Add Card" button | ❌ HIDDEN | Header.tsx | 217 |
| **Header** | "Dashboard" menu item | ✅ SHOWN | Header.tsx | 240-248 |
| **AdminDashboard** | Full dashboard access | ✅ ALLOWED | AdminDashboard.tsx | 119 |
| **CreateEvent** | Image upload limit | 10 images max | CreateEventScreen.tsx | 95-96 |
| **Cards** | Card creation limit | Unlimited | Via Header add button | 217 |

---

## Backend Value: `organiserStatus`

**Type:** `string | undefined`  
**Source:** Backend API `/Users` endpoint, `/api/event-organisers/status`  
**Storage:** `AsyncStorage.userData.organiserStatus`

### UI Elements Controlled

#### ✅ When `organiserStatus === undefined` or `'not_registered'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Become an Event Organiser" button | ✅ SHOWN | SettingsScreen.tsx | 343-350 |
| **SettingsScreen** | Other organiser status badges | ❌ HIDDEN | SettingsScreen.tsx | 352-379 |
| **CreateEvent** | "Paid Event" option | ❌ DISABLED | CreateEventScreen.tsx | 98 |
| **CreateEvent** | "Bulk Registrations" toggle | ❌ DISABLED | CreateEventScreen.tsx | 80 |

#### ✅ When `organiserStatus === 'pending_banking_details'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Complete Organiser Registration" button | ✅ SHOWN | SettingsScreen.tsx | 352-359 |
| **SettingsScreen** | Badge shows "Finish setting up payment account" | ✅ SHOWN | SettingsScreen.tsx | 356 |
| **CreateEvent** | "Paid Event" option | ❌ DISABLED | CreateEventScreen.tsx | 98 |
| **CreateEvent** | "Bulk Registrations" toggle | ❌ DISABLED | CreateEventScreen.tsx | 80 |

#### ✅ When `organiserStatus === 'pending_verification'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Organiser Registration Pending" badge | ✅ SHOWN | SettingsScreen.tsx | 361-369 |
| **SettingsScreen** | Badge shows "Your account is being reviewed" | ✅ SHOWN | SettingsScreen.tsx | 365 |
| **SettingsScreen** | No action button (just info) | No arrow icon | SettingsScreen.tsx | 366 |
| **CreateEvent** | "Paid Event" option | ❌ DISABLED | CreateEventScreen.tsx | 98 |
| **CreateEvent** | "Bulk Registrations" toggle | ❌ DISABLED | CreateEventScreen.tsx | 80 |

#### ✅ When `organiserStatus === 'active'`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SettingsScreen** | "Event Organiser" badge (green check) | ✅ SHOWN | SettingsScreen.tsx | 371-379 |
| **SettingsScreen** | Badge shows "You can create paid events" | ✅ SHOWN | SettingsScreen.tsx | 375 |
| **CreateEvent** | "Paid Event" option | ✅ ENABLED | CreateEventScreen.tsx | 98 |
| **CreateEvent** | "Bulk Registrations" toggle | ✅ ENABLED | CreateEventScreen.tsx | 80 |
| **CreateEvent** | Ticket price input field | ✅ ENABLED | CreateEventScreen.tsx | - |
| **Events API** | Can publish paid events | ✅ BACKEND ALLOWS | Backend | - |
| **Events API** | Can create bulk registrations | ✅ BACKEND ALLOWS | Backend | - |

---

## Backend Value: `emailVerified`

**Type:** `boolean`  
**Source:** Firebase Auth `firebaseUser.emailVerified`  
**Storage:** `AuthContext.isEmailVerified`

### UI Elements Controlled

#### ✅ When `emailVerified === false`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **All Screens** | **ENTIRE APP BLOCKED** | User cannot authenticate | AuthContext.tsx | 194-205 |
| **AuthContext** | Error message shown | "Email not verified. Please check your inbox." | AuthContext.tsx | 203 |
| **AuthContext** | Auth data cleared | User logged out | AuthContext.tsx | 198-200 |

#### ✅ When `emailVerified === true`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **All Screens** | Full app access | Authentication proceeds | AuthContext.tsx | 207-323 |

---

## Backend Value: `subscriptionData.isActive`

**Type:** `boolean`  
**Source:** Backend API `/subscription/status`  
**Storage:** Component state in `UnlockPremium`, synced to `userData.plan`

### UI Elements Controlled

#### ✅ When `isActive === true`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **Header** | Plan verification | Confirms premium status | Header.tsx | 68-72 |
| **UnlockPremium** | Shows subscription details | Next billing date, amount, interval | UnlockPremium.tsx | 534-560 |
| **UnlockPremium** | "Cancel Subscription" button | ✅ SHOWN | UnlockPremium.tsx | 562-570 |
| **SettingsScreen** | "Manage Subscription" button | ✅ SHOWN | SettingsScreen.tsx | 334-341 |

#### ✅ When `isActive === false`

| Screen | UI Element | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **Header** | Plan set to 'free' | Triggers downgrade | Header.tsx | 69 |
| **UnlockPremium** | Pricing & payment UI | ✅ SHOWN | UnlockPremium.tsx | 590-783 |

---

## Backend Value: `isAuthenticated`

**Type:** `boolean`  
**Source:** Computed from `userToken !== null && user !== null` in AuthContext  
**Storage:** `AuthContext.isAuthenticated`

### UI Elements Controlled

#### ✅ When `isAuthenticated === false`

| Screen | Navigation | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SplashScreen** | Navigate to Auth stack | Shows SignIn screen | SplashScreen.tsx | - |
| **All Screens** | Redirect to SignIn | User cannot access app | Navigation | - |

#### ✅ When `isAuthenticated === true`

| Screen | Navigation | Behavior | File | Line |
|--------|-----------|----------|------|------|
| **SplashScreen** | Navigate to MainApp | Shows main interface | SplashScreen.tsx | - |
| **All Screens** | Full app access | User can navigate freely | Navigation | - |

---

## Backend Value: `keepLoggedIn`

**Type:** `boolean`  
**Source:** User preference, stored in AsyncStorage  
**Storage:** `AsyncStorage.keepLoggedIn`, `AuthContext.keepLoggedIn`

### Behavior Controlled

| Scenario | `keepLoggedIn === true` | `keepLoggedIn === false` |
|----------|------------------------|--------------------------|
| **Token expires (401 error)** | Attempt token refresh | Force logout immediately |
| **App restart** | Restore session | Show login screen |
| **Manual logout** | Clear preference | Already false |
| **Firebase signout** | Attempt restore | Clear all data |

**Files:**
- Token refresh logic: `api.ts` lines 388-420
- Preference storage: `authStorage.ts` lines 26-53
- Auth restore: `AuthContext.tsx` lines 383-433

---

## Backend Value: `userToken`

**Type:** `string` (JWT Bearer token)  
**Source:** Backend API + Firebase Auth  
**Storage:** `AsyncStorage.userToken`, `AuthContext.userToken`

### Behavior Controlled

| Scenario | With Valid Token | Without Token |
|----------|-----------------|---------------|
| **API Requests** | Authenticated requests | 401 Unauthorized |
| **Token Refresh** | Refreshes if > 50 min old | N/A |
| **App Launch** | Restore session | Show login |
| **Backend Calls** | Include in Authorization header | Block request |

**Files:**
- Token in API calls: `api.ts` lines 181-211
- Token refresh: `api.ts` lines 214-306
- Token validation: `api.ts` lines 309-378

---

## Backend Value: `lastLoginTime`

**Type:** `number` (timestamp)  
**Source:** Stored on successful login  
**Storage:** `AsyncStorage.lastLoginTime`

### Behavior Controlled

| Token Age | Behavior |
|-----------|----------|
| < 50 minutes | Token considered valid |
| > 50 minutes | Trigger automatic refresh |
| Not found | Token considered expired |

**Files:**
- Token age check: `api.ts` lines 492-523
- Set on login: `AuthContext.tsx` lines 222, 236, 288
- Updated on refresh: `api.ts` lines 238, 285

---

## Combined RBAC Scenarios

### Scenario 1: Free User Wants to Add a Second Card

```
Checks:
1. isAuthenticated → ✅ Yes
2. emailVerified → ✅ Yes
3. plan → 'free'
4. Card limit → 1 card max

Result:
- "Add Card" button in Header → ❌ HIDDEN (line 217)
- User navigates to Cards screen
- No way to create second card
- Must upgrade to premium
```

### Scenario 2: Premium User Wants to Create Paid Event

```
Checks:
1. isAuthenticated → ✅ Yes
2. emailVerified → ✅ Yes
3. plan → 'premium'
4. organiserStatus → 'not_registered'

Result:
- Can access CreateEvent screen
- "Paid Event" toggle → ❌ DISABLED (line 98)
- Alert shown: "Register as organiser to create paid events"
- Redirected to OrganiserRegistration
```

### Scenario 3: Active Organiser Creates Paid Event

```
Checks:
1. isAuthenticated → ✅ Yes
2. emailVerified → ✅ Yes
3. plan → 'premium'
4. organiserStatus → 'active'

Result:
- Can access CreateEvent screen
- "Paid Event" toggle → ✅ ENABLED (line 98)
- "Bulk Registrations" → ✅ ENABLED (line 80)
- Ticket price input → ✅ ENABLED
- Backend allows event publication
```

### Scenario 4: User Email Not Verified

```
Checks:
1. isAuthenticated → Attempting...
2. emailVerified → ❌ No

Result:
- Authentication BLOCKED (AuthContext line 194-205)
- All auth data cleared
- Error message: "Email not verified. Please check your inbox."
- User stuck on verification screen
- Cannot access any app features
```

### Scenario 5: Premium Subscription Expired

```
Checks:
1. isAuthenticated → ✅ Yes
2. subscriptionData.isActive → ❌ false
3. Backend returns plan → 'free'

Result:
- Header sync detects mismatch (lines 68-72)
- Updates cached plan from 'premium' to 'free'
- "Dashboard" menu item → ❌ HIDDEN
- "Manage Subscription" → ❌ HIDDEN
- "Unlock Premium" → ✅ SHOWN
- Card/image limits reduced to free tier
```

---

## Value Priority & Hierarchy

When multiple values conflict, priority is:

```
1. emailVerified (ABSOLUTE GATE - blocks everything if false)
    ↓
2. isAuthenticated (blocks app access if false)
    ↓
3. plan (controls feature access)
    ↓
4. organiserStatus (controls paid event features)
    ↓
5. subscriptionData.isActive (validates plan accuracy)
```

---

## Cache vs Backend Priority

| Value | Cache (AsyncStorage) | Backend API | Winner |
|-------|---------------------|-------------|--------|
| `plan` | Used for immediate UI | Verified on sync | Backend (after sync) |
| `organiserStatus` | Used for immediate UI | Checked on CreateEvent focus | Backend (on screen load) |
| `emailVerified` | Not cached | Firebase real-time | Firebase always |
| `userToken` | Cached | Refreshed when needed | Refreshed version |
| `subscriptionData` | Not cached | Fetched on demand | Backend always |

---

**Document Purpose:** Quick lookup for developers to understand which backend value controls which UI element.  
**Last Updated:** October 8, 2025  
**See Also:** `RBAC_SYSTEM_ANALYSIS.md` for comprehensive analysis, `RBAC_QUICK_REFERENCE.md` for code patterns.

