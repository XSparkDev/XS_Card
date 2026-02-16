# Firestore rules – deferred (Group 2)

**Context:** We are shipping Group 2 (departments, teams, employees) to public without implementing Firestore security rules. This doc lists every path where rules **will be needed** when we implement them retroactively. No need to remember—it’s all here.

---

## Goal when we implement

Only authenticated users who belong to the **same enterprise** can read/write these paths (so Enterprise A cannot access Enterprise B’s org data). Implement in Firebase `firestore.rules` and document where rules live.

---

## Paths that need rules

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

**Note:** If clients never hit Firestore directly (only the Node API does), rules can deny all client access and rely on server (Admin SDK); the list above still marks what to lock down for consistency or future direct access.

---

## Group 2 implementation status (as of this doc)

**Is this phase complete?** **Yes.** Implementation is complete for public launch.

- **Done:** Routes and controllers (departments, teams, employees, export); H2 (stats counts); L1 (pagination); welcome email and registration redirect; enterprise/users creation; no invite flow (addEmployee only).
- **Deferred (post-launch):** J1 (Firestore rules—use this doc when implementing), F4 (role matrix for who can CRUD departments/teams).
- **Optional before launch:** J2 (document composite indexes in e.g. `backend/firestore-indexes.md`). Not required to ship.

Source of decisions: `GROUP2_INTEGRATION_QUESTIONS.md`.
