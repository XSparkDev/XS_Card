# Enterprise Payment Implementation Plan

## Overview
Simplified Paystack subscription system for enterprise clients. External UI collects employee count, system calculates price, generates quote, and processes yearly subscription. Paystack handles automatic renewals, payment retries, and subscription lifecycle management.

---
*# After Phase N tests pass:*
**git add .**
**git commit -m "✅ Checkpoint N: Phase N complete - all tests passing"**
**git tag checkpoint-{phase-number}**

*# To revert to Phase N:*
**git checkout checkpoint-{phase-number}**


## 🎯 Requirements Summary

1. **External UI** - Separate from main app
2. **Single Input Variable** - Number of employees
3. **Price Calculation** - Based on employee count
4. **Quote Generation** - Display final price
5. **Yearly Subscription** - Recurring annual payments (Paystack handles renewals automatically)

---

## 📋 Reusable Components from Existing Code

### ✅ Keep & Reuse

#### 1. **Paystack Configuration** (`backend/config/paystack.js`)
- ✅ `getRequestOptions()` - HTTP request configuration
- ✅ `getAuthHeader()` - Authorization header
- ✅ Paystack API endpoints configuration
- **Status:** Already exists, no changes needed

#### 2. **Payment Verification** (`backend/utils/paymentVerification.js`)
- ✅ `enhancedPaystackVerification()` - Verify transaction with Paystack
- ✅ `validateTransactionReference()` - Reference validation
- **Status:** Reuse as-is, proven reliable

#### 3. **Payment Initialization Pattern** (from `eventController.js`)
- ✅ Paystack transaction initialization
- ✅ Payment reference generation
- ✅ Metadata structure
- ✅ Callback URL setup
- **Status:** Extract and simplify

#### 4. **Payment Callback Pattern** (from `eventController.js`)
- ✅ Payment verification
- ✅ Status updates
- ✅ Success/failure handling
- **Status:** Extract and simplify

#### 5. **Webhook Security** (`backend/utils/webhookSecurity.js`)
- ✅ Signature verification
- ✅ IP whitelisting
- **Status:** Reuse for webhook security

---

## 🔄 Paystack vs Our Responsibilities

### ✅ **What Paystack Handles (100% Certain - No Code Needed):**

1. **Automatic Annual Renewals** ✅
   - Paystack charges customer automatically on subscription end date
   - No cron jobs, scheduled tasks, or manual charging needed
   - We just receive webhook when renewal happens

2. **Payment Retry Logic** ✅
   - Paystack automatically retries failed payments
   - Multiple attempts over several days (configurable in Paystack dashboard)
   - We receive webhook (`invoice.payment_failed`) for each failed attempt
   - We receive webhook (`invoice.payment_succeeded`) if retry succeeds
   - **Paystack stops retrying after max attempts** (configurable, typically 3-5 attempts over 7-14 days)
   - **No retry code needed on our side**

3. **Customer Management** ✅
   - Paystack stores customer information (email, name, phone)
   - Paystack manages customer records
   - We only store `customerCode` to reference Paystack customer
   - **No customer database needed on our side**

4. **Payment Method Storage** ✅
   - Paystack securely stores payment methods (cards, bank accounts)
   - PCI-compliant storage (we never handle card data)
   - Customer can update payment method in Paystack dashboard
   - **No payment method storage needed on our side**

5. **Invoice Generation** ✅
   - Paystack automatically generates invoices for each payment
   - Invoices available in Paystack dashboard
   - We can fetch invoice data via API if needed (optional)
   - **No invoice generation code needed**

6. **Subscription State Management** ✅
   - Paystack manages subscription states (active, cancelled, expired)
   - Paystack tracks subscription dates (start, end, next billing)
   - We receive webhooks for state changes
   - **We sync Paystack data to our DB, but Paystack is source of truth**

7. **Payment Processing** ✅
   - Paystack processes all payments (initial and renewals)
   - Handles different payment methods (card, bank transfer, etc.)
   - Handles currency conversion if needed
   - **No payment processing code needed**

### 🛠️ **What We Handle (Business Logic Only):**

1. **Quote Generation** - Calculate price based on employee count (our business rule)
2. **Paystack Plan Creation** - Create dynamic plans (one-time per employee count/price combo), **store in DB for reuse**
3. **Enterprise Account Creation** - Create account in our database after payment
4. **Webhook Verification** - Verify webhook signatures (security - we must do this)
5. **Database Updates** - Update our database based on webhook events
6. **Account Status Management** - Manage account status in our system (active/suspended)
7. **Grace Period Management** - **WE track grace period end date, WE suspend account when expired**
8. **Business Logic** - Employee count validation, pricing rules, etc.

### ⚠️ **What We Should NOT Do (Paystack Handles):**

- ❌ **Don't create cron jobs for renewals** - Paystack handles this automatically
- ❌ **Don't implement payment retry logic** - Paystack handles this automatically
- ❌ **Don't store payment methods** - Paystack handles this (PCI compliance)
- ❌ **Don't generate invoices** - Paystack handles this automatically
- ❌ **Don't manually charge customers** - Paystack handles renewals automatically
- ❌ **Don't track subscription dates manually** - Sync from Paystack via webhooks
- ❌ **Don't manage customer data** - Paystack handles customer management

---

## 🗂️ Database Schema

### New Collection: `enterprise_quotes`
```javascript
{
  quoteId: string,              // Unique quote ID
  companyName: string,          // Company name
  contactEmail: string,          // Contact email
  contactName: string,           // Contact person name
  numberOfEmployees: number,     // Single pricing variable
  calculatedPrice: number,        // Price in cents (kobo)
  currency: 'ZAR' | 'USD',      // Currency (ZAR or USD only)
  quoteStatus: 'pending' | 'accepted' | 'expired' | 'paid',
  paymentReference: string,      // Paystack reference (when paid)
  paymentUrl: string,           // Paystack payment URL
  planCode: string,             // Paystack plan code (created dynamically)
  subscriptionType: 'yearly',   // Always "yearly"
  createdAt: Timestamp,          // Quote creation time
  expiresAt: Timestamp,          // Quote expiration (30 days)
  paidAt: Timestamp,            // Payment completion time
  metadata: {
    // Additional info if needed
  }
}
```

### New Collection: `enterprise_accounts` (after payment)
```javascript
{
  enterpriseId: string,         // Unique enterprise ID
  companyName: string,
  contactEmail: string,
  contactName: string,
  numberOfEmployees: number,
  plan: 'enterprise',
  accountStatus: 'active' | 'suspended' | 'cancelled',  // Our account status
  
  // Paystack Subscription Fields (from Paystack)
  subscriptionCode: string,     // Paystack subscription code (e.g., "SUB_xyz789")
  subscriptionStatus: string,   // Paystack subscription status (active, cancelled, expired, payment_failed)
  planCode: string,             // Paystack plan code (e.g., "PLN_abc123")
  customerCode: string,         // Paystack customer code (e.g., "CUS_abc123")
  
  // Dates (synced from Paystack via webhooks)
  subscriptionStartDate: Timestamp,  // When subscription started (from Paystack)
  subscriptionEndDate: Timestamp,    // When current period ends (from Paystack)
  nextBillingDate: Timestamp,       // Next renewal date (from Paystack)
  lastBillingDate: Timestamp,        // Last successful payment (from Paystack)
  
  // Grace Period (WE TRACK THIS - Paystack doesn't manage grace periods)
  gracePeriodEndDate: Timestamp,     // When grace period ends (WE SET THIS)
  paymentFailedAt: Timestamp,        // When payment failed (for grace period calculation)
  gracePeriodDays: 7,                // Configurable grace period length (default 7 days)
  
  // Warning Banner (for suspended accounts)
  warningBanner: {
    show: boolean,              // Show warning banner
    message: string,           // Warning message
    severity: 'error' | 'warning' | 'info',
    actionRequired: boolean,
    actionUrl: string          // URL to update payment method
  },
  
  // Our tracking
  quoteId: string,               // Original quote ID
  activatedAt: Timestamp,        // Account activation time
  reactivatedAt: Timestamp,      // Account reactivation time (if suspended then reactivated)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### New Collection: `enterprise_plans` (for plan reuse)
```javascript
{
  planCode: string,             // Paystack plan code (e.g., "PLN_abc123")
  numberOfEmployees: number,     // Number of employees
  amount: number,                // Price in cents
  currency: 'ZAR' | 'USD',      // Currency
  createdAt: Timestamp           // When plan was created
}
```

**Indexes Needed:**
- Composite index on: `numberOfEmployees`, `amount`, `currency` (for fast plan lookup)

### New Collection: `error_logs` (for error tracking)
```javascript
{
  type: string,                  // Error type (e.g., 'account_creation_failure')
  error: string,                // Error message
  accountData: object,           // Context data (for debugging)
  attempt: number,               // Retry attempt number
  maxRetries: number,            // Max retries attempted
  timestamp: Timestamp           // When error occurred
}
```

---

## 🔧 Implementation Plan

### Phase 1: Core Utilities (Extract & Simplify)

#### 1.1 Create `backend/utils/enterprisePaymentUtils.js`
**Purpose:** Simplified subscription utilities for enterprise

**Functions:**
```javascript
/**
 * Calculate enterprise price based on employee count
 * Supports ZAR and USD currencies
 * @param {number} numberOfEmployees - Number of employees
 * @param {string} currency - Currency ('ZAR' or 'USD')
 * @returns {number} - Price in cents (kobo)
 */
calculateEnterprisePrice(numberOfEmployees, currency = 'ZAR')

/**
 * Find or create Paystack plan for enterprise
 * DECISION: Store in DB (`enterprise_plans`) for fast lookup
 * - Fast Lookup: O(1) database query vs O(n) API call to Paystack
 * - Reduced API Calls: Avoid hitting Paystack rate limits
 * - Offline Capability: Can check plans even if Paystack API is temporarily down
 * @param {number} numberOfEmployees - Number of employees
 * @param {number} amount - Price in cents
 * @param {string} currency - Currency ('ZAR' or 'USD')
 * @returns {Promise<string>} - Paystack plan code
 */
async findOrCreatePlan(numberOfEmployees, amount, currency)

/**
 * Initialize Paystack subscription for enterprise
 * Paystack handles: Customer creation, subscription creation, payment processing
 * We handle: Sending request with plan code
 * @param {Object} quoteData - Quote data with planCode
 * @returns {Promise<Object>} - Paystack response with payment URL
 */
async initializeEnterpriseSubscription(quoteData)

/**
 * Verify enterprise payment/subscription
 * Paystack handles: Payment verification logic
 * We handle: Calling Paystack API and processing response
 * @param {string} paymentReference - Payment reference
 * @returns {Promise<Object>} - Verification result
 */
async verifyEnterprisePayment(paymentReference)

/**
 * Get subscription status from Paystack
 * Paystack handles: Subscription state, dates, billing info
 * We handle: Fetching from Paystack API
 * @param {string} subscriptionCode - Paystack subscription code
 * @returns {Promise<Object>} - Subscription status from Paystack
 */
async getPaystackSubscriptionStatus(subscriptionCode)
```

**Plan Reuse Implementation:**
```javascript
async function findOrCreatePlan(numberOfEmployees, amount, currency) {
  // 1. Check our database first (fast lookup)
  const existingPlan = await db.collection('enterprise_plans')
    .where('numberOfEmployees', '==', numberOfEmployees)
    .where('amount', '==', amount)
    .where('currency', '==', currency)
    .limit(1)
    .get();
  
  if (!existingPlan.empty) {
    return existingPlan.docs[0].data().planCode; // Reuse existing
  }
  
  // 2. Create new plan in Paystack (with retry logic)
  let planCode;
  let attempts = 0;
  const maxRetries = 3;
  
  while (attempts < maxRetries) {
    try {
      planCode = await createPaystackPlan(numberOfEmployees, amount, currency);
      break; // Success
    } catch (error) {
      attempts++;
      console.error(`Plan creation attempt ${attempts}/${maxRetries} failed:`, error.message);
      
      // Log error
      await db.collection('error_logs').add({
        type: 'plan_creation_failure',
        error: error.message,
        numberOfEmployees,
        amount,
        currency,
        attempt: attempts,
        maxRetries,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      if (attempts === maxRetries) {
        throw new Error(`Failed to create plan after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  
  // 3. Store in our database for future reuse
  await db.collection('enterprise_plans').add({
    planCode,
    numberOfEmployees,
    amount,
    currency,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return planCode;
}
```

**Reusable Code:**
- Plan creation pattern from `subscriptionController.js` (similar to existing plan creation)
- Subscription initialization pattern (use plan code in transaction initialize)
- Payment verification from `paymentVerification.js`

---

### Phase 2: API Endpoints

#### 2.1 Create `backend/controllers/enterpriseController.js`

**Endpoints:**

##### **POST `/api/enterprise/quote`** - Generate Quote
**Purpose:** Calculate price and create quote

**Request:**
```json
{
  "companyName": "Acme Corp",
  "contactEmail": "admin@acme.com",
  "contactName": "John Doe",
  "numberOfEmployees": 50,
  "currency": "ZAR"
}
```

**Validation Rules:**
- **Company Name:** Required, 1-200 chars, alphanumeric + spaces, hyphens, underscores, ampersands, periods
- **Contact Name:** Required, 1-100 chars, letters + spaces, hyphens, apostrophes
- **Email:** Required, valid email format, max 255 chars
- **Number of Employees:** Required, integer, 1-10,000
- **Currency:** Optional, 'ZAR' or 'USD' (default: 'ZAR')

**Response:**
```json
{
  "success": true,
  "quoteId": "quote_abc123",
  "companyName": "Acme Corp",
  "numberOfEmployees": 50,
  "calculatedPrice": 60000,  // R600.00 in cents
  "currency": "ZAR",
  "priceDisplay": "R 600.00",
  "expiresAt": "2024-02-15T12:00:00Z",
  "message": "Quote generated successfully"
}
```

**Logic:**
1. Validate input using validation rules above
2. Calculate price using `calculateEnterprisePrice(numberOfEmployees, currency)`
3. Create quote document in `enterprise_quotes` collection
4. Set expiration (30 days from now)
5. Return quote with formatted price

---

##### **POST `/api/enterprise/payment/initialize`** - Initialize Subscription
**Purpose:** Create Paystack subscription (yearly recurring)

**Request:**
```json
{
  "quoteId": "quote_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "paymentUrl": "https://paystack.com/pay/xyz789",
  "paymentReference": "ent_quote123_1234567890_abc123",
  "amount": 60000,
  "currency": "ZAR",
  "subscriptionType": "yearly"
}
```

**Logic:**
1. Fetch quote by quoteId
2. Validate quote exists and status is 'pending'
3. **Check if quote already paid (duplicate payment prevention):**
   ```javascript
   if (quoteData.quoteStatus === 'paid') {
     return res.status(400).json({ error: 'Quote already paid' });
   }
   ```
4. Check quote not expired
5. **Create or get Paystack plan** using `findOrCreatePlan()`
   - Check database first (fast lookup)
   - Create in Paystack if doesn't exist (with retry logic)
   - Store planCode in database for reuse
6. Generate payment reference: `ent_{quoteId}_{timestamp}_{random}`
7. Call `initializeEnterpriseSubscription()` with quote data + planCode
   - Paystack handles: Customer creation, subscription creation, payment processing
   - We handle: Sending request with plan code
   - **Error Handling:** Retry with exponential backoff if Paystack API fails
8. Update quote with paymentReference, paymentUrl, and planCode
9. Set quote status to 'accepted'
10. Return payment URL

**Error Handling:**
- If plan creation fails: Log error, retry with exponential backoff, return user-friendly error
- If subscription initialization fails: Log error, retry with exponential backoff, return user-friendly error
- If Paystack API is down: Retry with exponential backoff, show user-friendly error message

**Rate Limiting:** 5 requests per hour per quote

---

##### **GET `/api/enterprise/payment/callback`** - Payment Callback
**Purpose:** Handle Paystack redirect after initial subscription payment

**Query Params:**
- `ref` - Payment reference

**Logic:**
1. Extract payment reference from query
2. Verify payment with `verifyEnterprisePayment()`
3. Find quote by paymentReference
4. **Check if already processed (idempotency):**
   ```javascript
   if (quoteData.quoteStatus === 'paid') {
     // Already processed, redirect to success
     return res.redirect('/enterprise-payment-success.html?quoteId=' + quoteData.quoteId);
   }
   ```
5. If payment successful:
   - **Get subscription details from Paystack** (subscriptionCode, customerCode, dates)
     - Paystack handles: Subscription state, dates, billing info
     - We handle: Fetching from Paystack API
   - **Create enterprise account with atomic transaction:**
     ```javascript
     // Use Firestore batch writes for atomicity
     const batch = db.batch();
     const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
     
     batch.set(accountRef, accountData);
     batch.update(quoteRef, { 
       quoteStatus: 'paid',
       paidAt: admin.firestore.FieldValue.serverTimestamp()
     });
     
     await batch.commit(); // Atomic - both succeed or both fail
     ```
   - **Retry logic if batch commit fails:**
     ```javascript
     async function createEnterpriseAccountWithRetry(accountData, maxRetries = 3) {
       for (let attempt = 1; attempt <= maxRetries; attempt++) {
         try {
           const batch = db.batch();
           // ... batch operations
           await batch.commit();
           return accountRef.id; // Success
         } catch (error) {
           console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
           
           // Log failure
           await db.collection('error_logs').add({
             type: 'account_creation_failure',
             error: error.message,
             accountData: accountData,
             attempt,
             maxRetries,
             timestamp: admin.firestore.FieldValue.serverTimestamp()
           });
           
           if (attempt === maxRetries) {
             throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
           }
           
           // Exponential backoff
           await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
         }
       }
     }
     ```
   - Set account status to 'active'
   - Return success page redirect
6. If payment failed:
   - Update quote status (keep as 'accepted' for retry)
   - Return failure page redirect

**Note:** Paystack webhook (`subscription.create`) will also trigger account creation (idempotent - both can run safely)

**Reusable Code:**
- Callback pattern from `eventController.js` (lines 2387-2471)
- Subscription verification pattern from `subscriptionController.js`

---

##### **POST `/api/enterprise/payment/webhook`** - Subscription Webhook
**Purpose:** Handle Paystack webhooks for subscription lifecycle events

**Webhook Processing Pattern (Handles Out-of-Order Webhooks):**
```javascript
async function handleSubscriptionWebhook(req, res) {
  // 1. Verify webhook signature (reuse webhookSecurity.js)
  const isValid = await verifyWebhookSignature(req);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 2. Acknowledge webhook immediately (Paystack best practice)
  res.status(200).json({ received: true });
  
  // 3. Process asynchronously (don't block response)
  setImmediate(async () => {
    try {
      const webhookData = req.body;
      
      // 4. Always fetch current state from Paystack before processing (handles out-of-order)
      const subscriptionCode = webhookData.data.subscription?.subscription_code;
      if (subscriptionCode) {
        const currentSubscription = await getPaystackSubscriptionStatus(subscriptionCode);
        // Use current state, not webhook state (handles out-of-order webhooks)
        webhookData.data = { ...webhookData.data, ...currentSubscription };
      }
      
      // 5. Route to appropriate handler
      await routeWebhookEvent(webhookData);
      
    } catch (error) {
      console.error('Error processing webhook:', error);
      // Log but don't throw (already acknowledged)
    }
  });
}
```

**Webhook Events Handled:**

**A. `subscription.create` - Initial Subscription Created**
- **Paystack handles:** Subscription creation, customer creation, first payment
- **We handle:** Activate enterprise account, store subscription details
- **Logic:**
  1. Extract subscriptionCode, customerCode, planCode from webhook
  2. Find quote by metadata.quoteId (primary) or subscriptionCode (fallback)
  3. **Check if already processed (idempotency):**
     ```javascript
     const account = await findAccountBySubscriptionCode(subscriptionCode);
     if (account && account.subscriptionStatus === 'active' && account.accountStatus === 'active') {
       console.log('✅ Already processed - skipping');
       return { alreadyProcessed: true };
     }
     ```
  4. Create enterprise account with subscription details (atomic transaction with retry)
  5. Set subscriptionStatus = 'active', accountStatus = 'active'

**B. `invoice.payment_succeeded` - Annual Renewal Successful**
- **Paystack handles:** Automatic renewal charge, payment processing, invoice generation
- **We handle:** Update dates in our database, keep account active, **reactivate if suspended**
- **Logic:**
  1. Extract subscriptionCode from webhook
  2. Find enterprise account by subscriptionCode
  3. **Check if already processed (idempotency):**
     ```javascript
     const lastBillingDate = account.lastBillingDate?.toDate();
     const webhookPaymentDate = new Date(webhookData.data.paid_at);
     if (lastBillingDate && lastBillingDate.getTime() === webhookPaymentDate.getTime()) {
       console.log('✅ Payment already processed - skipping');
       return { alreadyProcessed: true };
     }
     ```
  4. **Check if account is suspended (reactivation scenario):**
     ```javascript
     if (account.accountStatus === 'suspended') {
       console.log('🔄 Reactivating suspended account');
       await accountDoc.ref.update({
         accountStatus: 'active',
         subscriptionStatus: 'active',
         lastBillingDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.paid_at)),
         nextBillingDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.next_payment_date)),
         subscriptionEndDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.next_payment_date)),
         reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
         warningBanner: { show: false } // Hide warning banner
       });
       
       // Log reactivation
       await logSubscriptionEvent(account.enterpriseId, 'account_reactivated', {
         paymentDate: webhookData.data.paid_at,
         amount: webhookData.data.amount
       });
     } else {
       // Normal renewal - just update dates
       await accountDoc.ref.update({
         lastBillingDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.paid_at)),
         nextBillingDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.next_payment_date)),
         subscriptionEndDate: admin.firestore.Timestamp.fromDate(new Date(webhookData.data.next_payment_date))
       });
     }
     ```
  5. **No account creation needed** - just date updates

**C. `invoice.payment_failed` - Renewal Payment Failed**
- **Paystack handles:** Payment retry logic (automatic retries over days)
- **We handle:** Log failure, update status, **track grace period, suspend account if grace period expires**
- **Logic:**
  1. Extract subscriptionCode from webhook
  2. Find enterprise account by subscriptionCode
  3. Update subscriptionStatus = 'payment_failed' (temporary)
  4. **Set grace period (WE TRACK THIS):**
     ```javascript
     const gracePeriodDays = 7; // Configurable
     await accountDoc.ref.update({
       paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
       gracePeriodEndDate: admin.firestore.Timestamp.fromDate(
         new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
       ),
       subscriptionStatus: 'payment_failed',
       accountStatus: 'active' // Still active during grace period
     });
     ```
  5. Account stays active during grace period
  6. **Paystack will retry automatically** - we'll get another webhook if succeeds
  7. **If grace period expires and payment still failed:** We suspend account (our logic - see grace period check)

**D. `subscription.disable` - Subscription Cancelled**
- **Paystack handles:** Subscription cancellation, stopping renewals
- **We handle:** Update status, account remains active until end date
- **Logic:**
  1. Extract subscriptionCode from webhook
  2. Find enterprise account by subscriptionCode
  3. Update subscriptionStatus = 'cancelled'
  4. Account remains active until subscriptionEndDate
  5. No further renewals (Paystack stopped them)

**E. `subscription.not_renewing` - Subscription Not Renewing**
- **Paystack handles:** Marking subscription as not renewing
- **We handle:** Update status, account active until end date
- **Logic:** Same as subscription.disable

**General Webhook Logic:**
1. Verify webhook signature (reuse `webhookSecurity.js`) - **Security: We must verify**
2. Acknowledge immediately (200 response)
3. Process asynchronously
4. Always fetch current state from Paystack before processing (handles out-of-order)
5. Route to appropriate handler based on event type
6. Find enterprise account by subscriptionCode (from webhook)
   - **Fallback identification:** metadata.quoteId → subscriptionCode → customerCode
7. **Idempotency check:** Check if already processed before processing
8. Update database based on event
9. Log all events to audit log

**Reusable Code:**
- Webhook pattern from `subscriptionController.js` (lines 706-879)
- Webhook security from `webhookSecurity.js`

---

##### **GET `/api/enterprise/quote/:quoteId`** - Get Quote Status
**Purpose:** Check quote and payment status (for external UI polling)

**Response:**
```json
{
  "success": true,
  "quote": {
    "quoteId": "quote_abc123",
    "status": "paid",
    "calculatedPrice": 60000,
    "currency": "ZAR",
    "paymentStatus": "completed",
    "paidAt": "2024-01-15T10:30:00Z"
  }
}
```

**Rate Limiting:** 60 requests per hour per IP

---

##### **GET `/api/enterprise/subscription/:enterpriseId/status`** - Get Subscription Status
**Purpose:** Check subscription status (fetches latest from Paystack, syncs database)

**Logic:**
1. Find enterprise account by enterpriseId
2. **Fetch latest status from Paystack** using `getPaystackSubscriptionStatus()`
   - Paystack handles: Real-time subscription state, dates, billing info
   - We handle: Fetching from Paystack API, syncing to our database
3. **Check grace period expiration (on-demand check):**
   ```javascript
   if (account.subscriptionStatus === 'payment_failed' &&
       account.gracePeriodEndDate < now) {
     // Grace period expired, suspend account
     await suspendEnterpriseAccount(account.enterpriseId);
   }
   ```
4. Update our database with latest Paystack data (sync)
5. Return subscription status with warning banner if suspended

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "active",
    "accountStatus": "active",
    "nextBillingDate": "2025-01-15T12:00:00Z",
    "lastBillingDate": "2024-01-15T12:00:00Z",
    "subscriptionEndDate": "2025-01-15T12:00:00Z",
    "amount": 60000,
    "currency": "ZAR",
    "numberOfEmployees": 50,
    "isActive": true,
    "warningBanner": {
      "show": false
    }
  }
}
```

**If Suspended:**
```json
{
  "success": true,
  "subscription": {
    "status": "expired",
    "accountStatus": "suspended",
    "warningBanner": {
      "show": true,
      "message": "Your subscription payment failed. Please update your payment method to reactivate your account.",
      "severity": "error",
      "actionRequired": true
    }
  }
}
```

**Rate Limiting:** 60 requests per hour per IP

---

##### **POST `/api/enterprise/subscription/:enterpriseId/cancel`** - Cancel Subscription
**Purpose:** Cancel subscription (stops renewals, account active until end date)

**Logic:**
1. Find enterprise account by enterpriseId
2. **Call Paystack API:** `POST /subscription/disable`
   - Paystack handles: Cancelling subscription, stopping renewals
   - We handle: Calling Paystack API, updating our database
3. Update subscriptionStatus = 'cancelled' in our database
4. Account remains active until subscriptionEndDate (Paystack ensures this)

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled. Account active until 2025-01-15",
  "subscriptionEndDate": "2025-01-15T12:00:00Z"
}
```

**Reusable Code:**
- Cancellation pattern from `subscriptionController.js` (lines 884-1183)

---

##### **POST `/api/enterprise/subscription/:enterpriseId/update-employees`** - Update Employee Count
**Purpose:** Update employee count (creates new plan, updates subscription)

**Request:**
```json
{
  "newNumberOfEmployees": 75
}
```

**Decision: Change takes effect on next renewal (no prorating for simplicity)**

**Logic:**
1. Calculate new price using `calculateEnterprisePrice(newNumberOfEmployees, currency)`
2. Create or find new plan using `findOrCreatePlan(newNumberOfEmployees, newPrice, currency)`
3. Update Paystack subscription with new plan (changes plan, but keeps current period)
4. Update enterprise account:
   ```javascript
   await db.collection('enterprise_accounts').doc(enterpriseId).update({
     numberOfEmployees: newNumberOfEmployees,
     planCode: newPlanCode,
     // Note: current subscription period continues, new price on next renewal
     updatedAt: admin.firestore.FieldValue.serverTimestamp()
   });
   ```
5. Next renewal will use new price

**Response:**
```json
{
  "success": true,
  "message": "Employee count updated. New price will take effect on next renewal.",
  "nextRenewalDate": "2025-01-15T12:00:00Z",
  "newPrice": 75000
}
```

---

### Phase 3: Routes

#### 3.1 Create `backend/routes/enterpriseRoutes.js`
```javascript
const express = require('express');
const router = express.Router();
const enterpriseController = require('../controllers/enterpriseController');
const { getWebhookRateLimit } = require('../middleware/webhookRateLimit');
const rateLimit = require('express-rate-limit');

// Rate limiting
const quoteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many quote requests. Please try again later.'
});

const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  keyGenerator: (req) => req.body.quoteId || req.ip,
  message: 'Too many payment initialization attempts. Please try again later.'
});

const statusRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 requests per hour
  message: 'Too many status checks. Please try again later.'
});

// Public routes (no auth required - external UI)
router.post('/api/enterprise/quote', quoteRateLimit, enterpriseController.generateQuote);
router.post('/api/enterprise/payment/initialize', paymentRateLimit, enterpriseController.initializeSubscription);
router.get('/api/enterprise/payment/callback', enterpriseController.handlePaymentCallback);
router.post('/api/enterprise/payment/webhook', getWebhookRateLimit('general'), enterpriseController.handleSubscriptionWebhook);
router.get('/api/enterprise/quote/:quoteId', statusRateLimit, enterpriseController.getQuoteStatus);

// Subscription management routes (optional - for enterprise self-service)
router.get('/api/enterprise/subscription/:enterpriseId/status', statusRateLimit, enterpriseController.getSubscriptionStatus);
router.post('/api/enterprise/subscription/:enterpriseId/cancel', enterpriseController.cancelSubscription);
router.post('/api/enterprise/subscription/:enterpriseId/update-employees', enterpriseController.updateEmployeeCount);

module.exports = router;
```

**Register in `server.js`:**
```javascript
const enterpriseRoutes = require('./routes/enterpriseRoutes');
app.use('/', enterpriseRoutes);
```

---

### Phase 4: Price Calculation Logic

#### 4.1 Pricing Model
**Location:** `backend/config/enterprisePricing.js`

**Option A: Simple Linear Pricing** (Recommended for simplicity)
```javascript
const ENTERPRISE_PRICING = {
  ZAR: {
    basePrice: 10000,           // R100.00 base
    pricePerEmployee: 1000,     // R10.00 per employee
    minimumEmployees: 1,
    maximumEmployees: 10000
  },
  USD: {
    basePrice: 500,             // $5.00 base
    pricePerEmployee: 50,       // $0.50 per employee
    minimumEmployees: 1,
    maximumEmployees: 10000
  }
};

const SUPPORTED_CURRENCIES = ['ZAR', 'USD'];

function calculateEnterprisePrice(numberOfEmployees, currency = 'ZAR') {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(`Currency ${currency} not supported. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }
  
  const pricing = ENTERPRISE_PRICING[currency];
  
  if (numberOfEmployees < pricing.minimumEmployees) {
    throw new Error(`Minimum ${pricing.minimumEmployees} employees required`);
  }
  if (numberOfEmployees > pricing.maximumEmployees) {
    throw new Error(`Maximum ${pricing.maximumEmployees} employees allowed`);
  }
  
  return pricing.basePrice + (numberOfEmployees * pricing.pricePerEmployee);
}
```

**Recommendation:** Start with **Option A (Simple Linear)** for simplicity and error-free operation.

---

## 🔒 Security Considerations

### 1. **Quote Expiration**
- Quotes expire after 30 days (configurable)
- Expired quotes cannot be paid
- External UI should check expiration before showing payment button

### 2. **Payment Reference Validation**
- Unique reference per quote
- Reference format: `ent_{quoteId}_{timestamp}_{random}`
- Validate reference matches quote before processing

### 3. **Webhook Security**
- Verify Paystack signature (reuse `webhookSecurity.js`)
- IP whitelisting for Paystack webhooks
- Idempotency: Check if payment already processed

### 4. **Input Validation**
- Validate numberOfEmployees (positive integer, 1-10,000)
- Validate email format (max 255 chars)
- Validate company name (1-200 chars, alphanumeric + spaces, hyphens, underscores, ampersands, periods)
- Validate contact name (1-100 chars, letters + spaces, hyphens, apostrophes)
- Sanitize all inputs

### 5. **Rate Limiting**
- Quote generation: 10 per hour per IP
- Payment initialization: 5 per hour per quote
- Status checks: 60 per hour per IP
- Webhooks: 100 per minute (Paystack IPs)

---

## 📝 Code Structure

```
backend/
├── config/
│   ├── paystack.js                    ✅ Keep (reuse)
│   └── enterprisePricing.js          🆕 Create
├── utils/
│   ├── paymentVerification.js         ✅ Keep (reuse)
│   ├── webhookSecurity.js             ✅ Keep (reuse)
│   └── enterprisePaymentUtils.js     🆕 Create (extract & simplify)
├── controllers/
│   └── enterpriseController.js        🆕 Create (simplified payment flow)
└── routes/
    └── enterpriseRoutes.js            🆕 Create
```

---

## 🎨 External UI Requirements

### Minimal UI Flow:
1. **Form Page:**
   - Company Name (text input)
   - Contact Name (text input)
   - Contact Email (email input)
   - Number of Employees (number input)
   - Currency (dropdown: ZAR or USD)
   - Submit button → Calls `/api/enterprise/quote`

2. **Quote Display Page:**
   - Show calculated price
   - Show quote expiration
   - "Proceed to Payment" button → Calls `/api/enterprise/payment/initialize`
   - Redirects to Paystack payment page

3. **Payment Status Page:**
   - After Paystack redirect
   - Poll `/api/enterprise/quote/:quoteId` for status
   - Show success/failure message
   - If suspended, show warning banner from API response

---

## ✅ Simplifications vs. Existing Code

### Removed Complexity (vs. Individual User Subscriptions):
- ❌ No trial periods (straight to paid subscription)
- ❌ No countdown timers
- ❌ No banking data collection
- ❌ No user authentication (external UI)
- ❌ No complex subscription management UI
- ❌ No refund logic (for MVP)

### Kept Essentials:
- ✅ Paystack subscription initialization (with plan code)
- ✅ Payment verification
- ✅ Subscription webhook handling (lifecycle events)
- ✅ Payment callbacks
- ✅ Reference generation
- ✅ Metadata tracking
- ✅ Dynamic plan creation

### Paystack Handles (We Don't Need to Code):
- ✅ Automatic annual renewals (no cron jobs needed)
- ✅ Payment retry logic (no retry code needed)
- ✅ Customer management (no customer DB needed)
- ✅ Payment method storage (PCI-compliant, no card storage)
- ✅ Invoice generation (automatic)
- ✅ Subscription state management (we sync from Paystack)

---

## 🧪 Testing Checklist

### Unit Tests:
- [ ] Price calculation (various employee counts, ZAR and USD)
- [ ] Payment reference generation (uniqueness)
- [ ] Quote expiration logic
- [ ] Input validation (all rules)
- [ ] Plan reuse logic (database lookup)

### Integration Tests:
- [ ] Quote generation endpoint
- [ ] Payment initialization endpoint (with plan creation)
- [ ] Payment callback handling
- [ ] Webhook processing (all event types)
- [ ] Enterprise account creation (atomic transaction)
- [ ] Grace period tracking
- [ ] Account suspension
- [ ] Account reactivation

### Manual Tests:
- [ ] Complete payment flow (quote → payment → activation)
- [ ] Expired quote handling
- [ ] Duplicate payment prevention
- [ ] Webhook signature verification
- [ ] Out-of-order webhook handling
- [ ] Grace period expiration
- [ ] Subscription reactivation after suspension

---

## 📊 Success Metrics

1. **Simplicity:** Single variable (employee count) → price → subscription
2. **Reliability:** Zero payment processing errors
3. **Speed:** Quote generation < 1 second, payment initialization < 2 seconds
4. **Security:** All payments verified with Paystack before activation
5. **Automated:** Paystack handles all renewals automatically (no cron jobs)

---

## 🚀 Implementation Priority

### Phase 1 (MVP - Core Subscription Functionality):
1. Create `enterprisePricing.js` with simple linear pricing (ZAR and USD)
2. Create `enterprisePaymentUtils.js` with:
   - Price calculation
   - Paystack plan creation (dynamic, with DB storage for reuse)
   - Subscription initialization (with retry logic)
   - Payment verification
3. Create `enterpriseController.js` with:
   - Quote generation endpoint (with validation)
   - Subscription initialization endpoint (with duplicate prevention)
   - Payment callback handler (with atomic transactions and retry)
   - Subscription webhook handler (all lifecycle events, with idempotency)
4. Create `enterpriseRoutes.js` with rate limiting and register in server
5. Create database collections (enterprise_quotes, enterprise_accounts, enterprise_plans, error_logs)

### Phase 2 (Subscription Management):
1. Add subscription status endpoint (fetch from Paystack, sync database, check grace period)
2. Add cancel subscription endpoint
3. Add quote expiration logic
4. **Add grace period tracking and expiration check (on-demand)**
5. **Add account suspension logic (when grace period expires)**
6. Add comprehensive error handling and logging
7. Add email notifications (optional)

### Phase 3 (Polish):
1. Add subscription status polling endpoint
2. Add update employee count endpoint (next renewal, no prorating)
3. Add quote cleanup/archival job (optional)
4. Add admin dashboard for enterprise accounts (optional)
5. Add audit logging for all subscription events

---

## 🔄 Migration from Existing Code

### Code to Extract:

1. **Plan Creation** (from `subscriptionController.js` - similar pattern)
   - Extract Paystack plan creation API call
   - Adapt for dynamic enterprise plans
   - Add database storage for plan reuse
   - Add retry logic with exponential backoff

2. **Subscription Initialization** (from `subscriptionController.js` lines 59-141)
   - Extract subscription initialization with plan code
   - Simplify metadata (remove trial-specific fields)
   - Keep reference generation pattern
   - Add retry logic for Paystack API failures

3. **Payment Verification** (from `paymentVerification.js`)
   - Reuse `enhancedPaystackVerification()` as-is
   - No changes needed

4. **Subscription Callback** (from `subscriptionController.js` lines 417-520)
   - Extract subscription verification logic
   - Extract subscriptionCode, customerCode extraction
   - Replace user subscription update with enterprise account creation
   - Add atomic batch writes
   - Add retry logic for database failures
   - Simplify success/failure handling

5. **Subscription Webhook Handling** (from `subscriptionController.js` lines 706-879)
   - Extract webhook signature verification
   - Extract subscription lifecycle event handlers:
     - `subscription.create`
     - `invoice.payment_succeeded` (renewals + reactivation)
     - `invoice.payment_failed` (failed renewals + grace period)
     - `subscription.disable` (cancellations)
   - Add out-of-order webhook handling (fetch current state from Paystack)
   - Add idempotency checks
   - Replace user subscription logic with enterprise account logic

6. **Subscription Status Fetching** (from `subscriptionController.js` lines 1255-1314)
   - Extract `getPaystackSubscription()` function
   - Adapt for enterprise accounts
   - Add grace period expiration check
   - Reuse for subscription status endpoint

---

## 📌 Key Differences from Event Payments

| Feature | Event Payments | Enterprise Subscriptions |
|---------|---------------|-------------------------|
| **Authentication** | Required (user auth) | None (external UI) |
| **Input Variables** | Event type, ticket price | Number of employees only |
| **Payment Type** | One-time transaction | Yearly subscription (recurring) |
| **Post-Payment** | Event published | Enterprise account created + subscription active |
| **Complexity** | Medium (credits, subaccounts) | Low (straightforward, Paystack handles renewals) |
| **Trials** | No | No |
| **Renewals** | No | Yes (automatic via Paystack) |
| **Plan Creation** | Not needed | Dynamic (one per employee count/price) |
| **Webhooks** | `charge.success` | `subscription.create`, `invoice.payment_succeeded`, etc. |

---

## ✅ Final Checklist

### Before Implementation:
- [ ] Review and approve pricing model
- [ ] Define quote expiration period (30 days)
- [ ] Define maximum employee count (10,000)
- [ ] Design external UI mockups
- [ ] Set up Paystack webhook URL
- [ ] Configure grace period length (7 days default)

### During Implementation:
- [ ] Extract reusable code from event payments
- [ ] Create simplified enterprise utilities
- [ ] Implement quote generation (with validation)
- [ ] Implement payment initialization (with plan reuse, retry logic)
- [ ] Implement payment callbacks (with atomic transactions, retry)
- [ ] Implement webhook handling (all events, idempotency, out-of-order handling)
- [ ] Add comprehensive error handling and logging
- [ ] Add input validation (all rules)
- [ ] Add rate limiting (all endpoints)
- [ ] Add grace period tracking and expiration check
- [ ] Add account suspension and reactivation logic

### After Implementation:
- [ ] Test complete payment flow (quote → payment → activation)
- [ ] Test webhook processing (all event types)
- [ ] Test error scenarios (API failures, DB failures)
- [ ] Test idempotency (duplicate webhooks/callbacks)
- [ ] Test out-of-order webhooks
- [ ] Test grace period expiration
- [ ] Test account reactivation
- [ ] Document API endpoints
- [ ] Create external UI integration guide

---

## 🎯 Success Criteria

✅ **Simple:** One variable (employees) → price → subscription  
✅ **Reliable:** All payments verified before account activation  
✅ **Error-Free:** Comprehensive validation and error handling  
✅ **Secure:** Webhook signature verification, input validation  
✅ **Fast:** Quote generation and subscription initialization < 2 seconds  
✅ **Automated:** Paystack handles all renewals automatically (no cron jobs)

---

## 🎯 Final Summary

**Enterprise Subscription Flow:**
1. External UI → Enter employee count
2. We calculate price → Generate quote
3. We create Paystack plan (dynamic, stored in DB for reuse)
4. We initialize subscription (with plan code)
5. **Paystack handles:** Customer creation, subscription creation, payment processing
6. **Paystack handles:** Automatic annual renewals (forever)
7. **Paystack handles:** Payment retries if renewal fails
8. **We handle:** Webhook verification, database updates, account management, grace periods, suspension/reactivation

**Result:** Minimal code, maximum reliability, Paystack does the heavy lifting! 🚀

---

**Ready for Review** 🚀
