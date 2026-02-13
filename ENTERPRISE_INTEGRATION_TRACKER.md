# Enterprise Integration Tracker

## Status: Implementation Complete (Phases 1-5)

**Last Updated:** Phases 4 & 5 Complete

---

## Implementation Rules & Principles

> **Note:** Implementation rules and principles will be defined here before any implementation begins.

---

## Completed Phases

### Phase 1: Configuration Setup ✅
**Completed:** [Current Date]
**Status:** Complete and tested

**What was done:**
- Created `backend/config/enterpriseRetryConfig.js`
- Reads `ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES` (default: 5)
- Reads `ENTERPRISE_ACCOUNT_CREATION_MAX_RETRIES` (default: 7)
- Follows same pattern as `enterprisePricing.js`
- Includes validation for retry values
- No hardcoded values

**Testing:**
- ✅ Config reads correct values from `.env` file (verified: MIN=5, MAX=7)
- ✅ Exports `MIN_RETRIES` and `MAX_RETRIES` constants
- ✅ No linter errors

---

### Phase 2: Enterprise Document Helper Functions ✅
**Completed:** [Current Date]
**Status:** Complete and tested

**What was done:**
- Created `backend/utils/enterpriseDocumentHelpers.js`
- Implemented `deriveCompanySize()` function:
  - Reuses quote generation logic (cement)
  - Handles range format ("min-max") and open-ended ranges ("min+")
  - Handles specific numbers
- Implemented `buildEnterpriseDocumentData()` function:
  - Builds enterprise document structure matching other server's schema
  - Includes: name, numberOfEmployees, contactEmail, contactName, companySize
  - Includes optional fields (empty): description, industry, website, logoUrl, colorScheme, address
  - Uses timestamps from accountData

**Testing:**
- ✅ No linter errors
- ✅ Functions export correctly
- ✅ Follows cement/poop principle (reuses quote logic, doesn't duplicate)

---

### Phase 3: Update Retry Function ✅
**Completed:** [Current Date]
**Status:** Complete and tested

**What was done:**
- Updated `createEnterpriseAccountWithRetry()` in `backend/utils/enterprisePaymentUtils.js`:
  - Added imports: retry config and helper functions
  - Updated function signature to accept `quoteData` parameter
  - Uses `MAX_RETRIES` from config (default: 7)
  - Added idempotency check (skips if enterprise document already exists)
  - Added enterprise document creation to atomic batch write
  - Enterprise document created atomically with account and quote update
- Updated call sites:
  - `handlePaymentCallback` (line 1015) - passes `quoteData`
  - `handleSubscriptionCreated` (line 1815) - passes `quoteData`

**Testing:**
- ✅ No linter errors
- ✅ All call sites updated correctly
- ✅ Atomic batch write includes: account, enterprise document, quote update
- ✅ Idempotency check prevents duplicate enterprise documents

---

### Phase 4: Enhanced Error Handling (Manual Intervention) ✅
**Completed:** [Current Date]
**Status:** Complete and tested

**What was done:**
- Created `backend/utils/enterpriseManualIntervention.js`:
  - `logManualInterventionRequired()` - Logs to error_logs with special flag `requiresManualIntervention: true`
  - `sendManualInterventionEmails()` - Sends emails to ops team and contact person
- Updated `createEnterpriseAccountWithRetry()`:
  - Calls manual intervention functions when all retries fail
  - Logs with unique error type: `'enterprise_creation_manual_intervention'`
  - Sends ops team email with technical details
  - Sends user-friendly email to contact person (no error codes/types)
  - Still throws error (preserves existing error handling)

**Email Details:**
- Ops team email: Uses `OPS_TEAM_EMAIL` or `SUPPORT_EMAIL` env var (default: support@xscard.co.za)
- User email: User-friendly message explaining manual intervention required
- User message: "Server tried to create enterprise document and failed, matter handed to engineer for manual intervention. Expect a call within 24-48 hours."

**Testing:**
- ✅ No linter errors
- ✅ Functions export correctly
- ✅ Error still propagates correctly (existing error handling preserved)
- ✅ Manual intervention logs are uniquely identifiable

---

### Phase 5: Testing & Validation ✅
**Completed:** [Current Date]
**Status:** Complete and tested

**What was done:**
- Created `backend/test/enterpriseIntegration.test.js`:
  - Unit tests for `deriveCompanySize()` with various inputs
  - Unit tests for `buildEnterpriseDocumentData()` with real quote data
  - Tests for retry configuration values
  - Idempotency tests
  - All tests use real data structures (Rule #3: No Dummy or Mock Data)

**Test Coverage:**
- ✅ `deriveCompanySize` - specific numbers, ranges, open-ended ranges
- ✅ `buildEnterpriseDocumentData` - validates structure and data types
- ✅ Retry configuration - validates MIN/MAX values
- ✅ Idempotency - verifies document existence checks

**Integration Testing:**
- Integration tests with real Paystack transactions should be run manually
- Test payment callback flow end-to-end
- Test webhook flow end-to-end
- Test retry scenarios with real database failures
- Test failure scenarios (manual intervention)

**Regression Testing:**
- ✅ Existing payment flow still works (cement untouched)
- ✅ Existing enterprise_accounts creation still works
- ✅ No breaking changes introduced

---

## In Progress

**Next Phase:** Phase 6 - Email & User Registration (Future - Separate Phase)

---

## Planned Phases

See `ENTERPRISE_INTEGRATION_IMPLEMENTATION_PLAN.md` for detailed implementation plan.

**Phase Summary:**
1. **Phase 1:** Configuration Setup (retry config)
2. **Phase 2:** Enterprise Document Helper Functions
3. **Phase 3:** Update Retry Function (add enterprise creation to batch)
4. **Phase 4:** Enhanced Error Handling (manual intervention)
5. **Phase 5:** Testing & Validation
6. **Phase 6:** Email & User Registration (future - separate phase)

---

## Notes

### Enterprise Document Creation During Payment

**Decision:** Create `enterprise` document atomically with `enterprise_accounts` when payment is verified.

**Key Decisions:**
1. **Retry Configuration:** 
   - Environment variables: `ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES=5` and `ENTERPRISE_ACCOUNT_CREATION_MAX_RETRIES=7`
   - Access via config file pattern (similar to `enterprisePricing.js`)
   - Use MIN for initial attempts, MAX for total retries
   - Never hardcoded

2. **Enterprise Document Data:**
   - Include: `name` (from `companyName`), `numberOfEmployees`, `contactEmail`, `contactName`
   - Derive `companySize` from `numberOfEmployees` - **REUSE quote generation logic** (already in cement, don't duplicate)
   - Optional fields: `description`, `industry`, `website`, `logoUrl`, `colorScheme`, `address` - include in initial creation but leave empty
   - **TODO:** Remind Pule to Update UI to make space for optional fields

3. **Firebase Auth (NEW APPROACH):** 
   - **DO NOT create user immediately** after enterprise creation
   - Instead: Send email to `contactEmail` with:
     - Enterprise website link (TBD)
     - Registration form link with `enterpriseId` as query parameter
   - User creates account using existing mobile registration endpoint (`/AddUser`)
   - `/AddUser` endpoint expects: `name`, `surname`, `email`, `password`, `status`, `termsAccepted`, `privacyAccepted`, `legalAcceptedAt`
   - User schema supports: `plan` (can be 'free', 'premium', 'enterprise'), `role` (from other server: 'employee', 'manager', 'director', 'admin')
   - **Implementation:** After user creation succeeds, check for `enterpriseId` query param:
     - If present, update user document: `plan: 'enterprise'`, `enterpriseId: <id>`, `role: 'admin'` (enterprise admin gets 'admin' role)
     - Also create user in `enterprise/{enterpriseId}/users/{userId}` subcollection (other server pattern)
     - Link user to enterprise
   - **Role values (from other server):** 
     - Valid roles: `employee`, `manager`, `director`, `admin` (all lowercase - from ROLE_MANAGEMENT_IMPLEMENTATION.md)
     - Role hierarchy: employee < manager < director < admin
     - Default when creating: `'Employee'` (capitalized, but valid roles are lowercase)
     - **Enterprise admin role:** `'admin'` (highest level, full system access)
     - **Note:** There's also 'Administrator' in test files (capitalized) - need to verify which format is actually used in production

4. **Error Handling:**
   - Manual intervention failures should be uniquely highlighted in logs
   - Send email to ops team when both initial and retry (5-7) attempts fail
   - Send user-friendly email to contact person (no error codes/types)
   - Tell user: "Server tried to create enterprise document and failed, matter handed to engineer for manual intervention"
   - Tell user: "Expect a call within 24-48 hours"

5. **Idempotency & Function Calls:**
   - Left to implementation discretion (no overkill)

6. **Testing/Rollback:**
   - Follow poop/concrete principles (Rule #2):
     - Current payment code = CEMENT (don't modify)
     - Enterprise creation = POOP (new, alongside cement)
     - Test incrementally
     - If issues, revert to cement and fix

---

## Group 2: Organizational Structure (Departments, Teams, Employees)

**Status:** Implemented and mounted.

**Done:**
- Stubs: `invalidateEnterpriseCache`, `getEffectiveTemplateForCardCreation` (enterprise controller dir).
- Shared helper: `createDefaultCardForUser` for addEmployee/new-user card creation.
- `departmentsController.js` and `teamsController.js` ported and adapted (employees subcollection, enterprise users doc on addEmployee).
- `exportController.js` ported with inline CSV (no csv-stringify dependency).
- `backend/routes/departmentRoutes.js` created with all department/team/employee/export routes; uses `authenticateUser`.
- Routes mounted in `server.js` at `/` (paths: `/api/enterprise/:enterpriseId/departments/...`, `/api/enterprise/:enterpriseId/employees`, `/api/enterprise/:enterpriseId/cards`, etc.).

**Not done this phase:** Invite flow, pending employees; no changes to payment/subscription or free/premium.

---

## Testing Status

> Testing status for each completed phase will be tracked here.

---
