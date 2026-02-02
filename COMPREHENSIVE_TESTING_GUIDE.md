# Comprehensive Enterprise Payment Testing Guide

**Date:** 2025-01-27  
**System:** Enterprise Payment & Subscription Management  
**Total Test Suites:** 19 (10 Unit Tests + 5 E2E Tests + 4 Specialized Tests)

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Test Execution Order](#test-execution-order)
3. [Unit Tests (Phase-by-Phase)](#unit-tests-phase-by-phase)
4. [End-to-End (E2E) Tests](#end-to-end-e2e-tests)
5. [Test Execution Commands](#test-execution-commands)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 PREREQUISITES

### ⚠️ CRITICAL: NO MOCKING POLICY
**ALL TESTS USE:**
- ✅ **Real HTTP requests** (for E2E tests)
- ✅ **Real Paystack API calls** (actual test API keys)
- ✅ **Real Firestore database** (actual data creation/reads)
- ✅ **Real webhook signatures** (actual HMAC-SHA512 signatures)
- ✅ **Real email service** (actual email sending)
- ❌ **NO MOCKING** - No mock requests, no mock responses, no assumptions

### Environment Setup
- ✅ Node.js installed
- ✅ Firebase credentials configured in `.env`
- ✅ Paystack test API keys configured:
  - `PAYSTACK_SECRET_KEY` (for webhook signatures and API calls)
  - `PAYSTACK_PUBLIC_KEY` (for frontend integration)
- ✅ Server running on `http://localhost:8383` (for E2E tests)
- ✅ Firestore database accessible
- ✅ Email service configured (for Phase 9 tests)

### Environment Variables Required
```bash
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
APP_URL=http://localhost:8383
NODE_ENV=development
ALLOW_DEVELOPMENT_IPS=true  # For webhook IP whitelist bypass in tests
```

---

## 📊 TEST EXECUTION ORDER

**Recommended execution sequence:**
1. Phase 0 (Foundation) - Unit Test
2. Phase 0 (Foundation) - E2E Test
3. Phase 1 (Pricing) - Unit Test
4. Phase 2 (Quotes) - Unit Test
5. Phase 2 (Quotes) - E2E Test
6. Phase 3 (Plans) - Unit Test
7. Phase 4 (Payment Init) - Unit Test
8. Phase 4 (Payment Init) - E2E Test
9. Phase 5 (Callback) - Unit Test
10. Phase 6 (Webhooks) - Unit Test
11. Phase 6 (Webhooks) - E2E Test
12. Phase 7 (Management) - Unit Test
13. Phase 7 (Management) - E2E Test
14. Phase 8 (Grace Period) - Unit Test
15. Phase 9 (Polish) - Unit Test

---

## 🧪 UNIT TESTS (PHASE-BY-PHASE)

> **⚠️ NOTE:** Some unit tests use mock request/response objects for direct function testing. For tests requiring real HTTP requests, use the E2E tests instead. Tests marked with "Uses Real API" make actual API calls to Paystack/Firestore.

### **Phase 0: Foundation Setup Test**
**File:** `backend/test-phase0-foundation.js`  
**Command:** `node backend/test-phase0-foundation.js`  
**Uses:** Direct function calls (no HTTP, no mocking of core functions)

#### What It Tests:
1. **Pricing Configuration**
   - ✅ Pricing module loads correctly
   - ✅ Supported currencies (ZAR, USD) are defined
   - ✅ Price calculation function works
   
   **Why:** Ensures the pricing engine is functional before testing payment flows. Pricing is the foundation of all enterprise subscriptions.

2. **Validation Functions**
   - ✅ All validation functions exist (company name, contact name, email, employee count, currency)
   - ✅ Individual validations work correctly
   - ✅ Complete quote validation works
   
   **Why:** Input validation prevents invalid data from entering the system, protecting against injection attacks and data corruption.

3. **Database Collections**
   - ✅ Database connection exists
   - ✅ All required collections are accessible:
     - `enterprise_quotes`
     - `enterprise_accounts`
     - `enterprise_plans`
     - `error_logs`
   - ✅ Can write to collections
   
   **Why:** Verifies Firestore setup is correct. Database access is critical for storing quotes, accounts, and plans.

4. **Error Logging**
   - ✅ Error logging functions exist
   - ✅ Error logging works (writes to Firestore)
   - ✅ Account creation failure logging works
   - ✅ Plan creation failure logging works
   
   **Why:** Error logging is essential for debugging production issues. Without it, failures are invisible.

5. **Routes File**
   - ✅ Routes file exists and can be imported
   - ✅ Routes file exports Express router
   
   **Why:** Ensures the routing infrastructure is set up correctly.

6. **Schema Documentation**
   - ✅ All schema definitions exist
   - ✅ Schema structure is correct
   
   **Why:** Schemas document the data structure and help prevent schema drift.

---

### **Phase 1: Pricing Logic Test**
**File:** `backend/test-phase1-pricing.js`  
**Command:** `node backend/test-phase1-pricing.js`

#### What It Tests:
1. **Price Calculation**
   - ✅ Calculates correct prices for different employee counts
   - ✅ Handles ZAR and USD currencies
   - ✅ Price formatting works correctly
   - ✅ Edge cases (1 employee, 10,000 employees)
   
   **Why:** Pricing must be accurate. Incorrect pricing leads to revenue loss or customer complaints.

2. **Currency Support**
   - ✅ ZAR pricing works
   - ✅ USD pricing works
   - ✅ Invalid currencies are rejected
   
   **Why:** Multi-currency support is required for international customers.

3. **Price Formatting**
   - ✅ Formats prices correctly (e.g., "R 600.00")
   - ✅ Handles different currency symbols
   
   **Why:** Proper formatting improves user experience and prevents confusion.

---

### **Phase 2: Quote Generation Test**
**File:** `backend/test-phase2-quotes.js`  
**Command:** `node backend/test-phase2-quotes.js`  
**⚠️ NOTE:** This test uses mock request/response objects. For real HTTP testing, use `test-e2e-phase2-quotes.js` instead.

#### What It Tests:
1. **Quote Generation Endpoint**
   - ✅ Generates quotes with valid data
   - ✅ Creates unique quote IDs
   - ✅ Stores quotes in database
   - ✅ Returns formatted response
   
   **Why:** Quote generation is the entry point for enterprise sales. Must work reliably.

2. **Validation Error Handling**
   - ✅ Rejects invalid company names
   - ✅ Rejects invalid emails
   - ✅ Rejects invalid employee counts
   - ✅ Returns clear error messages
   
   **Why:** Prevents bad data from entering the system and provides good UX with clear errors.

3. **Quote Expiration**
   - ✅ Quotes have expiration dates (30 days)
   - ✅ Expired quotes are detected
   
   **Why:** Quotes should expire to prevent stale pricing from being used.

4. **Database Writes**
   - ✅ Quotes are stored correctly
   - ✅ All required fields are present
   - ✅ Metadata (IP, user agent) is captured
   
   **Why:** Ensures data integrity and enables audit trails.

---

### **Phase 3: Plan Management Test**
**File:** `backend/test-phase3-plans.js`  
**Command:** `node backend/test-phase3-plans.js`  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack

#### What It Tests:
1. **Plan Creation**
   - ✅ Creates Paystack plans via API
   - ✅ Stores plans in database
   - ✅ Plan codes are valid format (PLN_*)
   
   **Why:** Plans are required for Paystack subscriptions. Must be created correctly.

2. **Plan Reuse**
   - ✅ Finds existing plans in database
   - ✅ Verifies plans exist in Paystack
   - ✅ Reuses plans when possible
   - ✅ Handles deleted plans (creates new one)
   
   **Why:** Plan reuse reduces Paystack API calls and prevents plan proliferation.

3. **Plan Verification**
   - ✅ Verifies plans exist in Paystack
   - ✅ Handles missing plans gracefully
   - ✅ Removes stale plans from database
   
   **Why:** Plans can be deleted in Paystack. System must detect and handle this.

4. **Retry Logic**
   - ✅ Retries plan creation on failure
   - ✅ Exponential backoff works
   - ✅ Handles max retries correctly
   
   **Why:** Network issues can cause temporary failures. Retry logic ensures resilience.

---

### **Phase 4: Payment Initialization Test**
**File:** `backend/test-phase4-payment-init.js`  
**Command:** `node backend/test-phase4-payment-init.js`  
**⚠️ NOTE:** This test uses mock request/response objects. For real HTTP testing, use `test-e2e-phase4-payment-init.js` instead.  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack

#### What It Tests:
1. **Payment Initialization**
   - ✅ Initializes payment with valid quote
   - ✅ Creates/finds Paystack plan
   - ✅ Calls Paystack subscription API
   - ✅ Returns payment URL
   - ✅ Updates quote with payment reference
   
   **Why:** Payment initialization is the critical step that starts the payment flow. Must work perfectly.

2. **Quote Validation**
   - ✅ Rejects expired quotes
   - ✅ Rejects already paid quotes
   - ✅ Validates quote exists
   
   **Why:** Prevents duplicate payments and ensures quotes are still valid.

3. **Plan Recovery**
   - ✅ Handles "plan not found" errors
   - ✅ Creates new plan and retries
   - ✅ Updates quote with new plan code
   
   **Why:** Plans can be deleted. System must recover automatically.

4. **Rate Limiting**
   - ✅ Rate limiting is applied (5/hour per quote)
   
   **Why:** Prevents abuse and protects against brute force attacks.

5. **Error Handling**
   - ✅ Handles Paystack API failures
   - ✅ Logs errors correctly
   - ✅ Returns user-friendly error messages
   
   **Why:** Payment failures must be handled gracefully with proper error messages.

---

### **Phase 5: Payment Callback Test**
**File:** `backend/test-phase5-callback.js`  
**Command:** `node backend/test-phase5-callback.js`  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack for payment verification

#### What It Tests:
1. **Payment Verification**
   - ✅ Verifies payment with Paystack
   - ✅ Handles successful payments
   - ✅ Handles failed payments
   - ✅ Extracts subscription details
   
   **Why:** Payment verification ensures money was actually received before creating accounts.

2. **Account Creation**
   - ✅ Creates enterprise account
   - ✅ Updates quote status to 'paid'
   - ✅ Atomic transaction (account + quote update)
   - ✅ Retry logic for account creation
   
   **Why:** Account creation must be atomic. Partial creation leads to inconsistent state.

3. **Idempotency**
   - ✅ Handles duplicate callbacks
   - ✅ Doesn't create duplicate accounts
   
   **Why:** Paystack may send multiple callbacks. System must handle this gracefully.

4. **Date Calculations**
   - ✅ Calculates subscription start date
   - ✅ Calculates subscription end date
   - ✅ Calculates next billing date
   
   **Why:** Accurate dates are critical for subscription management and billing.

5. **Redirect Handling**
   - ✅ Redirects to success page on success
   - ✅ Redirects to failure page on failure
   - ✅ Includes error details in URL
   
   **Why:** Users need clear feedback after payment attempts.

---

### **Phase 6: Webhook Handling Test**
**File:** `backend/test-phase6-webhooks.js`  
**Command:** `node backend/test-phase6-webhooks.js`  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack  
**✅ Uses Real Webhook Signatures** - Generates actual HMAC-SHA512 signatures

#### What It Tests:
1. **Webhook Signature Verification**
   - ✅ Verifies Paystack signatures
   - ✅ Rejects invalid signatures
   - ✅ Handles missing signatures
   
   **Why:** Signature verification prevents unauthorized webhook calls. Critical for security.

2. **Event Routing**
   - ✅ Routes events to correct handlers:
     - `subscription.create`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `subscription.disable`
     - `subscription.not_renewing`
   
   **Why:** Different events require different handling. Routing ensures correct processing.

3. **Current State Fetching**
   - ✅ Fetches current subscription state from Paystack
   - ✅ Handles out-of-order webhooks
   
   **Why:** Webhooks can arrive out of order. Fetching current state ensures accuracy.

4. **Idempotency**
   - ✅ Handles duplicate webhooks
   - ✅ Doesn't create duplicate accounts
   - ✅ Doesn't update dates multiple times
   
   **Why:** Prevents duplicate processing and data corruption.

5. **Account Creation (from webhook)**
   - ✅ Creates account on `subscription.create`
   - ✅ Handles quote lookup
   - ✅ Sets up subscription dates correctly
   
   **Why:** Webhooks are the primary source of truth. Must create accounts correctly.

6. **Payment Success Handling**
   - ✅ Updates dates on `invoice.payment_succeeded`
   - ✅ Reactivates suspended accounts
   - ✅ Clears grace periods
   
   **Why:** Renewals and reactivations must update dates correctly.

7. **Payment Failure Handling**
   - ✅ Sets grace period on `invoice.payment_failed`
   - ✅ Updates warning banners
   - ✅ Tracks payment failures
   
   **Why:** Payment failures must trigger grace periods and warnings.

---

### **Phase 7: Subscription Management Test**
**File:** `backend/test-phase7-management.js`  
**Command:** `node backend/test-phase7-management.js`  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack

#### What It Tests:
1. **Subscription Status**
   - ✅ Fetches subscription status
   - ✅ Syncs with Paystack
   - ✅ Checks grace period expiration
   - ✅ Returns warning banners
   - ✅ Suspends accounts if grace period expired
   
   **Why:** Status endpoint is used by frontend to display subscription state. Must be accurate.

2. **Subscription Cancellation**
   - ✅ Cancels subscription with Paystack
   - ✅ Updates database status
   - ✅ Logs cancellation event
   - ✅ Sends cancellation email
   
   **Why:** Cancellation must be processed correctly to prevent future charges.

3. **Employee Count Updates**
   - ✅ Updates employee count
   - ✅ Creates new plan for new count
   - ✅ Updates Paystack subscription
   - ✅ Updates database
   - ✅ Logs update event
   
   **Why:** Employee count changes require plan updates. Must be handled correctly.

4. **Plan Management**
   - ✅ Creates plans for new employee counts
   - ✅ Reuses existing plans when possible
   
   **Why:** Plan management ensures correct pricing for updated employee counts.

---

### **Phase 8: Grace Period & Suspension Test**
**File:** `backend/test-phase8-grace-period.js`  
**Command:** `node backend/test-phase8-grace-period.js`  
**✅ Uses Real Firestore Database** - Creates and reads actual data

#### What It Tests:
1. **Grace Period Setting**
   - ✅ Sets grace period on payment failure
   - ✅ Calculates grace period end date (7 days)
   - ✅ Updates warning banner
   - ✅ Keeps account active during grace period
   
   **Why:** Grace periods give customers time to fix payment issues before suspension.

2. **Grace Period Expiration**
   - ✅ Detects expired grace periods
   - ✅ Suspends accounts when grace period expires
   - ✅ Updates warning banners
   
   **Why:** Expired grace periods must trigger suspension to protect revenue.

3. **Account Suspension**
   - ✅ Suspends accounts correctly
   - ✅ Updates account status
   - ✅ Sets warning banners
   - ✅ Logs suspension event
   - ✅ Sends suspension email
   
   **Why:** Suspension must be clear and logged for audit purposes.

4. **Grace Period Clearing**
   - ✅ Clears grace period on successful payment
   - ✅ Reactivates account
   - ✅ Removes warning banners
   - ✅ Logs reactivation event
   
   **Why:** Successful payments after failures must clear grace periods and reactivate accounts.

5. **Warning Banners**
   - ✅ Warning banners are returned in API responses
   - ✅ Banners include action URLs
   - ✅ Banners have correct severity levels
   
   **Why:** Frontend needs warning banners to display to users.

---

### **Phase 9: Polish & Production Test**
**File:** `backend/test-phase9-polish.js`  
**Command:** `node backend/test-phase9-polish.js`  
**✅ Uses Real Email Service** - Sends actual emails (if configured)  
**✅ Uses Real Firestore Database** - Writes actual audit logs

#### What It Tests:
1. **Email Notifications**
   - ✅ Email service functions exist
   - ✅ All email types work:
     - Welcome email
     - Payment succeeded email
     - Payment failed email
     - Suspended email
     - Reactivated email
     - Cancelled email
   - ✅ Email content is correct
   - ✅ Email sending doesn't block requests
   
   **Why:** Email notifications keep customers informed about subscription status changes.

2. **Audit Logging**
   - ✅ Audit logging functions exist
   - ✅ All event types are logged:
     - Subscription created
     - Payment succeeded
     - Payment failed
     - Account suspended
     - Account reactivated
     - Subscription cancelled
     - Employee count updated
   - ✅ Logs are stored in Firestore
   - ✅ Log structure is correct
   
   **Why:** Audit logs are required for compliance, debugging, and customer support.

3. **Error Handling**
   - ✅ Email failures don't break requests
   - ✅ Audit log failures don't break requests
   - ✅ Errors are logged gracefully
   
   **Why:** Non-critical services (email, audit) must not break critical flows.

---

## 🌐 END-TO-END (E2E) TESTS

**✅ ALL E2E TESTS USE REAL HTTP REQUESTS - NO MOCKING**

E2E tests verify the system works via actual HTTP requests, simulating real user interactions. All tests make real HTTP calls to the running server.

### **Phase 0: Foundation E2E Test**
**File:** `backend/test-e2e-phase0-foundation.js`  
**Command:** `node backend/test-e2e-phase0-foundation.js`  
**Prerequisites:** Server running on `http://localhost:8383`  
**✅ Uses Real HTTP Requests** - Makes actual HTTP calls to server

#### What It Tests:
1. **Server Connectivity**
   - ✅ Server is running and accessible
   - ✅ Health check endpoint responds
   - ✅ Routes are registered
   
   **Why:** Verifies the server is running and routes are accessible via HTTP.

---

### **Phase 2: Quotes E2E Test**
**File:** `backend/test-e2e-phase2-quotes.js`  
**Command:** `node backend/test-e2e-phase2-quotes.js`  
**Prerequisites:** Server running, Phase 0-2 implemented  
**✅ Uses Real HTTP Requests** - Makes actual HTTP calls to server  
**✅ Uses Real Firestore Database** - Creates actual quotes in database

#### What It Tests:
1. **Quote Generation via HTTP**
   - ✅ POST `/api/enterprise/quote` works
   - ✅ Returns quote with all fields
   - ✅ Quote is stored in database
   - ✅ Rate limiting works
   
   **Why:** Verifies the quote endpoint works in a real HTTP environment.

2. **Validation via HTTP**
   - ✅ Rejects invalid data via HTTP
   - ✅ Returns proper HTTP status codes
   - ✅ Returns clear error messages
   
   **Why:** Ensures validation works correctly in HTTP context.

---

### **Phase 4: Payment Init E2E Test**
**File:** `backend/test-e2e-phase4-payment-init.js`  
**Command:** `node backend/test-e2e-phase4-payment-init.js`  
**Prerequisites:** Server running, Phase 0-4 implemented, Paystack test keys  
**✅ Uses Real HTTP Requests** - Makes actual HTTP calls to server  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack

#### What It Tests:
1. **Payment Initialization via HTTP**
   - ✅ POST `/api/enterprise/payment/initialize` works
   - ✅ Returns payment URL
   - ✅ Payment URL is valid Paystack URL
   - ✅ Quote is updated with payment reference
   
   **Why:** Verifies payment initialization works end-to-end via HTTP.

2. **Error Handling via HTTP**
   - ✅ Handles expired quotes
   - ✅ Handles invalid quote IDs
   - ✅ Returns proper HTTP status codes
   
   **Why:** Ensures error handling works correctly in HTTP context.

---

### **Phase 6: Webhooks E2E Test**
**File:** `backend/test-e2e-phase6-webhooks.js`  
**Command:** `node backend/test-e2e-phase6-webhooks.js`  
**Prerequisites:** Server running, Phase 0-6 implemented, Paystack secret key  
**✅ Uses Real HTTP Requests** - Makes actual HTTP calls to server  
**✅ Uses Real Webhook Signatures** - Generates actual HMAC-SHA512 signatures

#### What It Tests:
1. **Webhook Endpoint via HTTP**
   - ✅ POST `/api/enterprise/payment/webhook` works
   - ✅ Signature verification works via HTTP
   - ✅ Rejects invalid signatures
   - ✅ Accepts valid signatures
   
   **Why:** Verifies webhook endpoint works correctly via HTTP with real signatures.

2. **Event Types via HTTP**
   - ✅ All event types are accepted
   - ✅ Events are processed correctly
   
   **Why:** Ensures webhook event processing works in HTTP context.

---

### **Phase 7: Management E2E Test**
**File:** `backend/test-e2e-phase7-management.js`  
**Command:** `node backend/test-e2e-phase7-management.js`  
**Prerequisites:** Server running, Phase 0-7 implemented, Test account created  
**✅ Uses Real HTTP Requests** - Makes actual HTTP calls to server  
**✅ Uses Real Paystack API** - Makes actual API calls to Paystack

#### What It Tests:
1. **Subscription Status via HTTP**
   - ✅ GET `/api/enterprise/subscription/:enterpriseId/status` works
   - ✅ Returns subscription status
   - ✅ Syncs with Paystack
   
   **Why:** Verifies status endpoint works via HTTP.

2. **Cancellation via HTTP**
   - ✅ POST `/api/enterprise/subscription/:enterpriseId/cancel` works
   - ✅ Cancels subscription correctly
   
   **Why:** Ensures cancellation works via HTTP.

3. **Employee Update via HTTP**
   - ✅ POST `/api/enterprise/subscription/:enterpriseId/update-employees` works
   - ✅ Updates employee count correctly
   
   **Why:** Verifies employee count updates work via HTTP.

---

## 🚀 TEST EXECUTION COMMANDS

### Quick Test All (Recommended Order)
```bash
# Start server first (in separate terminal)
npm start

# Then run tests in order:
node backend/test-phase0-foundation.js
node backend/test-e2e-phase0-foundation.js
node backend/test-phase1-pricing.js
node backend/test-phase2-quotes.js
node backend/test-e2e-phase2-quotes.js
node backend/test-phase3-plans.js
node backend/test-phase4-payment-init.js
node backend/test-e2e-phase4-payment-init.js
node backend/test-phase5-callback.js
node backend/test-phase6-webhooks.js
node backend/test-e2e-phase6-webhooks.js
node backend/test-phase7-management.js
node backend/test-e2e-phase7-management.js
node backend/test-phase8-grace-period.js
node backend/test-phase9-polish.js
```

### Test Individual Phase
```bash
# Unit test
node backend/test-phase{X}-{name}.js

# E2E test (requires server running)
node backend/test-e2e-phase{X}-{name}.js
```

### Test All Unit Tests
```bash
for file in backend/test-phase*.js; do
  echo "Running $file..."
  node "$file"
  echo ""
done
```

### Test All E2E Tests (Server Must Be Running)
```bash
for file in backend/test-e2e-*.js; do
  echo "Running $file..."
  node "$file"
  echo ""
done
```

---

## 🔍 TROUBLESHOOTING

### Common Issues

1. **Firebase Connection Errors**
   - **Symptom:** "Failed to initialize Firebase"
   - **Solution:** Check `.env` file has correct Firebase credentials
   - **Test:** `node backend/test-phase0-foundation.js` should pass database tests

2. **Paystack API Errors**
   - **Symptom:** "Plan creation failed" or "Payment initialization failed"
   - **Solution:** Verify `PAYSTACK_SECRET_KEY` is set and valid
   - **Test:** `node backend/test-phase3-plans.js` should pass

3. **Server Not Running (E2E Tests)**
   - **Symptom:** "Cannot connect to server"
   - **Solution:** Start server: `npm start` or `node backend/server.js`
   - **Test:** `curl http://localhost:8383/api/enterprise/health`

4. **Webhook Signature Errors**
   - **Symptom:** "Invalid webhook signature"
   - **Solution:** Verify `PAYSTACK_SECRET_KEY` matches Paystack dashboard
   - **Test:** `node backend/test-e2e-phase6-webhooks.js`

5. **Rate Limiting Errors**
   - **Symptom:** "Too many requests"
   - **Solution:** Wait for rate limit window to expire (1 hour for quotes, 1 minute for webhooks)
   - **Test:** Check rate limit configuration in middleware files

---

## ✅ TEST SUCCESS CRITERIA

### ⚠️ CRITICAL REQUIREMENTS
- ✅ **ALL TESTS USE REAL DATA** - No mocking, no assumptions
- ✅ **Tests must be executed and logs provided** before marking as passed
- ✅ **Only mark ✅ after successful execution with full logs**

### All Tests Should:
- ✅ Exit with code 0 (success)
- ✅ Show "All tests passed" message
- ✅ Have 0 failed tests
- ✅ Clean up test data (quotes, accounts, plans)
- ✅ Use real HTTP requests (for E2E tests)
- ✅ Use real API calls (for Paystack tests)
- ✅ Use real database operations (for all tests)

### Expected Output:
```
🧪 Phase X: [Name] Test Suite
==================================================
✅ Test 1
✅ Test 2
✅ Test 3
...

📊 Test Results Summary
==================================================
✅ Passed: 15
❌ Failed: 0
📈 Total: 15

🎉 All Phase X tests passed!
```

---

## 📝 TEST DATA CLEANUP

Tests automatically clean up test data, but if tests fail, you may need to manually clean:

```bash
# Clean test quotes
node backend/cleanup-test-data.js

# Or manually in Firestore console:
# - Delete quotes with quoteId starting with "test_"
# - Delete accounts with enterpriseId starting with "ent_test_"
# - Delete plans created during tests
```

---

## 🎯 NEXT STEPS AFTER TESTING

1. **Review Test Results**
   - Check all tests pass
   - Review any warnings
   - Fix any failures

2. **Production Readiness**
   - Update environment variables for production
   - Configure Paystack webhook URL
   - Set up monitoring/alerts
   - Review error logs

3. **Documentation**
   - Update API documentation
   - Document any test-specific behaviors
   - Create runbooks for common issues

---

**Happy Testing! 🚀**

