# Paid Event Publishing – Credit-Based Implementation (Firebase + Paystack)

*Revised to match current codebase (`Node/Express` backend, **Firestore** via `firebase-admin`, **Paystack** for payments)*

---

## 1. Business Rules

| Tier | Monthly free paid-event credits | After credits | Welcome credit |
|------|---------------------------------|---------------|----------------|
| **Free** | 0 | Full listing fee | 1 first-ever credit |
| **Premium** | 4 + 1(extra... just thought of it) | 80 % discount | ✓ |
| **Enterprise / Partner** | 12 | 80 % discount | ✓ |

* Prices (`listingFee`, `discountRate`) will be supplied later via remote config / env, so all logic must accept dynamic values.

---

## 2. Firestore Schema

```
users/{uid}
  tier               "free" | "premium" | "enterprise"
  tierExpiresAt      ISO string (premium only)
  welcomeCreditUsed  boolean

creditBuckets/{uid}_{YYYYMM}
  uid
  periodStart        "2024-05-01"
  periodEnd          "2024-05-31"
  creditsAllocated   0 | 4 | 10
  creditsUsed        number

events/{eventId}
  ...existing fields
  listingFee         number  // 0 when credit applied
  creditApplied      "welcome" | "monthly" | null
  paymentReference   Paystack ref (when >0)
  status             draft | pending_payment | published
```

*No manual console work is needed; `creditBuckets` docs are created automatically when a user first publishes in a new month.*

---

## 3. Backend Changes (Express)

### 3.1 Credit Service – `backend/services/creditService.js`
```js
const { db } = require('../firebase');
const { PRICING } = require('../config/pricing');

exports.calculateListingCost = async (uid) => {
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const user = userSnap.data();

  // 1) Welcome credit
  if (!user.welcomeCreditUsed) {
    await userRef.update({ welcomeCreditUsed: true });
    return { price: 0, creditType: 'welcome' };
  }

  // 2) Monthly credit bucket
  const periodKey = new Date().toISOString().slice(0, 7); // "2024-05"
  const bucketRef = db.doc(`creditBuckets/${uid}_${periodKey}`);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(bucketRef);
    const tier = user.tier || 'free';
    const allocated = PRICING.monthlyCredits[tier] || 0;
    let bucket = snap.exists ? snap.data() : {
      uid, periodStart: `${periodKey}-01`, periodEnd: `${periodKey}-31`,
      creditsAllocated: allocated, creditsUsed: 0,
    };

    if (bucket.creditsUsed < bucket.creditsAllocated) {
      bucket.creditsUsed++;
      tx.set(bucketRef, bucket);
      return { price: 0, creditType: 'monthly' };
    }

    const discount = tier !== 'free' ? PRICING.premiumDiscount : 1;
    return { price: PRICING.basePrice * discount, creditType: null };
  });
};
```

### 3.2 Create Event (edit existing controller)
1. Validate payload.
2. `const { price, creditType } = await CreditService.calculateListingCost(uid);`
3. If `price === 0` → write event `published`.
4. Else → call Paystack **Transaction Initialize** (`/transaction/initialize`) with amount; store `paymentReference`; event `pending_payment`.

### 3.3 Paystack Webhooks (`routes/subscriptionRoutes.js` already exists)
Add handler for `charge.success` where `metadata.eventId` is present → mark event `published`.

---

## 4. Front-End (Expo)

*File: `src/screens/events/CreateEventScreen.tsx`*

1. Add Paid/Free toggle.
2. Cost chip shows: `Free (welcome credit)`, `Free (2 of 4 left)`, `R XX with discount`, `R XX`.
3. On publish:
   * POST `/events`.
   * If `cost > 0` → open Paystack WebView (already used in subscription flow) passing `authorization_url`.
   * On success redirect/deeplink, refetch event status.

Credits indicator component can hit new endpoint `/users/me/credits` to show remaining.

---

## 5. Cron / Scheduled Function

*We keep it minimal & non-intrusive:*

• **Monthly credit reset** – Cloud Scheduler → HTTPS Firebase Function `/admin/credits/reset?month=YYYYMM`.
 – Scans users with tier ≠ free and pre-creates next month’s bucket doc.
 – Does not modify existing docs → negligible risk.

No extra buckets or rules are required in Firebase Console; Firestore collections auto-create.

---

## 6. Config
`backend/config/pricing.js`
```js
module.exports = {
  basePrice: 50,            // ZAR placeholder
  premiumDiscount: 0.2,     // 80 % off = price * premiumDiscount
  monthlyCredits: {
    free: 0,
    premium: 4,
    enterprise: 10,
  },
};
```
Values can be tuned later without code changes.

---

## 7. Deployment Steps
1. Add `creditService.js`, update event controller, deploy Cloud Function.
2. Front-end: show cost chip & handle Paystack flow.
3. QA with `basePrice=0` for safe launch.
4. Enable pricing via config when ready.

---

### Intrusiveness
• **Data**: Only two new collections (`creditBuckets`, fields in `users`).
• **Jobs**: One monthly scheduled function; reads & writes small docs (<1 KB each). No heavy cron.
• **Payments**: Re-uses existing Paystack integration, so no extra PCI scope.

All changes are incremental and reversible, minimising impact on existing app behaviour. 