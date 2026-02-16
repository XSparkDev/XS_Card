# Group 3 Integration – Discussion Questions

**Purpose:** Decision points for Group 3 (Performance & Analytics: Contact Aggregation & Caching). Answers that could be determined by scanning both servers are recorded below; only items that could **not** be resolved from the scans appear as questions.

**Process:**
1. Use the "From scan" section as the implementation reference (no questions there).
2. Decide only the questions listed in the table.
3. Record decisions; move agreed items into implementation plan.

**Golden Rules:** Same as Group 2 (no assumptions; POOP alongside CEMENT; no mock data).

**Source of truth for "other" server:** XS_Backend - Copy. **Current server:** backend (this repo).

---

## From scan (both servers) – use as reference

Everything below was determined by scanning **XS_Backend - Copy** and the **current server**. No questions—implement to match unless we consciously diverge.

### Scope and file

- **Group 3 scope:** Contact aggregation with in-memory caching so enterprise/department contact summaries and details are fast (e.g. 5–10s → &lt;100ms on cache hit).
- **Other server:** `controllers/enterprise/contactAggregationController.js` (~1800 lines), routes on `routes/enterpriseRoutes.js`.
- **Current server:** `controllers/enterprise/contactAggregationController.js` is a **stub** (only `invalidateEnterpriseCache` no-op). `departmentsController.js` already calls `invalidateEnterpriseCache(enterpriseId)` after add/update/delete employee (no-op until Group 3 implemented).

### Firestore paths (match current server)

- **Enterprise:** `enterprise/{eid}` (both servers use `enterprise`, not `enterprises`).
- **Departments / employees:** `enterprise/{eid}/departments/{did}`, `.../departments/{did}/employees` (same as Group 2).
- **Contacts (per user):** Top-level `contacts/{userId}`. Document has `contactList` (array of contact objects). Current server uses `contactList` consistently (see `contactController.js`).
- **Employee → user:** Employee doc has `userId` (DocumentReference to `users/{id}`). Other server uses `empData.userId?.id`; current server Group 2 uses `name`/`surname` (A4). Aggregation must support both `firstName`/`lastName` and `name`/`surname` when building display names (other server already does `firstName || name`, `lastName || surname`).

### API endpoints (other server)

| Method | Path | Controller method | Auth |
|--------|------|-------------------|------|
| GET | `/enterprise/:enterpriseId/contacts/summary` | getEnterpriseContactsSummary | authenticateUser |
| GET | `/enterprise/:enterpriseId/departments/:departmentId/contacts/summary` | getDepartmentContactsSummary | authenticateUser |
| GET | `/enterprise/:enterpriseId/contacts/details` | getEnterpriseContactsWithDetails | authenticateUser |
| GET | `/enterprise/:enterpriseId/departments/:departmentId/contacts/details` | getDepartmentContactsWithDetails | authenticateUser |
| GET | `/cache/stats` | getCacheStats | authenticateUser |
| DELETE | `/cache/clear` | clearAllCache | authenticateUser |
| DELETE | `/cache/departments/clear` | invalidateAllDepartmentCaches | authenticateUser |
| POST | `/cache/warm` | warmCacheForEnterprises | authenticateUser |
| PUT | `/cache/config` | updateCacheConfig | authenticateUser |
| GET | `/cache/config` | getCacheConfig | authenticateUser |
| GET | `/cache/analytics` | getCacheAnalytics | authenticateUser |

- **Route mounting (current server):** Group 2 uses `departmentRoutes.js` with full path `/api/enterprise/:enterpriseId/...`. So Group 3 contact routes should be e.g. `GET /api/enterprise/:enterpriseId/contacts/summary`, `GET /api/enterprise/:enterpriseId/departments/:departmentId/contacts/summary`, etc. Cache routes in other server have **no** enterpriseId (global): `GET /cache/stats`, `DELETE /cache/clear`, etc. So current server would use e.g. `GET /api/enterprise/cache/stats` or a separate mount—**decision:** see Questions below re global cache routes.

### Response shapes (other server)

- **Summary (enterprise):** `{ success, data: { enterpriseId, enterpriseName, totalContacts, totalEmployees, totalDepartments, departments: [{ departmentId, departmentName, totalContacts, totalEmployees }], calculationTime }, cached?, timestamp }`
- **Summary (department):** `{ success, data: { departmentId, departmentName, totalContacts, totalEmployees, employees: [{ employeeId, userId, name, contactCount }], calculationTime }, cached?, timestamp }`
- **Details (enterprise):** `data` includes `contacts` (array), `totalContacts`, `totalEmployees`, `departments` (with per-department contacts), `pagination` if limit/offset, `metadata` if requested. Query params: `includeMetadata`, `sortBy` (contactName | employeeName | department | email | company | createdAt), `sortOrder`, `limit`, `offset`.
- **Details (department):** Same idea, scoped to one department. Contact object includes e.g. name, surname, fullName, email, phone, company, position, website, linkedin, twitter, instagram, address, notes, tags, createdAt, addedByEmployee, addedByEmployeeId, addedByDepartment.
- **Cache stats:** `{ success, cache: { totalEntries, hitCount, missCount, hitRate, memoryUsage, lastCleanup, ... }, timestamp }`
- **Clear cache:** `{ success, message: "Cleared N cache entries", timestamp }`
- **Warm cache:** Body `{ enterpriseIds: string[] }`. Response `{ success, message, results: [{ enterpriseId, status: 'warmed'|'already_cached'|'error', duration?, error? }], timestamp }`
- **Cache config (get):** `{ success, configuration: { ttlSettings, maxCacheSize, defaultTTL }, timestamp }`
- **Cache config (put):** Body `{ ttlSettings: { enterprise?, department?, ... } }` (milliseconds). Response includes currentSettings.
- **Cache analytics:** `{ success, analytics: { totalEntries, hitRate, mostAccessedEntries, ttlDistribution, avgAccessCount, ... }, timestamp }`

### Cache behavior (other server)

- **Storage:** In-memory only (`ContactCache` class, `Map`). No Firestore or Redis. Cache is lost on process restart.
- **Keys:** `enterprise:{eid}:contacts` (enterprise summary); `enterprise:{eid}:department:{did}:contacts` (department summary); details keys include sort/limit/offset in key.
- **TTL:** Default 1 hour; configurable per type (enterprise 1h, department 30m, etc.). Cleanup every 10 minutes; max 1000 entries; eviction of oldest 10% when full; if heap &gt; 500MB, evict 50%.
- **Warming:** Optional warming flag to avoid duplicate concurrent calculation; 30s timeout. On calculation error, return stale data if available.
- **Exports:** `invalidateEnterpriseCache(enterpriseId)`, `invalidateDepartmentCache(enterpriseId, departmentId)`, `contactCache` (instance). Used by: contact add (server.js x2), departmentsController (add/update/delete employee). Current server: departmentsController already calls stub; **when implementing Group 3,** add `invalidateEnterpriseCache(enterpriseId)` to every place that writes contacts (e.g. contactController add/update/delete contact, and any server.js contact save route if present).

### Invalidation call sites (other server)

- **Contact writes:** When a contact is added (main contact add + `/saveContact`), if `userData.enterpriseRef` exists, call `invalidateEnterpriseCache(enterpriseId)`. Do not fail the request if invalidation fails.
- **Employee changes:** addEmployee, updateEmployee, deleteEmployee (and unassign if it affects visibility)—call `invalidateEnterpriseCache(enterpriseId)`. Current server already has these calls (stub).

### Authorization

- Other server: **authenticateUser** only on all contact aggregation and cache routes. No role check. Match unless we consciously add restriction (see Questions).

### Contact document shape (contacts/{userId})

- `contactList`: array of objects. Fields seen in other server: name, surname, email, phone, company, position, website, linkedin, twitter, instagram, address, notes, tags, createdAt; also howWeMet, location in some paths. Use same shape when reading; support both Timestamp and _seconds for createdAt.

---

## Questions (could not be answered from scan)

Only these need a decision. Everything else is in "From scan" above.

| ID | Question | Context | Proposed (for discussion) | Decision |
|----|----------|---------|---------------------------|----------|
| G3-Q1 | Where should Group 3 routes live in the current server: same file as Group 2 (`departmentRoutes.js`) or a new router (e.g. `contactAggregationRoutes.js`) mounted alongside? | Group 2 uses departmentRoutes with full path prefix. Other server has contact aggregation on same enterprise router. | Add to `departmentRoutes.js` so all enterprise-scoped APIs stay in one place. | |
| G3-Q2 | Cache management endpoints (getCacheStats, clearAllCache, invalidateAllDepartmentCaches, warmCacheForEnterprises, updateCacheConfig, getCacheConfig, getCacheAnalytics) are **global** in the other server (any authenticated user). Should they stay global, or be restricted (e.g. admin-only or require enterpriseId and same-enterprise check)? | Security and operational risk: any user could clear or warm cache. | Keep global for now to match other server; add restriction later if needed (e.g. admin-only). | |
| G3-Q3 | Keep cache in-memory only (match other server, lost on restart) or plan for a persistent cache (e.g. Redis) in a later phase? | In-memory is simple but not shared across instances. | In-memory only for Group 3; document "persistent cache later" if we ever run multiple instances or need durability. | |

---

## Summary

- **From scan:** All API shapes, paths, auth, cache behavior, invalidation call sites, and Firestore/contact doc details are above. Use them directly for implementation.
- **Open questions:** 3 (G3-Q1: route file; G3-Q2: global vs restricted cache endpoints; G3-Q3: in-memory vs persistent cache).
- After decisions: record in Decision column and implement; optionally track in a Group 3 implementation plan.

---

## Group 3 integration progress (placeholder)

- **Status:** Not started. Stub `contactAggregationController.js` (invalidateEnterpriseCache no-op) and call sites in departmentsController are in place.
- **Next:** Resolve G3-Q1–G3-Q3, then port `contactAggregationController.js` and routes from XS_Backend - Copy; add invalidation to contact write paths in current server (contactController, any server.js contact save).
