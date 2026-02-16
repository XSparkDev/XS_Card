# Group 2 Integration – Discussion Questions

**Purpose:** Every decision point for Group 2 (Organizational Structure) is listed as a question. No assumptions. We discuss each one; agreed answers move into a separate implementation plan and tracker.

**Process:**
1. Discuss every question below.
2. Record decision (Agree / Disagree / Defer / Other).
3. Move agreed items into an implementation plan document that is tracked.
4. Slow and methodical.

**Golden Rules applied:**
- **Rule #1:** No assumptions – if it affects implementation, it is asked here.
- **Rule #2:** Group 2 = POOP (build alongside current server CEMENT); existing payment/subscription = CEMENT (don’t modify).
- **Rule #3:** No dummy or mock data in implementation or tests.

**Source of truth for “other” server:** XS_Backend - Copy.

---

## How to use this document

- **Question:** The thing we need to decide. Answer explicitly; do not assume.
- **Context:** Optional background so the question is clear.
- **Proposed (for discussion):** A possible answer to discuss and accept, reject, or change. Not an assumption.
- **Decision:** To be filled when we agree (e.g. “Agree”, “Defer”, “See: …”).

---

## A. Employee model & identity

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| A1 | In XS_Backend - Copy, is an “employee” (in `departments/.../employees`) the same entity as a **user** (top-level `users` collection), or a separate entity that references a user (e.g. by `userId`)? | Needed to design employee doc shape and invite flow. | Separate entity that references user; employee doc holds e.g. `userId`, optional `email`, `displayName`, `role`. | **Agreed.** Employee is the same entity as user. One user document in `users`; when they are in a department they have an employee document at `enterprise/{eid}/departments/{did}/employees/{userId}` (doc ID = userId). User doc gets `isEmployee: true`, `enterpriseRef`, `employeeRef`, `departmentRef`. Keep this model: no separate employee identity; one app (mobile), feature-gated by `plan` (free / premium / enterprise) and for enterprise by `isEmployee` + `enterpriseRef`; when department/role needed, read employee doc. |
| A2 | Can an employee exist without a user account (e.g. “pending invite” or placeholder until they register)? | Affects whether we create employee doc before or after user exists. | Yes: allow employee doc with `email`, no `userId`, and a status like `invited`. | **Agreed.** No. Keep other server behaviour: employee is only created when a user exists (or is created in the same addEmployee request). No “pending invite” employee record. We will **not** add inviteEmployee / getEmployeeInvitations in the new design yet. Only addEmployee (by userId or email); when adding by email for new user, create user + employee then send one email with verify + set-password links. |
| A3 | Can one user be an employee in more than one department within the same enterprise? | Affects schema and authorization. | No for now: one department per user per enterprise. | **Agreed.** No. Other server: user has a single `departmentRef`; employee doc lives at one department path per user. One department per user per enterprise. Keep for now. |
| A4 | What are the exact field names and types for an employee document in the other server? | We must match or consciously diverge; no assumption. | *(Must be read from XS_Backend - Copy; not assumed.)* | **From XS_Backend - Copy.** Doc ID = `userId`. Fields: `userId` (DocumentReference → users/{id}), `name`, `surname`, `email`, `phone` (strings), `role` (string: employee|manager|director|admin), `position`, `profileImage`, `employeeId` (string, display id), `teamId` (string|null), `isActive` (boolean), `cardsRef` (DocumentReference → cards/{id}), `createdAt`, `updatedAt` (Timestamp). Optional (deactivate/reactivate sync): `deactivationAt`, `reactivationAt` (Timestamp). Match this in Group 2 unless we consciously diverge. |

---

## B. Invite flow

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| B1 | For `inviteEmployee`, what is the exact sequence of steps in the other server (e.g. create record → send email → user registers → link user to employee)? | Needed to implement the same or documented variant. | *(Must be read from XS_Backend - Copy or defined explicitly.)* | **From scan.** Other server has no `inviteEmployee`; the flow is **addEmployee** (by email). Sequence when adding by email for a **new** user: (1) Create Firebase Auth user + `users` doc + `cards` doc. (2) Create employee doc at `enterprise/{eid}/departments/{did}/employees/{userId}`. (3) Update user with `employeeRef`, `departmentRef`, `enterpriseRef`, `isEmployee: true`. (4) Send one email with verify-email link and set-password link (24h expiry). So: create user → create employee → update user refs → send email. No separate invite step; we are not adding inviteEmployee (see A2). |
| B2 | Where are invitations stored in the other server: a dedicated subcollection (e.g. `departmentInvitations`) or fields on the employee document (e.g. `status`, `invitedAt`)? | Affects Firestore structure and `getEmployeeInvitations` implementation. | Stored on employee doc: e.g. `status: 'invited'`, `invitedAt`, optional token/expiry. | **Covered by A2.** No invitation storage. We are not adding inviteEmployee/getEmployeeInvitations; addEmployee creates user+employee then sends email. No pending-invite record. |
| B3 | Does the other server use an invitation token (or signed link) for security, and should we? | Affects sign-up link format and validation. | Use a token in the link; validate on registration; optional expiry (e.g. 7 days). | **Covered by addEmployee flow.** Other server uses tokens in the post-creation email: `verificationToken` (verify-email link) and `passwordSetupToken` (set-password link), both 24h expiry. We match that for addEmployee-by-email (new user): tokens in links, validate on verify/set-password, 24h expiry. |
| B4 | If the same email is invited again to the same department (duplicate invite), should we reject, or allow and resend (e.g. new token)? | Affects idempotency and UX. | *(No assumption; must be decided.)* | **Covered.** No invite flow; duplicate case is addEmployee with same user/email to same department. Other server: checks “already employee in this department” → returns 409 “User is already an employee in this department”. Reject duplicate add. Match that. |

---

## C. Enterprise users subcollection

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| C1 | Is `enterprise/{enterpriseId}/users/{userId}` already created in the current server when a user registers with `enterpriseId`, or is it still TODO? | Tracker mentions this as other-server pattern; affects Group 2 dependency. | *(Must be verified in codebase; no assumption.)* | **From scan.** Yes, already created. In current server `userController.js` (registration with `enterpriseId`): batch creates both `users/{uid}` and `enterprise/{enterpriseId}/users/{uid}` atomically. For users created later via **addEmployee** (Group 2), we will create `enterprise/.../users/{userId}` when we implement addEmployee so every enterprise user has an entry. |
| C2 | If still TODO: should we implement creation of `enterprise/{enterpriseId}/users/{userId}` before, during, or after Group 2? | Affects order of work and invite flow. | Implement when user registers with enterpriseId (can be part of or just before Group 2). | **Covered by C1.** Registration path already done. For **addEmployee**-created users: implement **during** Group 2 when we add addEmployee (create enterprise/users doc in the same flow as creating the user and employee). No separate phase needed. |
| C3 | What fields should exist in `enterprise/{enterpriseId}/users/{userId}`? Full user snapshot or minimal (e.g. `userId`, `email`, `role`, `departmentId`)? | Affects duplication and consistency. | Minimal: userId, email, role, optional departmentId/departmentRef. | **From scan.** Current server (registration) uses: `id`, `firstName`, `lastName`, `email`, `role`, `status`, `individualPermissions: { removed: [], added: [] }`, `createdAt`, `updatedAt`. Other server (on-demand in permissions) adds `calendarPermissions: { removed: [], added: [] }` when needed. Use **minimal**: match current server; add `calendarPermissions` when we do Group 5 (permissions). For addEmployee-created users include role (from employee) and optionally departmentId/departmentRef for consistency. |

---

## D. Departments

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| D1 | For `parentDepartment`, does the other server store a reference (e.g. Firestore ref) or an ID string? What is the exact field name? | Must match or consciously diverge. | *(Read from XS_Backend - Copy.)* | **From XS_Backend - Copy.** Field name **`parentDepartmentId`**; type **string** (department ID). Stored in department doc (default null). |
| D2 | How many levels of department hierarchy does the other server support (flat, one parent level, or arbitrary tree)? | Affects validation and queries. | At least one level (parent/child); avoid deep nesting in Firestore. | **From XS_Backend - Copy.** One parent level (parent/child). Delete blocks if any child departments exist. No deep tree. |
| D3 | Who can create, update, and delete departments? (e.g. any user in the enterprise, or only certain roles such as admin/director?) | Affects authorization in every department endpoint. | Only admin (and optionally director). | **From XS_Backend - Copy.** No role check for department CRUD; routes use **authenticateUser** only. Match other server. F4 defers role matrix. |
| D4 | On `deleteDepartment`, should we hard-delete all employees and teams in that department, block delete if any exist, or soft-delete (e.g. `deleted: true`)? | Affects data model and restore/audit needs. | Hard delete: remove teams and employees subcollections, then department doc. | **From XS_Backend - Copy.** **Block delete** if department has employees or child departments (409). If empty, delete department doc only. No cascade. |
| D5 | Does the other server have a “manager” (or similar) per department? If yes, what is the field name and type (userId, employeeId, ref)? | Affects department document shape. | Optional `managerId` or `managerRef`. | **From XS_Backend - Copy.** **`managers`**: array of DocumentReference to `users/{userId}`. Create/update accept `managers` (array of user IDs); stored as refs. Those users are added as employees with role `manager`. |
| D6 | What are the exact Firestore collection/subcollection names for departments and employees in the other server? (e.g. `enterprise/{id}/departments/{id}/employees`) | We must match or consciously diverge. | *(Read from XS_Backend - Copy.)* | **From XS_Backend - Copy.** `enterprise/{eid}/departments/{did}`; `.../departments/{did}/employees`; `.../departments/{did}/teams`. |
| D7 | What fields are required when creating a department in the other server (e.g. `name` only, or also `description`, `parentDepartment`)? | Affects validation. | *(Read from XS_Backend - Copy.)* | **From XS_Backend - Copy.** **Required:** `name`. **Optional:** `description` (default ''), `parentDepartmentId` (default null), `managers` (array of user IDs, default []). Doc ID = slug of name. |

---

## E. Teams

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| E1 | When adding a team member (`addTeamMember`), does the other server accept an **employeeId** (from that department’s employees) or a **userId**? If userId, does the backend resolve it to an employee in that department? | Affects API contract and implementation. | Accept employeeId; optionally also accept userId and resolve to employee in same department. | **From XS_Backend - Copy.** Accepts **employeeId** in req.body (department employee doc ID = userId per A4). Does not accept userId or resolve; employee must exist at departments/{did}/employees/{employeeId}. |
| E2 | Where are team members stored in the other server? (e.g. subcollection `teams/{teamId}/members` with fields like `employeeId`, `userId`, `role`?) | Affects Firestore structure. | Subcollection `teams/{teamId}/members/{memberId}` with employeeId, userId, role. | **From XS_Backend - Copy.** Subcollection **teams/{teamId}/employees** (not "members"). Doc ID auto-generated. Fields: employeeRef, userId, name, surname, role, position, addedAt. |
| E3 | Can the same employee be in multiple teams within the same department? | Affects validation and UI. | Yes. | **From XS_Backend - Copy.** **No.** If employee already has teamRef, add returns 409 "Employee is already a member of team X. Remove them from that team first." One team per employee per department. |
| E4 | Who can create, update, delete teams and manage team members? Same rules as departments or different (e.g. department manager)? | Affects authorization. | Same as departments: admin (and optionally director) for now. | **From XS_Backend - Copy.** No role check; **authenticateUser** only (same as departments). Match other server. F4 defers role matrix. |
| E5 | What are the exact Firestore paths for teams in the other server? (e.g. `enterprise/{eid}/departments/{did}/teams/{tid}`?) | Must match or consciously diverge. | *(Read from XS_Backend - Copy.)* | **From XS_Backend - Copy.** `enterprise/{eid}/departments/{did}/teams/{tid}`; team members: `.../teams/{tid}/employees` (auto-generated doc IDs). |
| E6 | What fields are required when creating a team? What are the allowed values for team member role (e.g. leader, member)? | Affects validation and `updateTeamMemberRole`. | *(Read from XS_Backend - Copy.)* | **From XS_Backend - Copy.** **Required:** name. **Optional:** description (default ''), leaderId (default null; must be department employee doc ID). No separate team-member role enum: team has leaderId/leaderRef on team doc; members in team/employees get role copied from department employee. updateEmployeeRole (department employee) exists; no updateTeamMemberRole. |

---

## F. Authorization & routes

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| F1 | Should we add dedicated middleware (e.g. `requireEnterpriseDepartmentAccess`) or keep authorization checks inside each controller (like Phase 1)? | Phase 1 used inline checks. | Keep inline in controllers for Phase 2; add shared middleware later if duplication grows. | |
| F2 | What exact route paths should we use for department and team APIs? (e.g. `/api/enterprise/:enterpriseId/departments/...` and `.../departments/:departmentId/teams/...`, or a different prefix to avoid clashing with existing `/api/enterprise/...`?) | Existing routes: quote, payment, subscription, enterprise CRUD. | Use `/api/enterprise/:enterpriseId/departments/...` and `.../teams/...`; confirm no clash with existing routes. | |
| F3 | Should department and team routes live in the same router file as existing enterprise routes, or in a new file (e.g. `departmentRoutes.js`) mounted separately? | Affects file layout. | New file (e.g. `departmentRoutes.js` or `orgStructureRoutes.js`) for department/team routes. | |
| F4 | Which roles from the current server (e.g. admin, director, manager, employee) are allowed to perform which operations (create/read/update/delete) on departments and teams? | Must be explicit for each operation. | *(List per operation and role; no assumption.)* | **Agreed (conscious divergence); deferred to end of pipeline.** Other server has no role checks on department/team CRUD. We **add** later: Admin = full CRUD all; Manager = RUD own department and its teams; Director = full CRUD; Employee = read-only. **Not part of Group 2 integration**—implement after integration is stable. See **ENTERPRISE_FEATURE_GROUPING.md** § Deferred / End of pipeline. |

---

## G. Activity logging & response format

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| G1 | Should every department/team/employee create/update/delete (and optionally view) operation call the existing `logActivity` (utils/logger) with RESOURCES.DEPARTMENT, TEAM, EMPLOYEE? | Phase 1 integrated activity logging; logger already has these resource types. | Yes; same pattern as Phase 1. | |
| G2 | If a call to `logActivity` fails (e.g. Firestore error), should the HTTP request fail or should we only log the error and still return success for the business operation? | Affects reliability and observability. | Do not fail the request; log error and continue (try/catch around logActivity). | |
| G3 | Should response shape for all new endpoints follow the current server pattern `{ success: true/false, message?, data? }` (and for lists, `data` as array or `data: { items: [...] }`)? | Phase 1 and existing enterprise CRUD use this. | Yes; same pattern. | |

---

## H. Current server: delete enterprise & stats

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| H1 | When Group 2 exists, for `deleteEnterprise`: should we block delete if any departments exist, or cascade-delete (departments → teams → employees) and then delete the enterprise? | Current code has TODO: check departments/employees before delete. | Cascade delete all departments (and their teams/employees), then enterprise. | **Agreed.** Enterprises are never deleted; they are deactivated and archived. No change to deleteEnterprise for Group 2 (block delete if ever used, or leave as-is). |
| H2 | For `getEnterpriseStats`, when Group 2 exists: should we add only a `departments` count, or also `teams` and `employees` counts? | Current code returns `departments: 0` as placeholder. | Add departments, teams, and employees counts. | **Agreed.** Add all three: departments, teams, and employees counts. |

---

## I. Email & infrastructure

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| I1 | What email mechanism does the current server use for transactional email (e.g. Nodemailer, SendGrid, Firebase Extensions)? Should we use the same for `inviteEmployee`? | Invite sends an email. | Use the same mechanism as existing transactional email in the current server. | **From scan.** Current server uses **Nodemailer** via `public/Utils/emailService.js` (primary SMTP transporter, optional SendGrid, Gmail fallback). All transactional email goes through **`sendMailWithStatus`**. We use the same for addEmployee and enterprise emails. No separate “invite” flow; addEmployee-by-email uses this. **Agreed:** use current server’s email mechanism (already done). |
| I2 | Does the other server define a specific subject/body/link format for invitation emails? Should we match it? | Affects copy and link format. | *(Read from XS_Backend - Copy or define explicitly.)* | **From XS_Backend - Copy.** For addEmployee (new user by email) the other server sends **one email** with: **Subject:** `Welcome to XS Card - Verify your email address`. **Links:** (1) Verify email: `{APP_URL}/verify-email?token={verificationToken}&uid={userId}`; (2) Set password: `{APP_URL}/set-password?token={passwordSetupToken}&uid={userId}`; both 24h expiry. **Body:** “Welcome to XS Card!”, “You've been added as an employee by your administrator.”, verify link, set-password link, “This link will expire in 24 hours.” Current server’s port of departmentsController **already matches** this subject, links, and body. **Agreed:** match other server format (already implemented). |

---

## J. Firestore & indexes

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| J1 | Do existing Firestore security rules need to be updated so that `enterprise/{enterpriseId}/departments/...` (and subcollections) are only readable/writable by authenticated users with the correct enterprise (and optionally role)? | New data paths. | Yes; add rules for new paths and document in same place as existing rules. | **Agreed.** Yes; add Firestore rules for the new Group 2 paths so only authenticated users with the correct enterprise (and optionally role) can read/write; document in same place as existing rules. **Deferred for launch:** Ignore rules for now; ship to public; implement rules retroactively. All instances where rules are needed are listed in § "Firestore rules – deferred" below. |
| J2 | Should we document required composite indexes (e.g. for listing departments by enterprise, employees by department, teams by department) in a file like `backend/firestore-indexes.md` as we add queries? | Phase 1 guide had a step for index documentation. | Yes; add a Phase 2 (Group 2) section. | **Agreed.** Yes; document required composite indexes (e.g. in `backend/firestore-indexes.md` or equivalent) as we add Group 2 queries; add a Group 2 section. |

---

## K. Order & scope

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| K1 | Within Group 2, in what order should we implement? (e.g. (1) Department CRUD only, (2) Department employees, (3) Invite + getEmployeeInvitations, (4) Team CRUD, (5) Team members – or different?) | Dependencies: teams depend on departments and employees. | Order above: dept CRUD → dept employees → invite → team CRUD → team members. | **Agreed.** Order: (1) Department CRUD, (2) Department employees (addEmployee, no invite per A2/B), (3) Team CRUD, (4) Team members. Invite/getEmployeeInvitations deferred. Implementation already followed this order. |
| K2 | Should we copy behavior from XS_Backend - Copy as-is and then adapt (imports, response format, authz), or design minimal APIs first and take from the other server only where it fits? | Phase 1 was copy-and-adapt. | Copy from other server and adapt (imports, response format, authz, activity logging). | **Agreed.** Copy from XS_Backend - Copy and adapt (imports, firebase path, response shape, authz, activity logging). Already done for departmentsController, teamsController, exportController. |
| K3 | Do we implement and ship departments first, then teams (two steps), or both in one implementation phase? | Affects PRs and testing. | *(No assumption; must be decided.)* | **Agreed.** Both in one implementation phase: departments and teams in the same router (departmentRoutes.js), same mount. Already done. |

---

## L. Pagination, delete behaviour, list shape

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| L1 | Should list endpoints (e.g. getAllDepartments, getAllTeams, getAllEmployees) support pagination (e.g. `limit`, `startAfter` or cursor) from day one? | Prevents large reads. | Yes: e.g. limit (default 50, max 100) and optional startAfter. | **Agreed.** Add pagination: `limit` (default 50, max 100) and optional `startAfter` (cursor) for list endpoints. Implement when touching those endpoints if not already present in ported code. |
| L2 | Do we need soft delete (e.g. `deleted: true`, `deletedAt`) for departments, teams, or employees, or is hard delete sufficient for now? | Affects schema and restore/audit. | Hard delete for Phase 2. | **Agreed.** Hard delete for now (matches D4 and ported behaviour). No soft-delete fields. |
| L3 | Should `getAllDepartments` (and similarly team list) return a flat list or a tree (nested by parentDepartment)? | Affects API shape and client. | Flat list; client (or a separate endpoint later) can build tree. | **Agreed.** Flat list; client (or a separate endpoint later) can build tree. Matches ported behaviour. |

---

## M. Validation, errors, and testing

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| M1 | For create/update endpoints, what are the required and optional fields for department, team, and employee in the other server? What validation rules (e.g. max length, allowed characters)? | Must be defined for validation. | *(Read from XS_Backend - Copy or define explicitly.)* | **Agreed.** Follow ported controllers from XS_Backend - Copy: department (name required, description optional); team (name required, description optional); employee per A4. Validation: match other server where defined; otherwise sensible defaults (e.g. name 1–200 chars). Document in API/README when documenting Group 2. |
| M2 | Should we add rate limiting on create/invite endpoints (e.g. limit invites per enterprise per hour)? | Prevents abuse. | *(No assumption; must be decided.)* | **Agreed.** No rate limiting on Group 2 endpoints for now. Add per-enterprise or per-IP limits later if abuse appears. |
| M3 | How will Group 2 be tested: unit tests only, E2E only, or both? Same approach as Phase 1? | Rule #3: real data only; no mocks. | *(No assumption; must be decided.)* | **Agreed.** E2E with real data (same as Phase 1); no mocks. Use existing E2E script (test-e2e-enterprise-full-flow.js) and manual flows; add Postman/README as needed. |
| M4 | If we need to roll back Group 2 after deployment, is it sufficient to remove new routes and controller code, or do we need a plan for Firestore data (e.g. leave data in place vs. migration)? | Affects rollout and rollback. | *(No assumption; must be decided.)* | **Agreed.** Rollback = remove new routes and Group 2 controller code only. Leave Firestore data in place (no migration). Data can be re-used if we re-enable later. |

---

## N. Documentation and API consumers

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| N1 | Where should the new Group 2 API be documented (e.g. README in backend, Postman collection, OpenAPI, or other)? | Phase 1 had Postman collection. | Same as Phase 1 (e.g. add to Postman) and/or backend README. | **Agreed.** Same as Phase 1: add Group 2 to Postman collection and/or backend README (e.g. E2E_ENTERPRISE_FULL_FLOW.md, ENTERPRISE_INTEGRATION_TRACKER.md). |
| N2 | Is there a frontend in this repo that will call these APIs when Group 2 is implemented, or is this backend-only for now? | Affects contract stability and prioritization. | *(No assumption; must be stated.)* | **Agreed.** Frontend exists (enterprise app / website); it will call Group 2 APIs. Maintain contract stability for that consumer. |

---

## Summary

- **Total questions:** 42 (A1–A4, B1–B4, C1–C3, D1–D7, E1–E6, F1–F4, G1–G3, H1–H2, I1–I2, J1–J2, K1–K3, L1–L3, M1–M4, N1–N2).
- **Questions that require reading XS_Backend - Copy (no proposed answer):** A4, B1 (D1–D7, E1–E6, I2, M1 now decided from scan).
- **Questions left with “No assumption” for you to decide:** B4, F4 (K3, M2, M3, M4, N2 now decided).

After each question is discussed and decided, record the **Decision** in the table. Agreed items can then be moved into a separate **Group 2 Implementation Plan** document and tracked there.

---

## Group 2 integration progress (reassessed from decisions in this doc)

**Decided and implemented (core):** A, B, C, F1–F3, G, I, J, K, L, M, N. Routes and controllers ported (departments, teams, employees, export); welcome email and registration redirect use ENTERPRISE_APP_URL; SignIn not gated by department auth.

**H1 (delete enterprise):** Decision in table: **enterprises are never deleted**; they are deactivated and archived. **No change to deleteEnterprise** for Group 2 (block delete if ever used, or leave as-is). So H1 needs **no implementation**—no cascade delete, no new delete behaviour. Current CEMENT stays as-is.

**H2 (getEnterpriseStats):** Decision: add departments, teams, and employees counts. **Implemented.** Stats now return real `departments`, `teams`, and `employees` counts.

**L1 (pagination):** Decision: add limit (default 50, max 100) and optional startAfter for list endpoints. **Implemented** on getAllDepartments, getAllTeams, getDepartmentEmployees, getTeamMembers (query params: `limit`, `startAfter`; response includes `nextPageToken` when there are more).

**Still open (need decision or read from other server):** None. E1–E6 are now decided from the same XS_Backend - Copy scan as D1–D7. F4 deferred.

**What’s left for integration (actionable before public launch):**
- **J2 (Index docs):** Document required composite indexes for Group 2 queries (e.g. in `backend/firestore-indexes.md` or equivalent) when adding list/pagination queries.
- **F4 (roles):** Deferred to end of pipeline—not part of Group 2 integration.
- **Optional:** Record F1, F2, F3, G1, G2, G3 in the Decision column (already followed in implementation).

**Deferred (post-launch, implement retroactively):**
- **J1 (Firestore rules):** Every path where rules will be needed is listed in **`FIRESTORE_RULES_DEFERRED.md`** (and in § "Firestore rules – deferred" below).

---

### Firestore rules – deferred (where to add rules later)

**Goal when we implement:** Only authenticated users who belong to the same enterprise can read/write these paths (so Enterprise A cannot access Enterprise B's org data). Implement in Firebase `firestore.rules` and document where rules live.

| # | Path | Notes |
|---|------|--------|
| 1 | `enterprise/{eid}` | Enterprise doc; may already have rules. Ensure only users in this enterprise (e.g. in `enterprise/{eid}/users/{uid}` or with `enterpriseRef`) can read/write. |
| 2 | `enterprise/{eid}/departments` | Collection: list/create departments. Restrict to same enterprise. |
| 3 | `enterprise/{eid}/departments/{did}` | Department doc: read/update/delete. Restrict to same enterprise. |
| 4 | `enterprise/{eid}/departments/{did}/employees` | Subcollection: list/add employees. Restrict to same enterprise. |
| 5 | `enterprise/{eid}/departments/{did}/employees/{employeeId}` | Employee doc: read/update/delete (e.g. deactivate). Restrict to same enterprise. |
| 6 | `enterprise/{eid}/departments/{did}/teams` | Subcollection: list/create teams. Restrict to same enterprise. |
| 7 | `enterprise/{eid}/departments/{did}/teams/{tid}` | Team doc: read/update/delete. Restrict to same enterprise. |
| 8 | `enterprise/{eid}/departments/{did}/teams/{tid}/employees` | Subcollection: team members. Restrict to same enterprise. |

*If clients never hit Firestore directly (only the Node API does), rules can deny all client access and rely on server (Admin SDK); the list above still marks what to lock down for consistency or future direct access.*

---

### Decided, not yet implemented (list and approach)

| Item | What | Status |
|------|------|--------|
| **H2** | Add departments, teams, and employees counts to `getEnterpriseStats` | **Done.** Implemented in `enterpriseController.js`: real counts via departments snapshot and per-department teams/employees sums. |
| **L1** | Pagination (limit default 50, max 100; optional startAfter) on list endpoints | **Done.** Implemented on `getAllDepartments`, `getAllTeams`, `getDepartmentEmployees`, `getTeamMembers`: query params `limit` (default 50, max 100), `startAfter` (doc id); response includes `nextPageToken` when more results exist. |
