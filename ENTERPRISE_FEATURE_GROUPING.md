# Enterprise Feature Grouping

**Purpose:** Logical grouping of enterprise features for organized integration and management.

---

## Group 1: Foundation Layer
**Dependencies:** None  
**Priority:** CRITICAL  
**Complexity:** Low-Medium

### 1.1 Core Enterprise Management
- **File:** `enterpriseController.js`
- **Features:**
  - `getAllEnterprises` - List all enterprises
  - `getEnterpriseById` - Get enterprise details
  - `updateEnterprise` - Update enterprise info (name, description, industry, website, logo, colorScheme, address)
  - `deleteEnterprise` - Delete enterprise
  - `getEnterpriseStats` - Enterprise statistics (placeholder)
- **Status:** Partial (we create during payment, need CRUD operations)
- **Integration Phase:** Phase 1

### 1.2 Activity Logging
- **File:** `activityLogController.js` + `utils/logger.js`
- **Features:**
  - `logActivity` - Log activities to Firestore
  - `getByAction` - Get activities by action type
  - `getByResource` - Get activities by resource type
  - `getByUser` - Get activities by user
  - `getByEnterprise` - Get activities by enterprise
  - `getByTimeRange` - Get activities in time range
  - `exportActivities` - Export to CSV
- **Status:** Not implemented
- **Integration Phase:** Phase 1

---

## Group 2: Organizational Structure
**Dependencies:** Enterprise (Group 1)  
**Priority:** CRITICAL  
**Complexity:** Medium

### 2.1 Department Management
- **File:** `departmentsController.js`
- **Features:**
  - `getAllDepartments` - List all departments
  - `getDepartmentById` - Get department details
  - `createDepartment` - Create department (supports parent departments)
  - `updateDepartment` - Update department
  - `deleteDepartment` - Delete with cascade (employees & teams)
  - `getAllEmployees` - List employees in department
  - `getEmployeeById` - Get employee details
  - `addEmployee` - Add employee to department
  - `updateEmployee` - Update employee
  - `removeEmployee` - Remove employee
  - `inviteEmployee` - Send email invitation
  - `getEmployeeInvitations` - Track invitations
- **Status:** Not implemented
- **Integration Phase:** Phase 2

### 2.2 Team Management
- **File:** `teamsController.js`
- **Features:**
  - `createTeam` - Create team in department
  - `getAllTeams` - List teams in department
  - `getTeamById` - Get team details
  - `updateTeam` - Update team
  - `deleteTeam` - Delete team
  - `addTeamMember` - Add employee to team
  - `removeTeamMember` - Remove from team
  - `getTeamMembers` - List team members
  - `updateTeamMemberRole` - Change member role
- **Status:** Not implemented
- **Integration Phase:** Phase 2

---

## Group 3: Performance & Analytics
**Dependencies:** Departments, Employees (Group 2)  
**Priority:** HIGH  
**Complexity:** High

### 3.1 Contact Aggregation & Caching
- **File:** `contactAggregationController.js`
- **Features:**
  - `getEnterpriseContactsSummary` - Aggregate all enterprise contacts
  - `getDepartmentContactsSummary` - Aggregate department contacts
  - `getEnterpriseContactsWithDetails` - Detailed enterprise contacts
  - `getDepartmentContactsWithDetails` - Detailed department contacts
  - `getCacheStats` - Cache performance metrics
  - `clearAllCache` - Clear all cache
  - `invalidateAllDepartmentCaches` - Bulk invalidation
  - `warmCacheForEnterprises` - Pre-load cache
  - `updateCacheConfig` - Runtime configuration
  - `getCacheConfig` - Get cache config
  - `getCacheAnalytics` - Advanced analytics
- **Performance:** 500x improvement (5-10s → 0.01s)
- **Status:** Not implemented
- **Integration Phase:** Phase 3

---

## Group 4: Security & Monitoring
**Dependencies:** Activity Logging (Group 1)  
**Priority:** HIGH  
**Complexity:** High

### 4.1 Security Alerts System
- **Files:**
  - `securityAlertsController.js`
  - `securityLogsController.js`
  - `securityActionsController.js`
  - `alertDetectionService.js`
- **Features:**
  - `getSecurityAlerts` - Get security alerts (filtered)
  - `acknowledgeSecurityAlert` - Acknowledge alert
  - `resolveSecurityAlert` - Resolve alert
  - `getSecurityLogs` - Get security activity logs
  - `exportSecurityLogs` - Export logs to CSV
  - `getSecurityLogStats` - Security statistics
  - `forcePasswordReset` - Force password reset
  - `tempLockAccount` - Temporarily lock account
  - `sendSecurityAlert` - Send custom alert
  - `createIncidentReport` - Create incident report
- **Status:** Not implemented
- **Integration Phase:** Phase 3

---

## Group 5: Access Control
**Dependencies:** Enterprise Users Subcollection (✅ we have this)  
**Priority:** MEDIUM  
**Complexity:** Low

### 5.1 Permissions Management
- **File:** `enterpriseController.js` (permissions methods)
- **Features:**
  - `updateUserIndividualPermissions` - Individual permissions (Business Cards POC)
  - `updateUserCalendarPermissions` - Calendar permissions
- **Status:** Not implemented
- **Integration Phase:** Phase 4

---

## Group 6: Communication & Export
**Dependencies:** Email Service (✅ we have this)  
**Priority:** MEDIUM  
**Complexity:** Low-Medium

### 6.1 Enterprise Email Interface
- **File:** `enterpriseController.js` (email methods)
- **Features:**
  - `sendEnterpriseEmail` - Send email with attachments, CC/BCC, priority
  - `getEnterpriseEmailLogs` - Email activity logs
- **Status:** Not implemented
- **Integration Phase:** Phase 4

### 6.2 Data Export
- **File:** `exportController.js`
- **Features:**
  - `exportTeams` - Export teams to CSV
  - `exportEmployees` - Export employees to CSV
  - `exportDepartments` - Export departments to CSV
- **Status:** Not implemented
- **Integration Phase:** Phase 4

---

## Group 7: Billing & Sales (Already Partially Implemented)
**Dependencies:** None  
**Priority:** N/A (Already in current server)  
**Complexity:** N/A

### 7.1 Enterprise Billing
- **File:** `enterpriseController.js` (billing methods)
- **Features:**
  - `getEnterpriseInvoices` - Get enterprise invoices
  - `downloadInvoice` - Download invoice PDF
  - `submitDemoRequest` - Demo request handling
  - `submitEnterpriseInquiry` - General inquiries
- **Status:** Partially implemented (invoices may need integration)
- **Integration Phase:** Future (if needed)

---

## Integration Order Summary

1. **Phase 1:** Group 1 (Foundation Layer)
   - Core Enterprise Management
   - Activity Logging

2. **Phase 2:** Group 2 (Organizational Structure)
   - Department Management
   - Team Management

3. **Phase 3:** Group 3 + Group 4 (Performance & Security)
   - Contact Aggregation & Caching
   - Security Alerts System

4. **Phase 4:** Group 5 + Group 6 (Access Control & Communication)
   - Permissions Management
   - Enterprise Email Interface
   - Data Export

---

## Final integration rules (don't forget)

These rules are fixed for the integration; implement and enforce them so we don't forget.

### Invoices & dunning
- **Pro forma:** One per billing cycle (e.g. 30 days before `nextBillingDate`), not every calendar month for annual plans.
- **Dunning:** All-channel (email + in-app + on invoice). Never dunning by email only for opted-in accounts.
- **!utd overrides !oi:** If the account is **not up to date** on payments (!utd), they **WILL** receive dunning (email + in-app + on invoice) regardless of invoice-email opt-out. Critical payment/account-status communications are never suppressed by opt-out.

### Cancellation
- **Cannot cancel while in arrears.** An account must be **up to date on payments** before cancellation is allowed. An account in grace period or suspended cannot be cancelled until the outstanding amount is paid (or otherwise resolved). Enforce this in the cancellation flow and in any API that sets subscription/account to cancelled.

---

## Invoices, dunning & cron – implementation checklist

Use this list so we don’t forget what’s done and what’s left. Refer to **Final integration rules** above for the business rules (pro forma, dunning channels, !utd overrides !oi, no cancel in arrears).

### Implemented
- **First-payment receipt:** Create receipt in `enterprise_invoices` and email PDF to contact (`generateReceiptFromQuote` in payment callback).
- **Per-invoice APIs:** `GET /api/enterprise/invoices/:invoiceId`, `GET .../pdf`, `POST .../email` (authenticated).
- **One-off payment_failed email:** On `invoice.payment_failed` webhook, send “payment failed – update payment method before &lt;grace end&gt;” via `sendSubscriptionEmail('payment_failed', ...)`.
- **Suspended handling:** When grace lapses, set `accountStatus = 'suspended'` and send suspended email.
- **In-app dunning data (backend):** `getSubscriptionStatus` (or equivalent) returns `accountStatus`, `warningBanner`, `gracePeriodEndDate` so the app can show banner/section.
- **Pro forma building block:** `generateInvoiceFromAccount(account)` creates an unpaid invoice in `enterprise_invoices` and can produce PDF (no send flow yet).
- **Schema:** `enterprise_invoices` has e.g. `invoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'`.

### Not implemented (do not forget)
- **List invoices by enterprise:** Add `GET /api/enterprise/:enterpriseId/invoices` (or equivalent) so the app can list invoices/receipts for the enterprise and then open PDF.
- **Opt-in for invoice emails:** Add field (e.g. `receiveInvoicesByEmail` or `billingEmails`) on account/enterprise; use it so pro forma / statement emails are sent only when opted in (dunning still follows !utd-overrides-!oi).
- **!utd overrides !oi:** When sending dunning, if account is not up to date, send regardless of opt-out; implement in the same place that sends dunning emails.
- **Block cancel when in arrears:** In `cancelSubscription` (and any other cancel path), reject if `accountStatus === 'suspended'` or if in grace period (e.g. `gracePeriodEndDate` in the future). Return clear message: must be up to date before cancelling.
- **Dunning on PDF:** Ensure invoice/receipt PDF shows “Overdue” / “Pay by &lt;date&gt;” when applicable (schema supports `overdue`; confirm PDF generator renders it).
- **Renewal receipt:** On `invoice.payment_succeeded` webhook, create a receipt doc in `enterprise_invoices` and email receipt PDF to contact (same pattern as first payment).
- **Pro forma / statement send:** Trigger (e.g. cron) that, for opted-in and up-to-date accounts, sends pro forma (or statement) once per billing cycle (e.g. 30 days before `nextBillingDate`). Use `generateInvoiceFromAccount` or equivalent; send email with PDF or link.
- **Cron – dunning:** Scheduled job that finds accounts in grace or suspended and sends dunning (email + ensure in-app and on-invoice are covered). Respect: !utd overrides !oi (always send dunning when !utd). Throttle as needed (e.g. don’t send same dunning email daily).
- **Cron – pro forma:** Scheduled job that finds accounts that are active, up to date, and opted in, with `nextBillingDate` in the window (e.g. next 30 days), and sends one pro forma per billing cycle (e.g. once per year for annual).

---

## Notes

- **Group 1** is the foundation - all other groups depend on it
- **Group 2** provides organizational structure - required for Group 3
- **Group 3** depends on Group 2 (needs departments/employees)
- **Group 4** depends on Group 1 (needs activity logs)
- **Group 5** depends on enterprise users subcollection (✅ already implemented)
- **Group 6** can be integrated independently
- **Group 7** is already partially implemented in current server

---

## Deferred / End of pipeline (not part of integration)

These items are agreed for later implementation. They are **not** in the other server and were always intended for future.

### Role-based CRUD for departments and teams (F4)

- **What:** Restrict who can create/read/update/delete departments and teams by role (admin = full CRUD all; manager = RUD own department and its teams only; director = full CRUD; employee = read-only).
- **Why deferred:** The other server (XS_Backend - Copy) has **no** role checks on department/team CRUD—only `authenticateUser`. So this is not part of “copy and adapt” integration; it is an enhancement for after Group 2 is integrated.
- **When:** Implement after Group 2 integration is stable. See **GROUP2_INTEGRATION_QUESTIONS.md** F4 Decision for the agreed matrix.
