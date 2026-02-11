# Enterprise Integration Implementation Plan

## Overview

This plan implements the creation of `enterprise` documents atomically with `enterprise_accounts` when payment is verified. Following the **Cement/Poop Principle**, we build new code alongside existing payment infrastructure without modifying it.

---

## Golden Rules Applied

1. **Rule #1: Never Make Assumptions** - All decisions documented, no assumptions made
2. **Rule #2: Poop/Concrete Principles** - Payment code = CEMENT (don't modify), Enterprise creation = POOP (new, alongside)
3. **Rule #3: No Dummy or Mock Data** - All testing and implementation uses real, valid data structures

---

## Phase 1: Configuration Setup (Cement Foundation)

### Goal
Create retry configuration following existing patterns.

### Tasks
1. **Create `backend/config/enterpriseRetryConfig.js`**
   - Read `ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES` (default: 5)
   - Read `ENTERPRISE_ACCOUNT_CREATION_MAX_RETRIES` (default: 7)
   - Export constants following `enterprisePricing.js` pattern
   - Add JSDoc documentation

### Files to Create
- `backend/config/enterpriseRetryConfig.js`

### Success Criteria
- ✅ Config file reads from environment variables
- ✅ Exports `MIN_RETRIES` and `MAX_RETRIES` constants
- ✅ Follows same pattern as `enterprisePricing.js`
- ✅ No hardcoded values

### Testing
- Verify config reads correct values from actual `.env` file
- Verify defaults work when env vars not set (test with actual missing env vars)

---

## Phase 2: Enterprise Document Helper Functions (POOP)

### Goal
Create helper functions to build enterprise document data from quote/account data.

### Tasks
1. **Create `backend/utils/enterpriseDocumentHelpers.js`**
   - Function: `deriveCompanySize(numberOfEmployees, priceRange)` 
     - Reuse quote generation logic (cement)
     - If `priceRange` exists → use range format
     - If specific number → derive category using existing logic
   - Function: `buildEnterpriseDocumentData(accountData, quoteData)`
     - Build enterprise document structure:
       - `name` ← `companyName`
       - `numberOfEmployees` ← from quote
       - `contactEmail` ← from quote
       - `contactName` ← from quote
       - `companySize` ← derived via helper
       - Optional fields: `description`, `industry`, `website`, `logoUrl`, `colorScheme`, `address` (empty)
       - `createdAt`, `updatedAt` ← from accountData
   - Export both functions

### Files to Create
- `backend/utils/enterpriseDocumentHelpers.js`

### Success Criteria
- ✅ `deriveCompanySize` reuses existing quote logic (no duplication)
- ✅ `buildEnterpriseDocumentData` creates correct structure
- ✅ All required fields populated
- ✅ Optional fields included but empty
- ✅ Matches other server's enterprise document schema

### Testing
- Test `deriveCompanySize` with range input (use real quote data from database)
- Test `deriveCompanySize` with specific number (use real quote data from database)
- Test `buildEnterpriseDocumentData` with real quote/account data from existing payments
- Verify structure matches expected schema (compare with actual enterprise documents from other server)

---

## Phase 3: Update Retry Function (POOP - Extend Cement)

### Goal
Extend `createEnterpriseAccountWithRetry` to include enterprise document creation in atomic batch.

### Tasks
1. **Modify `backend/utils/enterprisePaymentUtils.js`**
   - Import retry config: `const { MIN_RETRIES, MAX_RETRIES } = require('../config/enterpriseRetryConfig')`
   - Import helpers: `const { buildEnterpriseDocumentData } = require('./enterpriseDocumentHelpers')`
   - Update function signature: `createEnterpriseAccountWithRetry(accountData, quoteRef, quoteData, maxRetries = MAX_RETRIES)`
   - In batch write, add:
     ```javascript
     // Create enterprise document
     const enterpriseData = buildEnterpriseDocumentData(accountData, quoteData);
     const enterpriseRef = db.collection('enterprise').doc(accountData.enterpriseId);
     batch.set(enterpriseRef, enterpriseData);
     ```
   - Update retry logic to use `MIN_RETRIES` for initial attempts, `MAX_RETRIES` for total
   - Update all call sites to pass `quoteData` parameter

2. **Update call sites in `backend/controllers/enterpriseController.js`**
   - `handlePaymentCallback`: Pass `quoteData` to `createEnterpriseAccountWithRetry`
   - `handleSubscriptionCreated` (webhook): Pass `quoteData` to `createEnterpriseAccountWithRetry`

### Files to Modify
- `backend/utils/enterprisePaymentUtils.js`
- `backend/controllers/enterpriseController.js`

### Success Criteria
- ✅ Enterprise document created atomically with enterprise_accounts
- ✅ Same `enterpriseId` used for both documents
- ✅ Retry logic uses config values (not hardcoded)
- ✅ All call sites updated
- ✅ Batch write ensures all-or-nothing

### Testing
- Test successful creation (both documents created)
- Test retry on failure (both documents created after retry)
- Test idempotency (safe to retry)
- Verify atomicity (if one fails, both fail)

---

## Phase 4: Enhanced Error Handling (POOP)

### Goal
Add special handling for manual intervention cases with unique logging and email notifications.

### Tasks
1. **Create `backend/utils/enterpriseManualIntervention.js`**
   - Function: `logManualInterventionRequired(enterpriseId, accountData, quoteData, error, attempts)`
     - Log to `error_logs` with special flag: `requiresManualIntervention: true`
     - Include all necessary data for manual recovery
     - Use unique error type: `'enterprise_creation_manual_intervention'`
   - Function: `sendManualInterventionEmails(enterpriseId, accountData, quoteData)`
     - Send email to ops team (from existing email service)
     - Send user-friendly email to contact person
     - User email: "Server tried to create enterprise document and failed, matter handed to engineer for manual intervention. Expect a call within 24-48 hours."
     - No error codes/types in user email

2. **Update `backend/utils/enterprisePaymentUtils.js`**
   - In `createEnterpriseAccountWithRetry`, after all retries fail:
     - Call `logManualInterventionRequired`
     - Call `sendManualInterventionEmails`
     - Still throw error (don't swallow it)

### Files to Create
- `backend/utils/enterpriseManualIntervention.js`

### Files to Modify
- `backend/utils/enterprisePaymentUtils.js`

### Success Criteria
- ✅ Manual intervention logs are uniquely identifiable
- ✅ Ops team receives email with all necessary data
- ✅ Contact person receives user-friendly email
- ✅ Error still thrown (existing error handling preserved)

### Testing
- Test logging with manual intervention flag
- Test email sending to ops team
- Test email sending to contact person
- Verify error still propagates correctly

---

## Phase 5: Testing & Validation (Cement Verification)

### Goal
Comprehensive testing to ensure enterprise creation works correctly and doesn't break existing functionality.

### Tasks
1. **Unit Tests**
   - Test `deriveCompanySize` with various inputs
   - Test `buildEnterpriseDocumentData` with various quote/account combinations
   - Test retry logic with config values

2. **Integration Tests**
   - Test payment callback flow (end-to-end with real Paystack test transactions)
   - Test webhook flow (end-to-end with real webhook payloads)
   - Test retry scenarios (use real database failures, not mocks)
   - Test failure scenarios (manual intervention with real error conditions)

3. **Regression Tests**
   - Verify existing payment flow still works
   - Verify existing enterprise_accounts creation still works
   - Verify no breaking changes

### Success Criteria
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ No regression in existing functionality
- ✅ Enterprise documents created correctly
- ✅ Atomicity verified

---

## Phase 6: Email & User Registration (Future - Separate Phase)

### Goal
Send registration email to contact person (NOT part of initial implementation).

### Tasks
- **Deferred** - Will be implemented in separate phase
- Send email with enterprise website link
- Send registration form link with `enterpriseId` query param
- Handle user registration with enterprise linking

### Note
This phase is documented but will be implemented separately after Phase 5 is complete and tested.

---

## Implementation Order

1. **Phase 1** → Configuration Setup
2. **Phase 2** → Helper Functions
3. **Phase 3** → Update Retry Function
4. **Phase 4** → Error Handling
5. **Phase 5** → Testing & Validation
6. **Phase 6** → Email & User Registration (future)

---

## Risk Mitigation

### Cement Protection
- **DO NOT** modify existing payment callback/webhook logic
- **DO NOT** change existing `enterprise_accounts` creation logic
- **ONLY** extend `createEnterpriseAccountWithRetry` to add enterprise document
- **ONLY** add new helper functions (don't modify existing ones)

### Rollback Plan
- If issues found, revert changes to `createEnterpriseAccountWithRetry`
- Keep helper functions (they're isolated)
- Payment flow continues to work (cement untouched)

### Testing Strategy
- Test each phase before proceeding
- If Phase 3 fails, revert and fix before Phase 4
- Follow poop/concrete: test → stable → proceed

---

## Dependencies

- Existing: `enterprisePaymentUtils.js` (cement)
- Existing: `enterpriseController.js` (cement)
- Existing: Quote generation logic (cement - for companySize)
- New: `enterpriseRetryConfig.js` (poop)
- New: `enterpriseDocumentHelpers.js` (poop)
- New: `enterpriseManualIntervention.js` (poop)

---

## Success Metrics

- ✅ Enterprise documents created for all new payments
- ✅ Zero breaking changes to existing payment flow
- ✅ Retry logic works correctly (5-7 attempts)
- ✅ Manual intervention cases logged and notified
- ✅ Atomicity maintained (all-or-nothing)

---

## Notes

- **TODO:** Remind Pule to Update UI to make space for optional enterprise fields
- Enterprise website link TBD (for Phase 6)
- User registration linking will be handled in Phase 6

---

**Last Updated:** [Will be updated as phases complete]
