# XSCard RBAC Quick Reference

## Backend Values Used for UI RBAC

### Core Values from Backend

| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| **`plan`** | `'free' \| 'premium' \| 'enterprise'` | Backend API `/Users` | Primary feature control |
| **`organiserStatus`** | `string` | Backend API `/Users` | Event organiser permissions |
| `emailVerified` | `boolean` | Firebase Auth | Authentication gate |
| `subscriptionData.isActive` | `boolean` | `/subscription/status` | Premium validation |
| `userToken` | `string` | Backend + Firebase | API authentication |

---

## Plan-Based Features

### Free Plan
- ✅ 1 card
- ✅ 1 image
- ✅ Basic features
- ❌ No custom colors
- ❌ No analytics
- ❌ No QR customization
- ❌ No advanced features

### Premium Plan
- ✅ 10 cards
- ✅ 5 images
- ✅ Custom colors
- ✅ QR customization
- ✅ Analytics
- ✅ Calendar integration
- ✅ Social media integration
- ✅ 12h priority support

### Enterprise Plan
- ✅ Unlimited cards
- ✅ 10 images
- ✅ All premium features
- ✅ Priority support

---

## Organiser Status Values

| Status | Can Create Paid Events |
|--------|----------------------|
| `undefined` / `null` | ❌ |
| `'not_registered'` | ❌ |
| `'pending_banking_details'` | ❌ |
| `'pending_verification'` | ❌ |
| **`'active'`** | ✅ |

---

## UI Elements Controlled by RBAC

### Header Component
```typescript
// Add Card Button (line 217)
showAddButton && userPlan !== 'free' && userPlan !== 'enterprise'

// Dashboard Menu (line 240)
userPlan !== 'free'
```

### Settings Screen
```typescript
// Unlock Premium (line 325)
userData?.plan === 'free'

// Manage Subscription (line 334)
userData?.plan === 'premium'

// Become Organiser (line 343)
!organiserStatus || organiserStatus === 'not_registered'

// Complete Registration (line 352)
organiserStatus === 'pending_banking_details'

// Pending Verification (line 361)
organiserStatus === 'pending_verification'

// Active Organiser (line 371)
organiserStatus === 'active'
```

### Create Event Screen
```typescript
// Paid Event Creation (line 98)
isOrganiser && organiserStatus === 'active'

// Bulk Registrations
organiserStatus === 'active'

// Image Upload Limits (line 95-96)
maxImages based on plan (free: 1, premium: 5, enterprise: 10)
```

### Admin Dashboard
```typescript
// Dashboard Access (line 119)
userPlan !== 'free'
```

---

## RBAC Check Patterns

### Pattern 1: Direct Plan Check
```typescript
if (userPlan === 'free') {
  Alert.alert('Upgrade Required', 'This feature requires Premium');
  return;
}
```

### Pattern 2: Utility Function
```typescript
const result = await canPerformAction('addCards');
if (!result.allowed) {
  Alert.alert('Upgrade Required', result.message);
}
```

### Pattern 3: Organiser Check
```typescript
if (organiserStatus !== 'active') {
  Alert.alert('Organiser Registration Required');
  return;
}
```

### Pattern 4: Backend Sync
```typescript
// Check cache
const cachedPlan = await getUserPlan();

// Verify with backend
const response = await fetch(ENDPOINTS.SUBSCRIPTION_STATUS);
const actualPlan = determinePlanFromResponse(response);

// Update if mismatch
if (cachedPlan !== actualPlan) {
  await updateCachedPlan(actualPlan);
}
```

---

## Storage Locations

### AsyncStorage Keys
- `userToken` - JWT bearer token
- `userData` - User object with plan and organiserStatus
- `userRole` - Derived role ('user' | 'admin')
- `keepLoggedIn` - Session preference
- `lastLoginTime` - Token expiry tracking

### AuthContext State
```typescript
{
  user: User | null,
  userToken: string | null,
  isLoading: boolean,
  isAuthenticated: boolean,
  isEmailVerified: boolean,  // Critical gate
  keepLoggedIn: boolean,
  lastLoginTime: number | null,
  firebaseReady: boolean
}
```

---

## Backend Endpoints

### User & Auth
- `GET /Users` - Fetch user profile with plan
- `GET /subscription/status` - Validate premium status
- `POST /refresh-token` - Refresh JWT token

### Organiser
- `GET /api/event-organisers/status` - Check organiser status
- `POST /api/event-organisers/register/step1` - Business info
- `POST /api/event-organisers/register/step2` - Banking details
- `POST /api/event-organisers/register/step3` - Verification

### Events (RBAC Controlled)
- `POST /events` - Create event (authenticated)
- `POST /events/:eventId/publish` - Publish paid event (organiser only)
- `POST /api/events/:eventId/bulk-register` - Bulk registration (organiser only)

---

## Security Gates

### 1. Email Verification Gate
```typescript
if (!firebaseUser.emailVerified) {
  // Block authentication
  // Clear auth data
  // Show verification error
}
```

### 2. Token Expiry (50 minutes)
```typescript
if (tokenAge > 50 * 60 * 1000) {
  // Attempt refresh
  // If fails → Force logout
}
```

### 3. Plan Verification
- Cache-first for speed
- Backend verification for accuracy
- Multiple source checks (subscription API + user API)

---

## Key Files

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | Global auth state |
| `authStorage.ts` | Persistent storage |
| `api.ts` | Backend communication |
| `userPlan.ts` | Plan limits & utilities |
| `Header.tsx` | Navigation RBAC |
| `SettingsScreen.tsx` | Subscription UI |
| `UnlockPremium.tsx` | Payment & upgrade |
| `CreateEventScreen.tsx` | Organiser checks |

---

## Quick Decision Tree

```
User Action Request
    │
    ▼
Is user authenticated?
    │
    ├─ No → Redirect to SignIn
    │
    ▼ Yes
Is email verified?
    │
    ├─ No → Show verification modal
    │
    ▼ Yes
Requires premium feature?
    │
    ├─ Yes → Check plan === 'premium' || 'enterprise'
    │   │
    │   ├─ No → Show "Upgrade Required"
    │   └─ Yes → Allow
    │
    ▼ No
Requires organiser status?
    │
    ├─ Yes → Check organiserStatus === 'active'
    │   │
    │   ├─ No → Show "Become Organiser"
    │   └─ Yes → Allow
    │
    ▼ No
Allow action
```

---

## Platform Differences

### iOS
- Uses RevenueCat for subscriptions
- "Restore Purchases" button available
- Auto-renewable subscriptions through App Store

### Android
- Uses Paystack for payments
- Direct web payment flow
- Manual payment verification

---

## Common Issues & Solutions

### Issue: Plan shows 'free' but user paid
**Solution:** Sync check in Header.tsx (lines 44-126)
- Verifies both subscription status and user endpoint
- Updates cache if mismatch detected

### Issue: Token expired during use
**Solution:** Auto-refresh in api.ts (lines 381-489)
- Checks token age before requests
- Attempts Firebase token refresh first
- Falls back to backend refresh

### Issue: Organiser status not updating
**Solution:** Force refresh on CreateEventScreen focus
- Checks backend on screen mount
- Updates local state if changed

---

**Last Updated:** October 8, 2025  
**For detailed analysis, see:** `RBAC_SYSTEM_ANALYSIS.md`




