# E2E Testable Flow: Quote → Pay → Enterprise → Admin → Departments & Teams

This document describes the full end-to-end flow that is already wired up, and how to test it (including the new Group 2 department/team features).

---

## 1. Overview

| Step | What happens | Already wired? |
|------|----------------|----------------|
| 1 | User creates quote | ✅ `POST /api/enterprise/quote` |
| 2 | User pays (Paystack) | ✅ `POST /api/enterprise/payment/initialize` → redirect to Paystack |
| 3 | Callback creates enterprise + account | ✅ `GET /api/enterprise/payment/callback?ref=...` |
| 4 | System sends contact person an email | ✅ Welcome email with **Create Admin** + **Open app** links |
| 5 | User opens admin link and creates admin | ✅ `enterprise-registration.html` → `POST /AddUser` with `enterpriseId` |
| 6 | User is created (plan=enterprise, role=admin) | ✅ `addUser` with enterpriseId creates `users` + `enterprise/{eid}/users/{uid}` |
| 7 | User logs into enterprise app | ✅ `POST /SignIn` → use token for API |
| 8 | User does department/team actions | ✅ Group 2 routes under `/api/enterprise/:enterpriseId/...` |

---

## 2. Step-by-step (manual E2E)

### 2.1 Create quote

- **Request:** `POST /api/enterprise/quote`
- **Body (JSON):**
  ```json
  {
    "companyName": "E2E Test Company",
    "contactName": "Jane Admin",
    "contactEmail": "jane@example.com",
    "numberOfEmployees": 50,
    "currency": "ZAR"
  }
  ```
- **Response:** `201` with `quote.quoteId`. Save `quoteId` for the next step.

### 2.2 Initialize payment (user “pays”)

- **Request:** `POST /api/enterprise/payment/initialize`
- **Body:** `{ "quoteId": "<quoteId from 2.1>" }`
- **Response:** `200` with `paymentUrl`, `paymentReference`.  
  **Action:** Open `paymentUrl` in browser and complete Paystack payment (use test card if in test mode).

### 2.3 Callback (automatic after Paystack redirect)

- After payment, Paystack redirects to:  
  `GET /api/enterprise/payment/callback?ref=<paymentReference>`
- **Backend:** Creates enterprise doc, `enterprise_accounts` (or equivalent), marks quote as paid, sends **welcome email** to `contactEmail` (or `TEST_EMAIL` if set).

### 2.4 Email to contact person

- **Subject:** “Welcome to Enterprise Subscription - &lt;companyName&gt;”
- **Links in email:**
  - **Create Admin Account:**  
    `https://staging.xscard.co.za/enterprise-registration.html?enterpriseId=<enterpriseId>&enterpriseName=<companyName>`
  - **Open enterprise app:**  
    `https://staging.xscard.co.za` (or `enterpriseWebsiteUrl` from `enterpriseEmailService.js`)

`enterpriseId` is `ent_<quoteId>` (e.g. `ent_abc123`).

### 2.5 Create admin (user opens admin link)

- **Open:**  
  `https://staging.xscard.co.za/enterprise-registration.html?enterpriseId=ent_<quoteId>&enterpriseName=E2E%20Test%20Company`
- **Form:** First name, last name, email, password, accept terms.
- **Submit:** Form sends `POST /AddUser` with `enterpriseId` in body.
- **Backend:** Creates Firebase Auth user, `users/{uid}` with `plan: 'enterprise'`, `enterpriseRef`, `role: 'admin'`, and `enterprise/{enterpriseId}/users/{uid}`.

### 2.6 Log into enterprise app

- **Request:** `POST /SignIn`
- **Body:** `{ "email": "<admin email>", "password": "<password>" }`
- **Response:** Includes token (e.g. in body or header). Use this token as `Authorization: Bearer <token>` (or whatever the app expects) for all subsequent API calls.

### 2.7 Department & team actions (Group 2)

All requests below require **authentication** (`Authorization: Bearer <token>`).  
Base path: `/api/enterprise/:enterpriseId`.

| Action | Method | Path (relative to base) |
|--------|--------|--------------------------|
| List departments | GET | `/departments` |
| Create department | POST | `/departments` |
| Get department | GET | `/departments/:departmentId` |
| Update department | PUT | `/departments/:departmentId` |
| Delete department | DELETE | `/departments/:departmentId` |
| List department employees | GET | `/departments/:departmentId/employees` |
| Add employee | POST | `/departments/:departmentId/employees` |
| List teams | GET | `/departments/:departmentId/teams` |
| Create team | POST | `/departments/:departmentId/teams` |
| Get team | GET | `/departments/:departmentId/teams/:teamId` |
| Update team | PUT | `/departments/:departmentId/teams/:teamId` |
| Delete team | DELETE | `/departments/:departmentId/teams/:teamId` |
| Get team members | GET | `/departments/:departmentId/teams/:teamId/members` |
| Add employee to team | POST | `/departments/:departmentId/teams/:teamId/employees` |
| Remove employee from team | DELETE | `/departments/:departmentId/teams/:teamId/employees/:employeeId` |
| All enterprise employees | GET | `/employees` |
| All enterprise cards | GET | `/cards` |
| Export teams (CSV) | GET | `/departments/:departmentId/exports/teams` or `/exports/teams` |

**Example – create department then team:**

```http
POST /api/enterprise/ent_<quoteId>/departments
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Engineering", "description": "Tech team" }
```

Then:

```http
POST /api/enterprise/ent_<quoteId>/departments/<departmentId>/teams
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Backend", "description": "Backend squad" }
```

---

## 3. Quick test: departments/teams only (existing enterprise)

If you already have an enterprise and an admin user:

1. Set in `.env` or environment:
   - `E2E_ENTERPRISE_ID=ent_<yourQuoteId>`
   - `E2E_ADMIN_EMAIL=<admin email>`
   - `E2E_ADMIN_PASSWORD=<admin password>`
2. Run the Node script that:
   - Signs in with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
   - Uses `E2E_ENTERPRISE_ID` to call department and team endpoints (create department, create team, add employee, etc.)

See **Section 5** for the script name and usage.

---

## 4. Notes

- **Registration form API:** The registration page calls `POST /AddUser` (not `/api/users/AddUser`). Backend mounts user routes at `/`, so `/AddUser` is correct.
- **Welcome email recipient:** The welcome email is always sent to the quote’s **contact email** (the address entered when creating the quote).
- **Welcome email “Open Enterprise App” link:** The post-payment welcome email includes a link to the app (default `/contacts`). For E2E, set in backend `.env`: `ENTERPRISE_APP_URL=http://localhost:5173` so the link is `http://localhost:5173/contacts`. Leave unset or set to staging/prod for production.
- **Where does the system welcome email go?** It is sent to the quote’s **contact email** (the one you entered when creating the quote). Paystack emails (receipt, etc.) can go to a different address; the **XS Card welcome email** (Create Admin + Open App links) is from your backend and always goes to the contact person. Check the backend terminal after payment: you should see `📧 Sending welcome email to: <address>` and then either `✅ Welcome email sent to ...` or `⚠️ Welcome email failed ...`. If it fails, the log will show the reason (e.g. SMTP error).
- **Base URL:** Replace `https://staging.xscard.co.za` with your app’s base URL (e.g. `http://localhost:8383` for local backend).

---

## 5. Automated E2E script

Run the full-flow script (quote → init payment → instructions for payment + callback, then create admin → sign in → department/team API tests), or the “departments only” path with existing enterprise:

```bash
# From backend folder
node test-e2e-enterprise-full-flow.js
```

See the script’s header comments for required env vars and options (e.g. `E2E_ENTERPRISE_ID`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` for the shortcut run).
