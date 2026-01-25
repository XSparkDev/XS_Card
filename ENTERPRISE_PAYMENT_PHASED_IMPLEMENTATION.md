# Enterprise Payment - Phased Implementation Plan

## 🎯 Principles

1. **Incremental Steps** - Each phase builds on the previous, but can be tested independently
2. **Testable Units** - Every phase has comprehensive tests that must pass before moving forward
3. **Concrete/POOP Principle** - Don't move from phase N until ALL tests pass. Each phase is a checkpoint.
4. **Best Practices** - Follow existing codebase patterns, error handling, logging, security

---

## 📋 Phase Overview

| Phase | Name | Deliverables | Test File | Checkpoint |
|-------|------|--------------|-----------|------------|
| **Phase 0** | Foundation Setup | Config, DB schema, validation | `test-phase0-foundation.js` | ✅ **COMPLETE** |
| **Phase 1** | Pricing & Validation | Price calculation, input validation | `test-phase1-pricing.js` | ✅ **COMPLETE** |
| **Phase 2** | Quote Generation | Quote endpoint, DB writes | `test-phase2-quotes.js` | ✅ **COMPLETE** |
| **Phase 3** | Plan Management | Plan creation, DB storage, reuse | `test-phase3-plans.js` | ✅ **COMPLETE** |
| **Phase 4** | Payment Initialization | Subscription init endpoint | `test-phase4-payment-init.js` | ✅ **COMPLETE** |
| **Phase 5** | Payment Callback | Callback handler, account creation | `test-phase5-callback.js` | ✅ **COMPLETE** |
| **Phase 6** | Webhook Handling | Webhook processing, all events | `test-phase6-webhooks.js` | ✅ **COMPLETE** |
| **Phase 7** | Subscription Management | Status, cancel, employee updates | `test-phase7-management.js` | ✅ **COMPLETE** |
| **Phase 8** | Grace Period & Suspension | Grace tracking, suspension logic | `test-phase8-grace-period.js` | ✅ **COMPLETE** |
| **Phase 9** | Polish & Production | Email, cleanup, audit logging | `test-phase9-polish.js` | ✅ **COMPLETE** |

---

## ✅ Completed Phases Summary

### Phase 0: Foundation Setup ✅
**Status:** All 37 tests passing  
**Files Created:**
- `backend/schemas/enterpriseCollections.js` - Database schema documentation
- `backend/utils/enterpriseErrorLogger.js` - Error logging utilities
- `backend/routes/enterpriseRoutes.js` - Routes file structure
- `backend/test-phase0-foundation.js` - Test suite

**Key Deliverables:**
- Database collection schemas (enterprise_quotes, enterprise_accounts, enterprise_plans, error_logs)
- Centralized error logging system with Firestore fallback
- Routes file structure ready for endpoint additions
- Collection initialization function

**Test Results:** ✅ 37/37 tests passing

---

### Phase 1: Pricing & Validation ✅
**Status:** All 73 tests passing  
**Files Created:**
- `backend/config/enterprisePricing.js` - Price calculation
- `backend/utils/enterpriseValidation.js` - Input validation
- `backend/test-phase1-pricing.js` - Test suite

**Key Deliverables:**
- Price calculation based on employee count (ZAR: R100 base + R10/employee, USD: $5 base + $0.50/employee)
- Comprehensive input validation (company name, contact name, email, employee count, currency)
- Price formatting utilities
- Support for ZAR and USD currencies

**Test Results:** ✅ 73/73 tests passing

**Note:** Phase 1 was implemented before Phase 0. Phase 0 verifies Phase 1 files exist and work correctly. Both phases are fully compatible and independent.

---

### Phase 7: Subscription Management ✅
**Status:** All 17 tests passing  
**Files Created/Modified:**
- `backend/utils/enterprisePaymentUtils.js` - Added subscription disable and plan update functions
- `backend/controllers/enterpriseController.js` - Added subscription status, cancel, and employee update endpoints
- `backend/routes/enterpriseRoutes.js` - Added subscription management routes
- `backend/test-phase7-management.js` - Test suite

**Key Deliverables:**
- `getSubscriptionStatus()` endpoint (fetches status, syncs from Paystack, checks grace period)
- `cancelSubscription()` endpoint (cancels subscription with Paystack, updates database)
- `updateEmployeeCount()` endpoint (updates employee count, creates new plan, updates Paystack subscription)
- Status syncing from Paystack (on-demand)
- Grace period expiration check (on-demand)
- Subscription cancellation with Paystack API
- Employee count update (change takes effect on next renewal, no prorating)

**Test Results:** ✅ 17/17 tests passing

**Note:** Tests requiring Paystack API are skipped when `PAYSTACK_SECRET_KEY` is not configured. Configure Paystack test API key to run all tests.

---

### Phase 8: Grace Period & Suspension ✅
**Status:** All 12 tests passing  
**Files Modified:**
- `backend/utils/enterprisePaymentUtils.js` - Added `checkGracePeriodExpiration`, `suspendEnterpriseAccount`, `setGracePeriodOnPaymentFailure`, `clearGracePeriodOnPaymentSuccess`
- `backend/controllers/enterpriseController.js` - Updated `getSubscriptionStatus` to check grace period and return warning banners
- `backend/test-phase8-grace-period.js` - Test suite for grace period and suspension logic

**Key Features:**
- Grace period tracking (7 days default) on payment failure
- Automatic account suspension when grace period expires
- Warning banners for payment failures and suspensions
- Account reactivation on successful payment after suspension
- Grace period cleared on payment success

**Test Results:** ✅ 12/12 tests passing

---

### Phase 9: Polish & Production ✅
**Status:** All 9 tests passing  
**Files Created:**
- `backend/utils/enterpriseEmailService.js` - Email notification service for subscription events
- `backend/utils/enterpriseAuditLog.js` - Audit logging for all subscription lifecycle events
- `backend/test-phase9-polish.js` - Test suite for email and audit logging

**Files Modified:**
- `backend/controllers/enterpriseController.js` - Integrated email notifications and audit logging throughout
- `backend/utils/enterprisePaymentUtils.js` - Added email/audit logging to utility functions

**Key Features:**
- Email notifications for all subscription events (welcome, payment_succeeded, payment_failed, suspended, reactivated, cancelled)
- Audit logging for all subscription lifecycle events (subscription_created, payment_succeeded, payment_failed, account_suspended, account_reactivated, subscription_cancelled, employee_count_updated)
- Email templates for all subscription events
- Comprehensive error handling with graceful degradation
- Production-ready logging and monitoring

**Test Results:** ✅ 9/9 tests passing

---

## 🔄 Checkpoint System

**How to Use:**
- After completing each phase, run its test file
- **ALL tests must pass** before moving to next phase
- If tests fail, fix issues and re-run tests
- Once all tests pass, mark phase as checkpoint
- To revert to a checkpoint, use: `git checkout checkpoint-{phase-number}`

**Checkpoint Command:**
```bash
# After Phase N tests pass:
git add .
git commit -m "✅ Checkpoint N: Phase N complete - all tests passing"
git tag checkpoint-{phase-number}
```

**Revert to Checkpoint:**
```bash
# Revert to Phase N checkpoint:
git checkout checkpoint-{phase-number}
```

---

## 📦 Phase 0: Foundation Setup

### **Goal:** Set up configuration, database schema, and basic infrastructure

### **Deliverables:**
1. ✅ Verify `backend/config/enterprisePricing.js` exists and works (created in Phase 1)
2. ✅ Create database collections structure (Firestore schemas)
3. ✅ Verify `backend/utils/enterpriseValidation.js` exists and works (created in Phase 1)
4. ✅ Set up error logging structure (`backend/utils/enterpriseErrorLogger.js`)
5. ✅ Create routes file structure (`backend/routes/enterpriseRoutes.js`)
6. ✅ Create database schema documentation (`backend/schemas/enterpriseCollections.js`)

### **Files Created:**
```
backend/
├── schemas/
│   └── enterpriseCollections.js      # Database schema documentation
├── utils/
│   └── enterpriseErrorLogger.js      # Error logging utilities
└── routes/
    └── enterpriseRoutes.js           # Routes file (empty for now)
```

### **Files Verified (from Phase 1):**
```
backend/
├── config/
│   └── enterprisePricing.js          # ✅ Already exists (Phase 1)
└── utils/
    └── enterpriseValidation.js       # ✅ Already exists (Phase 1)
```

### **Database Collections:**
- `enterprise_quotes` (structure defined)
- `enterprise_accounts` (structure defined)
- `enterprise_plans` (structure defined)
- `error_logs` (structure defined)

### **Test Criteria:**
- [x] Pricing config loads correctly (verifies Phase 1 file)
- [x] Validation functions work for all input types (verifies Phase 1 file)
- [x] Database collections can be written to (structure verified)
- [x] Error logging structure works
- [x] Routes file exists and can be imported
- [x] Schema documentation exists and is complete

### **Test File:** `backend/test-phase0-foundation.js`

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 0: Foundation setup complete"
git tag checkpoint-0
```

---

## 📦 Phase 1: Pricing & Validation

### **Goal:** Implement price calculation and comprehensive input validation

### **Deliverables:**
1. ✅ Implement `calculateEnterprisePrice()` function
2. ✅ Implement input validation for all fields
3. ✅ Add validation error messages
4. ✅ Test with various inputs (edge cases)

### **Functions to Implement:**
```javascript
// backend/config/enterprisePricing.js
calculateEnterprisePrice(numberOfEmployees, currency = 'ZAR')

// backend/utils/enterpriseValidation.js
validateEnterpriseQuote(data)
validateCompanyName(name)
validateContactName(name)
validateEmail(email)
validateNumberOfEmployees(count)
validateCurrency(currency)
```

### **Test Criteria:**
- [ ] Price calculation works for ZAR (various employee counts)
- [ ] Price calculation works for USD (various employee counts)
- [ ] Price calculation throws error for invalid employee count (< 1 or > 10000)
- [ ] Price calculation throws error for unsupported currency
- [ ] Company name validation (1-200 chars, valid characters)
- [ ] Contact name validation (1-100 chars, valid characters)
- [ ] Email validation (format, max 255 chars)
- [ ] Employee count validation (integer, 1-10000)
- [ ] Currency validation (ZAR or USD only)
- [ ] All validation functions return clear error messages

### **Test Files:**
- **Unit Tests:** `backend/test-phase1-pricing.js`
- **Integration Tests:** `backend/test-e2e-phase1-pricing.js`

### **Integration Test (E2E):**

**Endpoint:** N/A (Phase 1 is utility functions only, no HTTP endpoint)

**Note:** Phase 1 tests utility functions directly. No HTTP endpoint exists for this phase, so integration tests are not applicable.

### **Dependencies:** None (standalone - can be done before Phase 0)

**Note:** Phase 1 was implemented before Phase 0. Phase 0 verifies Phase 1 files exist and work correctly. This is compatible - Phase 0 provides foundation infrastructure (error logging, schemas, routes) that Phase 1 doesn't need, but Phase 1 provides pricing/validation that Phase 0 verifies.

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 1: Pricing and validation complete"
git tag checkpoint-1
```

---

## 📦 Phase 2: Quote Generation

### **Goal:** Implement quote generation endpoint with database writes

### **Deliverables:**
1. ✅ Create `generateQuote` controller function
2. ✅ Implement quote creation in database
3. ✅ Add quote expiration logic (30 days)
4. ✅ Add rate limiting (10/hour per IP)
5. ✅ Return formatted quote response

### **Endpoint:**
```
POST /api/enterprise/quote
```

### **Request Payload:**
```json
{
  "companyName": "Test Company",
  "contactName": "John Doe",
  "contactEmail": "john@example.com",
  "numberOfEmployees": 50,
  "currency": "ZAR"
}
```

### **Success Response (201):**
```json
{
  "success": true,
  "quote": {
    "quoteId": "qte_1234567890",
    "companyName": "Test Company",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "numberOfEmployees": 50,
    "currency": "ZAR",
    "calculatedPrice": 600,
    "formattedPrice": "R 600.00",
    "quoteStatus": "pending",
    "expiresAt": "2025-02-15T10:30:00Z",
    "createdAt": "2025-01-16T10:30:00Z"
  }
}
```

### **Error Response (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    "Company name is required",
    "Employee count must be between 1 and 10000"
  ]
}
```

### **Functions to Implement:**
```javascript
// backend/controllers/enterpriseController.js
exports.generateQuote = async (req, res) => {
  // 1. Validate input
  // 2. Calculate price
  // 3. Generate quoteId
  // 4. Create quote in database
  // 5. Return quote response
}
```

### **Test Criteria:**
- [ ] Quote generation succeeds with valid input
- [ ] Quote stored in database with correct fields
- [ ] Quote expiration date set correctly (30 days from now)
- [ ] Quote ID is unique
- [ ] Validation errors return 400 status
- [ ] Rate limiting works (10/hour per IP)
- [ ] Response includes formatted price display
- [ ] Invalid employee count returns error
- [ ] Invalid email returns error
- [ ] Invalid company name returns error

### **Test Files:**
- **Unit Tests:** `backend/test-phase2-quotes.js`
- **Integration Tests:** `backend/test-e2e-phase2-quotes.js`

### **Integration Test (E2E):**

**Base URL:** `http://localhost:8383`

**Test Cases:**

1. **Valid Quote Request**
   ```bash
   POST http://localhost:8383/api/enterprise/quote
   Content-Type: application/json
   
   {
     "companyName": "Test Company",
     "contactName": "John Doe",
     "contactEmail": "john@example.com",
     "numberOfEmployees": 50,
     "currency": "ZAR"
   }
   ```
   - **Expected:** Status 201, success response with quote

2. **Invalid Employee Count**
   ```bash
   POST http://localhost:8383/api/enterprise/quote
   Content-Type: application/json
   
   {
     "companyName": "Test Company",
     "contactName": "John Doe",
     "contactEmail": "john@example.com",
     "numberOfEmployees": 0,
     "currency": "ZAR"
   }
   ```
   - **Expected:** Status 400, validation error

3. **Missing Required Fields**
   ```bash
   POST http://localhost:8383/api/enterprise/quote
   Content-Type: application/json
   
   {
     "companyName": "Test Company"
   }
   ```
   - **Expected:** Status 400, validation errors

4. **Rate Limiting**
   - Send 11 requests rapidly from same IP
   - **Expected:** 11th request returns 429 (Too Many Requests)

### **Dependencies:** Phase 0, Phase 1

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 2: Quote generation complete"
git tag checkpoint-2
```

---

## 📦 Phase 3: Plan Management

### **Goal:** Implement Paystack plan creation and database storage for reuse

### **Deliverables:**
1. ✅ Create `findOrCreatePlan()` function
2. ✅ Implement database lookup (check if plan exists)
3. ✅ Implement Paystack plan creation API call
4. ✅ Store plan in database for reuse
5. ✅ Add retry logic with exponential backoff
6. ✅ Add error logging for plan creation failures

### **Functions to Implement:**
```javascript
// backend/utils/enterprisePaymentUtils.js
async findOrCreatePlan(numberOfEmployees, amount, currency)
async createPaystackPlan(numberOfEmployees, amount, currency)
```

### **Test Criteria:**
- [ ] Plan lookup in database works (finds existing plan)
- [ ] Plan creation in Paystack works (creates new plan)
- [ ] Plan stored in database after creation
- [ ] Plan reuse works (same employee count + price + currency returns existing plan)
- [ ] Retry logic works (retries on failure with exponential backoff)
- [ ] Error logging works (plan creation failures logged)
- [ ] Different employee counts create different plans
- [ ] Different currencies create different plans
- [ ] Plan code format is correct (starts with "PLN_")

### **Test File:** `backend/test-phase3-plans.js`

### **Dependencies:** Phase 0, Phase 1, Phase 2

### **Note:** This phase requires Paystack test API key. Use test mode.

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 3: Plan management complete"
git tag checkpoint-3
```

---

## 📦 Phase 4: Subscription Initialization

### **Goal:** Implement subscription initialization endpoint with Paystack

### **Paystack API Method:**
We use **`/transaction/initialize` with `plan` parameter** (not `/subscription` endpoint) because:

✅ **For NEW customers** (our use case):
- `/transaction/initialize` with `plan` handles first payment AND creates subscription automatically
- Creates customer if needed
- Returns authorization URL for payment
- Works without existing authorization

❌ **`/subscription` endpoint** requires:
- Existing customer (who has already done a transaction)
- Existing authorization
- Only suitable for existing customers switching plans

**Reference:** [Paystack Subscriptions API](https://paystack.com/docs/payments/subscriptions/) - "Adding Plan code to a transaction" method

### **Deliverables:**
1. ✅ Create `initializeSubscription` controller function
2. ✅ Implement quote validation (exists, not expired, not paid)
3. ✅ Integrate plan creation/reuse
4. ✅ Generate payment reference
5. ✅ Call Paystack `/transaction/initialize` with `plan` parameter
6. ✅ Update quote with payment reference and URL
7. ✅ Add rate limiting (5/hour per quote)
8. ✅ Add error handling and retry logic

### **Endpoint:**
```
POST /api/enterprise/payment/initialize
```

**Note:** Endpoint name uses "payment" but it creates a subscription via Paystack's transaction/initialize with plan parameter.

### **Request Payload:**
```json
{
  "quoteId": "qte_1234567890"
}
```

### **Success Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://checkout.paystack.com/xxxxx",
  "paymentReference": "ENT_1234567890",
  "quoteId": "qte_1234567890",
  "amount": 600,
  "currency": "ZAR",
  "planCode": "PLN_1234567890"
}
```

### **Error Response (400/404):**
```json
{
  "success": false,
  "error": "Quote not found",
  "message": "The specified quote does not exist or has expired."
}
```

### **Functions to Implement:**
```javascript
// backend/controllers/enterpriseController.js
exports.initializeSubscription = async (req, res) => {
  // 1. Fetch quote
  // 2. Validate quote (exists, not expired, not paid)
  // 3. Find or create plan
  // 4. Generate payment reference
  // 5. Initialize Paystack subscription
  // 6. Update quote
  // 7. Return payment URL
}

// backend/utils/enterprisePaymentUtils.js
async initializeEnterpriseSubscription(quoteData, planCode)
generatePaymentReference(quoteId)
```

### **Test Criteria:**
- [ ] Payment initialization succeeds with valid quote
- [ ] Quote validation works (rejects expired quotes)
- [ ] Quote validation works (rejects already paid quotes)
- [ ] Plan creation/reuse integrated correctly
- [ ] Payment reference generated correctly (format: `ent_quote_{quoteId}_{timestamp}_{random}`)
- [ ] Paystack subscription initialization API called correctly
- [ ] Quote updated with payment reference and URL
- [ ] Rate limiting works (5/hour per quote)
- [ ] Error handling works (Paystack API failures)
- [ ] Retry logic works (exponential backoff)
- [ ] Response includes payment URL

### **Test Files:**
- **Unit Tests:** `backend/test-phase4-payment-init.js`
- **Integration Tests:** `backend/test-e2e-phase4-payment-init.js`

### **Integration Test (E2E):**

**Base URL:** `http://localhost:8383`

**Prerequisites:**
- Must have valid quote ID from Phase 2
- Quote must be in `pending` status
- Quote must not be expired

**Test Cases:**

1. **Valid Payment Initialization**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/initialize
   Content-Type: application/json
   
   {
     "quoteId": "qte_1234567890"
   }
   ```
   - **Expected:** Status 200, payment URL and reference returned

2. **Invalid Quote ID**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/initialize
   Content-Type: application/json
   
   {
     "quoteId": "invalid_quote_id"
   }
   ```
   - **Expected:** Status 404, "Quote not found" error

3. **Missing Quote ID**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/initialize
   Content-Type: application/json
   
   {}
   ```
   - **Expected:** Status 400, validation error

4. **Rate Limiting**
   - Send 6 requests rapidly for same quote
   - **Expected:** 6th request returns 429 (Too Many Requests)

### **Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3

### **Note:** This phase requires Paystack test API key. Use test mode.

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 4: Payment initialization complete"
git tag checkpoint-4
```

---

## 📦 Phase 5: Payment Callback

### **Goal:** Implement payment callback handler with account creation

### **Deliverables:**
1. ✅ Create `handlePaymentCallback` controller function
2. ✅ Implement payment verification with Paystack
3. ✅ Implement subscription details fetching from Paystack
4. ✅ Implement idempotency check (prevent duplicate processing)
5. ✅ Implement atomic account creation (batch writes)
6. ✅ Implement retry logic for database failures
7. ✅ Implement error logging for failures
8. ✅ Redirect to success/failure page

### **Endpoint:**
```
GET /api/enterprise/payment/callback?ref={paymentReference}
```

### **Functions to Implement:**
```javascript
// backend/controllers/enterpriseController.js
exports.handlePaymentCallback = async (req, res) => {
  // 1. Extract payment reference
  // 2. Verify payment with Paystack
  // 3. Get subscription details from Paystack
  // 4. Check idempotency (already processed?)
  // 5. Create enterprise account (atomic transaction)
  // 6. Redirect to success page
}

// backend/utils/enterprisePaymentUtils.js
async verifyEnterprisePayment(paymentReference)
async getPaystackSubscriptionStatus(subscriptionCode)
async createEnterpriseAccountWithRetry(accountData, quoteRef, maxRetries = 3)
```

### **Test Criteria:**
- [ ] Callback handler extracts payment reference correctly
- [ ] Payment verification with Paystack works
- [ ] Subscription details fetched from Paystack correctly
- [ ] Idempotency check works (skips if already processed)
- [ ] Account creation succeeds (atomic transaction)
- [ ] Quote status updated to 'paid' (atomic transaction)
- [ ] Retry logic works (database failures retry with backoff)
- [ ] Error logging works (failures logged to error_logs)
- [ ] Success redirect works
- [ ] Failure redirect works (if payment failed)
- [ ] Account created with all required fields
- [ ] Subscription dates set correctly from Paystack

### **Test Files:**
- **Unit Tests:** `backend/test-phase5-callback.js`
- **Integration Tests:** `backend/test-e2e-phase5-callback.js`

### **Integration Test (E2E):**

**Base URL:** `http://localhost:8383`

**Prerequisites:**
- Must have valid payment reference from Phase 4
- Payment must be successful in Paystack

**Test Cases:**

1. **Valid Payment Callback**
   ```bash
   GET http://localhost:8383/api/enterprise/payment/callback?ref=ENT_1234567890
   ```
   - **Expected:** HTTP 302 redirect to success page
   - **Location:** `/enterprise-payment-success.html?quoteId={quoteId}&enterpriseId={enterpriseId}`

2. **Missing Payment Reference**
   ```bash
   GET http://localhost:8383/api/enterprise/payment/callback
   ```
   - **Expected:** HTTP 302 redirect to failure page
   - **Location:** `/enterprise-payment-failure.html?error=missing_reference`

3. **Invalid Payment Reference**
   ```bash
   GET http://localhost:8383/api/enterprise/payment/callback?ref=invalid_ref_123
   ```
   - **Expected:** HTTP 302 redirect to failure page
   - **Location:** `/enterprise-payment-failure.html?error=verification_failed&ref=invalid_ref_123`

4. **Idempotency Check**
   - Call callback twice with same payment reference
   - **Expected:** Both calls succeed (idempotent), second call redirects to success without creating duplicate account

### **Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4

### **Note:** This phase requires Paystack test API key and test payment simulation.

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 5: Payment callback complete"
git tag checkpoint-5
```

---

## 📦 Phase 6: Webhook Handling

### **Goal:** Implement webhook handler for all subscription lifecycle events

### **Deliverables:**
1. ✅ Create `handleSubscriptionWebhook` controller function
2. ✅ Implement webhook signature verification
3. ✅ Implement asynchronous processing (acknowledge immediately)
4. ✅ Implement current state fetching (handles out-of-order webhooks)
5. ✅ Implement event routing (subscription.create, invoice.payment_succeeded, etc.)
6. ✅ Implement idempotency checks for all events
7. ✅ Implement account creation/update logic
8. ✅ Implement date updates for renewals
9. ✅ Add error logging

### **Endpoint:**
```
POST /api/enterprise/payment/webhook
```

### **Webhook Events to Handle:**
- `subscription.create` - Initial subscription created
- `invoice.payment_succeeded` - Annual renewal successful (or reactivation)
- `invoice.payment_failed` - Renewal payment failed
- `subscription.disable` - Subscription cancelled
- `subscription.not_renewing` - Subscription not renewing

### **Functions to Implement:**
```javascript
// backend/controllers/enterpriseController.js
exports.handleSubscriptionWebhook = async (req, res) => {
  // 1. Verify signature
  // 2. Acknowledge immediately
  // 3. Process asynchronously
  // 4. Fetch current state from Paystack
  // 5. Route to event handler
}

async handleSubscriptionCreated(webhookData)
async handleInvoicePaymentSucceeded(webhookData)
async handleInvoicePaymentFailed(webhookData)
async handleSubscriptionCancelled(webhookData)
```

### **Test Criteria:**
- [ ] Webhook signature verification works
- [ ] Invalid signature returns 401
- [ ] Webhook acknowledged immediately (200 response)
- [ ] Processing happens asynchronously
- [ ] Current state fetched from Paystack before processing
- [ ] `subscription.create` event creates account correctly
- [ ] `invoice.payment_succeeded` updates dates correctly
- [ ] `invoice.payment_succeeded` reactivates suspended account
- [ ] `invoice.payment_failed` sets grace period correctly
- [ ] `subscription.disable` updates status correctly
- [ ] Idempotency works (duplicate webhooks don't create duplicates)
- [ ] Error logging works (webhook processing failures logged)
- [ ] Out-of-order webhooks handled correctly (uses current state)

### **Test Files:**
- **Unit Tests:** `backend/test-phase6-webhooks.js`
- **Integration Tests:** `backend/test-e2e-phase6-webhooks.js`

### **Integration Test (E2E):**

**Base URL:** `http://localhost:8383`

**Prerequisites:**
- Must generate valid HMAC-SHA512 signature
- Use `PAYSTACK_SECRET_KEY` for signature generation

**Test Cases:**

1. **Valid subscription.create Webhook**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/webhook
   Content-Type: application/json
   x-paystack-signature: {valid_hmac_signature}
   
   {
     "event": "subscription.create",
     "data": { ... }
   }
   ```
   - **Expected:** Status 200, "Webhook processed successfully"

2. **Invalid Webhook Signature**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/webhook
   Content-Type: application/json
   x-paystack-signature: invalid_signature_123
   
   {
     "event": "subscription.create",
     "data": { ... }
   }
   ```
   - **Expected:** Status 401, "Invalid webhook signature"

3. **Missing Webhook Signature**
   ```bash
   POST http://localhost:8383/api/enterprise/payment/webhook
   Content-Type: application/json
   
   {
     "event": "subscription.create",
     "data": { ... }
   }
   ```
   - **Expected:** Status 401, "Missing webhook signature"

4. **IP Whitelisting (Production)**
   - Request from non-Paystack IP
   - **Expected:** Status 403, "Forbidden" (if IP whitelisting enabled)

5. **All Event Types**
   - Test: `subscription.create`, `invoice.payment_succeeded`, `invoice.payment_failed`, `subscription.disable`, `subscription.not_renewing`
   - **Expected:** All return Status 200 when valid

### **Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5

### **Note:** This phase requires Paystack test webhook simulation.

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 6: Webhook handling complete"
git tag checkpoint-6
```

---

## 📦 Phase 7: Subscription Management

### **Goal:** Implement subscription status, cancellation, and employee count updates

### **Deliverables:**
1. ✅ Create `getSubscriptionStatus` endpoint
2. ✅ Create `cancelSubscription` endpoint
3. ✅ Create `updateEmployeeCount` endpoint
4. ✅ Implement status syncing from Paystack
5. ✅ Implement grace period expiration check (on-demand)
6. ✅ Implement subscription cancellation with Paystack
7. ✅ Implement employee count update (next renewal, no prorating)

### **Endpoints:**
```
GET /api/enterprise/subscription/:enterpriseId/status
POST /api/enterprise/subscription/:enterpriseId/cancel
POST /api/enterprise/subscription/:enterpriseId/update-employees
```

### **Functions to Implement:**
```javascript
// backend/controllers/enterpriseController.js
exports.getSubscriptionStatus = async (req, res) => {
  // 1. Find account
  // 2. Fetch latest from Paystack (sync)
  // 3. Check grace period expiration
  // 4. Update database with latest Paystack data
  // 5. Return status with warning banner if suspended
}

exports.cancelSubscription = async (req, res) => {
  // 1. Find account
  // 2. Call Paystack API to disable subscription
  // 3. Update database status
  // 4. Return response
}

exports.updateEmployeeCount = async (req, res) => {
  // 1. Find account
  // 2. Calculate new price
  // 3. Create or find new plan
  // 4. Update Paystack subscription with new plan
  // 5. Update database
  // 6. Return response
}
```

### **Test Criteria:**
- [ ] Status endpoint fetches account correctly
- [ ] Status endpoint syncs from Paystack correctly
- [ ] Status endpoint checks grace period expiration
- [ ] Status endpoint returns warning banner if suspended
- [ ] Cancel endpoint calls Paystack API correctly
- [ ] Cancel endpoint updates database correctly
- [ ] Cancel endpoint returns correct response
- [ ] Employee count update calculates new price correctly
- [ ] Employee count update creates/finds new plan correctly
- [ ] Employee count update updates Paystack subscription correctly
- [ ] Employee count update updates database correctly
- [ ] Employee count update returns correct response (next renewal date)

### **Test Files:**
- **Unit Tests:** `backend/test-phase7-management.js`
- **Integration Tests:** `backend/test-e2e-phase7-management.js`

### **Integration Test (E2E):**

**Base URL:** `http://localhost:8383`

**Prerequisites:**
- Must have valid `enterpriseId` from Phase 5

#### **1. Get Subscription Status Tests:**

```bash
GET http://localhost:8383/api/enterprise/subscription/{enterpriseId}/status
```
- **Expected:** Status 200, subscription data with synced Paystack status

```bash
GET http://localhost:8383/api/enterprise/subscription/invalid_id/status
```
- **Expected:** Status 404, "Enterprise account not found"

#### **2. Cancel Subscription Tests:**

```bash
POST http://localhost:8383/api/enterprise/subscription/{enterpriseId}/cancel
Content-Type: application/json

{}
```
- **Expected:** Status 200, cancellation confirmation

```bash
POST http://localhost:8383/api/enterprise/subscription/invalid_id/cancel
Content-Type: application/json

{}
```
- **Expected:** Status 404, "Enterprise account not found"

#### **3. Update Employee Count Tests:**

```bash
POST http://localhost:8383/api/enterprise/subscription/{enterpriseId}/update-employees
Content-Type: application/json

{
  "newNumberOfEmployees": 75
}
```
- **Expected:** Status 200, update confirmation with new plan

```bash
POST http://localhost:8383/api/enterprise/subscription/{enterpriseId}/update-employees
Content-Type: application/json

{
  "newNumberOfEmployees": 0
}
```
- **Expected:** Status 400, validation error (must be 1-10000)

### **Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 7: Subscription management complete"
git tag checkpoint-7
```

---

## 📦 Phase 8: Grace Period & Suspension

### **Goal:** Implement grace period tracking and account suspension logic

### **Deliverables:**
1. ✅ Implement grace period setting on payment failure
2. ✅ Implement grace period expiration check function
3. ✅ Implement account suspension function
4. ✅ Integrate grace period check in status endpoint
5. ✅ Implement warning banner in API responses
6. ✅ Test grace period flow end-to-end

### **Functions to Implement:**
```javascript
// backend/utils/enterprisePaymentUtils.js
async checkGracePeriodExpiration(enterpriseAccount)
async suspendEnterpriseAccount(enterpriseId)
```

### **Test Criteria:**
- [ ] Grace period set correctly on payment failure (7 days default)
- [ ] Grace period end date calculated correctly
- [ ] Grace period expiration check works
- [ ] Account suspension works (sets status, adds warning banner)
- [ ] Warning banner included in status endpoint response
- [ ] Suspended account still accessible (can update payment method)
- [ ] Grace period cleared on successful payment
- [ ] Account reactivated correctly (from Phase 6, verify here)
- [ ] Warning banner hidden on reactivation

### **Test File:** `backend/test-phase8-grace-period.js`

### **Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 8: Grace period and suspension complete"
git tag checkpoint-8
```

---

## 📦 Phase 9: Polish & Production

### **Goal:** Add email notifications, audit logging, quote cleanup, and production readiness

### **Deliverables:**
1. ✅ Implement email notifications (subscription events)
2. ✅ Implement audit logging (all subscription lifecycle events)
3. ✅ Implement quote cleanup/archival job (optional)
4. ✅ Add comprehensive error handling
5. ✅ Add production environment checks
6. ✅ Add monitoring/logging improvements
7. ✅ Documentation updates

### **Functions to Implement:**
```javascript
// backend/utils/enterpriseEmailService.js
async sendSubscriptionEmail(type, enterpriseAccount, data)

// backend/utils/enterpriseAuditLog.js
async logSubscriptionEvent(enterpriseId, eventType, data)

// backend/jobs/quoteCleanupJob.js (optional)
async archiveExpiredQuotes()
```

### **Test Criteria:**
- [ ] Email notifications sent for subscription events
- [ ] Email templates work correctly
- [ ] Audit logging works (all events logged)
- [ ] Quote cleanup works (archives expired quotes)
- [ ] Error handling comprehensive (all failure points logged)
- [ ] Production environment checks work
- [ ] Monitoring/logging improvements in place

### **Test File:** `backend/test-phase9-polish.js`

### **Dependencies:** All previous phases

### **Checkpoint Command:**
```bash
git add .
git commit -m "✅ Checkpoint 9: Polish and production ready"
git tag checkpoint-9
```

---

## 🧪 Test Execution Guide

### **Running Tests:**

```bash
# Run specific phase unit test
cd backend
node test-phase{N}-{name}.js

# Example: Run Phase 1 unit tests
node test-phase1-pricing.js

# Example: Run Phase 5 unit tests
node test-phase5-callback.js
```

### **Running Integration Tests (E2E):**

```bash
# 1. Start the server (in separate terminal)
cd backend
node server.js

# 2. Run integration tests (in another terminal)
cd backend
node test-e2e-phase{N}-{name}.js

# Example: Run Phase 2 E2E tests
node test-e2e-phase2-quotes.js

# Example: Run Phase 4 E2E tests
node test-e2e-phase4-payment-init.js
```

### **Running All Tests (Unit + E2E):**

```bash
# Run all unit tests
cd backend
for phase in {0..9}; do
  node test-phase${phase}-*.js 2>/dev/null || echo "Phase ${phase} test not found"
done

# Run all E2E tests (server must be running)
cd backend
for phase in {0..9}; do
  node test-e2e-phase${phase}-*.js 2>/dev/null || echo "Phase ${phase} E2E test not found"
done
```

### **Test Requirements:**

1. **Server Running:** Most tests require backend server running on `localhost:8383`
2. **Paystack Test Mode:** Phases 3+ require Paystack test API key
3. **Database Access:** All tests require Firestore access
4. **Clean State:** Some tests may require clean database state

### **Test Structure:**

Each test file should follow this pattern:
```javascript
/**
 * Phase N: {Phase Name} Test Suite
 * 
 * Tests: {List of what's being tested}
 * Dependencies: Phase X, Phase Y
 */

const http = require('http');
const { db } = require('./firebase');

const BASE_URL = 'http://localhost:8383';

async function testFeature1() {
  // Test implementation
}

async function testFeature2() {
  // Test implementation
}

async function runPhaseNTests() {
  console.log('🧪 Running Phase N Tests...');
  
  const results = [];
  
  results.push(await testFeature1());
  results.push(await testFeature2());
  // ... more tests
  
  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All Phase N tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some Phase N tests failed. Fix issues before proceeding.');
    process.exit(1);
  }
}

runPhaseNTests().catch(console.error);
```

---

## 📋 Implementation Checklist

### **Before Starting:**
- [ ] Review all phases
- [ ] Set up Paystack test account
- [ ] Configure environment variables
- [ ] Set up Firestore database
- [ ] Review existing code patterns

### **During Implementation:**
- [ ] Complete Phase 0, run tests, create checkpoint
- [ ] Complete Phase 1, run tests, create checkpoint
- [ ] Complete Phase 2, run tests, create checkpoint
- [ ] Continue for all phases...

### **After Each Phase:**
- [ ] Run test file
- [ ] Fix any failing tests
- [ ] Verify all tests pass
- [ ] Create checkpoint (git tag)
- [ ] Document any issues or deviations

---

## 🎯 Success Criteria

**Phase Complete When:**
- ✅ All tests in phase test file pass
- ✅ No console errors or warnings
- ✅ Code follows existing patterns
- ✅ Error handling in place
- ✅ Logging in place
- ✅ Documentation updated

**Ready for Next Phase When:**
- ✅ All current phase tests pass
- ✅ Checkpoint created
- ✅ Code reviewed (if applicable)
- ✅ Dependencies verified

---

## 🚨 Important Notes

1. **Don't Skip Tests:** Every phase must have passing tests before moving forward
2. **Don't Skip Phases:** Each phase builds on the previous
3. **Use Checkpoints:** Create checkpoints after each phase for easy rollback
4. **Test in Isolation:** Each phase should be testable independently
5. **Follow Patterns:** Use existing codebase patterns for consistency
6. **Error Handling:** Always implement error handling and logging
7. **Security:** Always verify webhook signatures, validate inputs

---

## 🔗 Frontend Integration Points

### **Payment Success/Failure Pages**

**Current Implementation (Backend Static Pages):**
- Success page: `backend/public/enterprise-payment-success.html`
- Failure page: `backend/public/enterprise-payment-failure.html`
- Served via Express static file middleware
- Accessible at: `http://localhost:8383/enterprise-payment-success.html` and `/enterprise-payment-failure.html`

**Callback Redirect Flow:**
1. Paystack redirects browser to: `GET /api/enterprise/payment/callback?ref={paymentReference}`
2. Backend processes payment, creates account
3. Backend redirects (302) to:
   - Success: `/enterprise-payment-success.html?quoteId={quoteId}&enterpriseId={enterpriseId}`
   - Failure: `/enterprise-payment-failure.html?error={errorCode}&ref={paymentReference}`

**Planned Frontend Integration:**

**Goal:** Replace backend static HTML pages with frontend routes for better UX integration.

**Frontend Routes Required:**
- Success: `{APP_URL}/enterprise/payment/success?quoteId={quoteId}&enterpriseId={enterpriseId}`
- Failure: `{APP_URL}/enterprise/payment/failure?error={errorCode}&ref={paymentReference}`

**Backend Changes Needed:**
- Update `handlePaymentCallback` redirect URLs to use `APP_URL` environment variable:
  ```javascript
  // Current (backend static):
  res.redirect(`/enterprise-payment-success.html?quoteId=${quoteId}&enterpriseId=${enterpriseId}`);
  
  // Future (frontend routes):
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  res.redirect(`${appUrl}/enterprise/payment/success?quoteId=${quoteId}&enterpriseId=${enterpriseId}`);
  ```

**Frontend Implementation Requirements:**
1. Create success page component/route: `/enterprise/payment/success`
   - Display success message
   - Show quote ID and enterprise ID from query params
   - Link to enterprise dashboard or home
   - Handle loading states

2. Create failure page component/route: `/enterprise/payment/failure`
   - Display error message based on error code
   - Show payment reference and quote ID (if available)
   - Provide retry option or contact support
   - Handle different error types with appropriate messaging

3. Error Code Mapping (for frontend):
   - `missing_reference` → "Payment reference is missing. Please try again."
   - `verification_failed` → "Payment verification failed. Please contact support."
   - `quote_not_found` → "Quote not found. Please generate a new quote."
   - `database_error` → "Database error occurred. Please try again."
   - `account_creation_failed` → "Payment succeeded but account creation failed. Please contact support."
   - `unexpected_error` → "An unexpected error occurred. Please try again."

**Environment Variable:**
- `APP_URL` - Frontend application URL (e.g., `https://app.yourdomain.com` or `http://localhost:3000`)

**Testing:**
- Backend callback redirects can be tested with any URL (backend static or frontend)
- Frontend pages should handle query parameters correctly
- Test both success and failure scenarios
- Test with missing/invalid query parameters

**Migration Path:**
1. ✅ Current: Backend static HTML pages (working, suitable for testing)
2. ⏳ Next: Update backend to use `APP_URL` for redirects (configurable)
3. ⏳ Future: Implement frontend routes and remove backend static pages

**Note:** Backend static pages will remain as fallback until frontend integration is complete and tested.

---

**Ready to Start Implementation** 🚀

**Start with Phase 0, complete all tests, then move to Phase 1, and so on.**

