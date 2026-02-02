# Enterprise Payment System - Frontend Integration Guide

**Last Updated:** 2025-01-27  
**Base URL:** `http://localhost:8383` (development) or your production URL  
**Authentication:** None required for enterprise endpoints (public)

---

## 📋 TABLE OF CONTENTS

1. [Complete Payment Flow Overview](#complete-payment-flow-overview)
2. [API Endpoints Reference](#api-endpoints-reference)
3. [Billing Endpoints (Authenticated)](#billing-endpoints-authenticated)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Frontend Integration Examples](#frontend-integration-examples)

---

## 🔄 COMPLETE PAYMENT FLOW OVERVIEW

### **User Journey Flow:**

```
1. Quote Generation (Phase 2)
   ↓
2. Payment Initialization (Phase 4)
   ↓
3. Paystack Payment Page (External)
   ↓
4. Payment Callback (Phase 5) - Auto redirect
   ↓
5. Account Created (Phase 5)
   ↓
6. Subscription Management (Phase 7) - Ongoing
   ↓
7. Webhooks (Phase 6) - Background processing
```

### **How Each Section Relates:**

1. **Quote Generation** → Creates a quote with pricing, stores in database
2. **Payment Initialization** → Uses quote to create Paystack subscription, returns payment URL
3. **Payment Callback** → Paystack redirects here after payment, creates enterprise account
4. **Webhooks** → Paystack sends events (payment success/failure, subscription changes)
5. **Subscription Management** → Frontend can check status, cancel, update employees

---

## 🌐 API ENDPOINTS REFERENCE

### **1. Quote Generation**

**Endpoint:** `POST /api/enterprise/quote`  
**Rate Limit:** 10 requests/hour per IP  
**Authentication:** None required

**Request:**
```json
{
  "companyName": "Acme Corp",
  "contactName": "John Doe",
  "contactEmail": "john@acme.com",
  "numberOfEmployees": 50,
  "currency": "ZAR"  // Optional: "ZAR" or "USD", defaults to "ZAR"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "quote": {
    "quoteId": "quote_1769413843504_nthapdug5",
    "companyName": "Acme Corp",
    "contactName": "John Doe",
    "contactEmail": "john@acme.com",
    "numberOfEmployees": 50,
    "calculatedPrice": 60000,        // Price in cents (R600.00)
    "formattedPrice": "R 600.00",    // Formatted for display
    "currency": "ZAR",
    "quoteStatus": "pending",
    "subscriptionType": "yearly",
    "createdAt": "2025-01-27T10:30:00.000Z",
    "expiresAt": "2025-02-26T10:30:00.000Z"  // 30 days from creation
  }
}
```

**Error Responses:**
- **400** - Validation failed
  ```json
  {
    "success": false,
    "error": "Validation failed",
    "errors": ["Company name is required", "Invalid email format"]
  }
  ```
- **429** - Rate limit exceeded
  ```json
  {
    "success": false,
    "error": "Too many requests",
    "message": "Rate limit exceeded. Please try again later."
  }
  ```
- **500** - Server error

**Frontend Actions:**
- Before calling this endpoint, optionally check for existing active quotes by email (see **1.1 Active Quotes Lookup by Email** below)
- Store `quoteId` for next step
- Display `formattedPrice` to user
- Show expiration date (`expiresAt`)
- Handle rate limiting (show message, disable button)

---

### **1.1 Active Quotes Lookup by Email**

**Purpose:**  
When a user enters a business email and clicks **“Get a quote”**, the frontend should first check if there are any **non-expired** quotes for that `contactEmail`. If yes, the UI can:

- Inform the user: “You already have an active quote”
- Let the user open an existing quote in the preview modal (with QR + payment button)
- Still allow generating a **new** quote if they want

**Endpoint:** `GET /api/enterprise/quotes/by-email?email={contactEmail}`  
**Rate Limit:** Not rate-limited separately (use responsibly)  
**Authentication:** None required

**Request:**  
Query param:

```http
GET /api/enterprise/quotes/by-email?email=tshehlap@gmail.com
```

**Success Response (200) – with active quotes:**

```json
{
  "success": true,
  "quotes": [
    {
      "quoteId": "quote_1716981234567_abc123xyz",
      "companyName": "259 Moriting",
      "contactName": "Pule Tshetlha",
      "contactEmail": "tshehlap@gmail.com",
      "numberOfEmployees": 4321,
      "currency": "ZAR",
      "formattedPrice": "R 43,310.00",
      "priceRange": {
        "minEmployees": 201,
        "maxEmployees": 1000,
        "formattedMinPrice": "R 210.00",
        "formattedMaxPrice": "R 1,000.00"
      },
      "quoteStatus": "pending",
      "createdAt": "2025-01-27T10:30:00.000Z",
      "expiresAt": "2025-02-26T10:30:00.000Z",
      "paymentUrl": "https://paystack.com/pay/example"
    }
  ]
}
```

- `quotes` will contain **only non-expired** quotes (`now < expiresAt`)
- Quotes are sorted by `createdAt` descending (most recent first)
- `priceRange` is included only when the quote was created from a range input

**Success Response (200) – no active quotes:**  
Either no quotes for that email, or all quotes are expired.

```json
{
  "success": true,
  "quotes": []
}
```

**Error Responses:**

- **400** - Validation failed (missing or invalid email)
  ```json
  {
    "success": false,
    "error": "Validation failed",
    "message": "email query parameter is required"
  }
  ```
  or
  ```json
  {
    "success": false,
    "error": "Validation failed",
    "message": "email must be a valid email address"
  }
  ```

- **500** - Server error
  ```json
  {
    "success": false,
    "error": "Internal server error",
    "message": "Failed to look up quotes. Please try again later."
  }
  ```

**Frontend Actions:**

- Call this endpoint **before** `POST /api/enterprise/quote` when the user submits the quote form
- If `quotes.length > 0`:
  - Show a banner/message: “You already have an active quote for this email”
  - Use `quotes[0]` (most recent) by default in the quote preview modal
    - Display `formattedPrice`, `expiresAt`, `quoteStatus`, and `paymentUrl`
    - If `paymentUrl` is present, show a **“Proceed to Payment”** button that redirects to Paystack
  - Still allow user to click “Generate new quote” to call the quote generation endpoint
- If `quotes.length === 0`:
  - Proceed with normal quote generation via `POST /api/enterprise/quote`

**Example (pseudo-code):**

```javascript
async function handleGetQuote(formData) {
  const email = formData.contactEmail;

  // 1. Check for existing active quotes
  const res = await fetch(
    `/api/enterprise/quotes/by-email?email=${encodeURIComponent(email)}`
  );
  const data = await res.json();

  if (data.success && data.quotes.length > 0) {
    const activeQuote = data.quotes[0]; // most recent

    showActiveQuoteModal(activeQuote, {
      onProceedToPayment: () => {
        if (activeQuote.paymentUrl) {
          window.location.href = activeQuote.paymentUrl;
        } else {
          // Fallback: initialize payment via /api/enterprise/payment/initialize
          initializePayment(activeQuote.quoteId);
        }
      },
      onGenerateNewQuote: () => generateQuote(formData)
    });

    return;
  }

  // 2. No active quotes → generate a new quote
  await generateQuote(formData);
}
```

---

### **2. Public Payment Entry URL (Recommended Flow)**

> **Important:** For QR codes, PDFs, and the main “Proceed to Payment” flow, the frontend should **not** call `POST /api/enterprise/payment/initialize` directly. Instead, it should always use the public payment entry URL described here.

**Endpoint:** `GET /pay/quote/:quoteId`  
**Authentication:** None required  
**Usage:**  
- QR codes in the quote PDF and on-screen preview  
- Clickable link under the QR  
- “Proceed to Payment” button in the modal footer  

**URL Construction (frontend):**

```ts
const getQuotePaymentEntryUrl = (quoteId: string): string => {
  return `${API_BASE_URL}/pay/quote/${encodeURIComponent(quoteId)}`;
};
```

- In development: `http://localhost:8383/pay/quote/:quoteId`
- In production: `https://your-backend-domain/pay/quote/:quoteId`

**Behaviour (server-side):**
1. Lookup quote by `quoteId`.
2. Validate:
   - If quote does not exist → show friendly “Quote not found” HTML page.
   - If quote is expired → show friendly “Quote expired” HTML page.
3. If `quoteStatus === "paid"` → show “Payment already completed” HTML page (no redirect to Paystack).
4. If quote has a stored `paymentUrl` and status is payable (`"pending"` or `"accepted"`):
   - Redirect (302) to that `paymentUrl` (Paystack checkout page).
5. If quote is `"pending"` and has no `paymentUrl` yet:
   - Server-side initializes payment (using existing Phase 4 logic):
     - Creates/reuses Paystack plan.
     - Calls `/transaction/initialize` on Paystack.
     - Updates quote with `paymentReference`, `paymentUrl`, `planCode`, and status `"accepted"`.
   - Then redirects the browser (302) to the new `paymentUrl`.

**Frontend Actions:**
- After a quote is generated (or loaded from “active quotes by email”):
  - Compute `entryUrl = getQuotePaymentEntryUrl(quote.quoteId)`.
  - Use `entryUrl` as:
    - The URL encoded into the QR code.
    - The visible URL under the QR (“Open payment page” link).
    - The link target for the clickable area in the generated PDF.
    - The target for the “Proceed to Payment” button:

      ```ts
      const entryUrl = getQuotePaymentEntryUrl(enterpriseQuote.quoteId);
      window.open(entryUrl, '_blank', 'noopener,noreferrer');
      ```

**Example Usage in Frontend (pseudo-code):**

```ts
// After quote generation
const quote = data.quote;

// 1. Build payment entry URL
const entryUrl = getQuotePaymentEntryUrl(quote.quoteId);

// 2. Generate QR from entryUrl
generateQrCode(entryUrl);

// 3. Use entryUrl for link under QR and PDF overlay
renderPaymentLink(entryUrl);

// 4. “Proceed to Payment” button
function onProceedToPayment() {
  window.open(entryUrl, '_blank', 'noopener,noreferrer');
}
```

> The frontend does **not** need to know the underlying Paystack `paymentUrl` or call `POST /api/enterprise/payment/initialize` for the user-facing flow. The backend owns all payment initialization and redirect logic behind `/pay/quote/:quoteId`.

---

### **2.1 (Optional) Direct Payment Initialization API**

> **Note:** This endpoint is primarily for internal use or advanced clients. For the standard browser/QR/PDF flow, prefer the public payment entry URL (`GET /pay/quote/:quoteId`).

**Endpoint:** `POST /api/enterprise/payment/initialize`  
**Rate Limit:** 5 requests/hour per quote  
**Authentication:** None required

**Request:**
```json
{
  "quoteId": "quote_1769413843504_nthapdug5"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://paystack.com/pay/ent_quote_...",
  "paymentReference": "ent_quote_quote_1769413843504_nthapdug5_1769414000234_fnr6rkn32",
  "quoteId": "quote_1769413843504_nthapdug5",
  "amount": 60000,
  "currency": "ZAR",
  "planCode": "PLN_4sa2jlinoluho2g",
  "subscriptionType": "yearly"
}
```

**Error Responses:**
- **400** - Validation failed or quote issues
  ```json
  {
    "success": false,
    "error": "Quote expired",
    "message": "This quote has expired. Please generate a new quote."
  }
  ```
- **404** - Quote not found  
- **429** - Rate limit exceeded  
- **500** - Server error

**Frontend Actions (if you choose to use it):**
- Typically **not needed** in the normal browser flow.
- If used by a backend service or admin tool:
  - Call it with a known `quoteId`.
  - Redirect or display `paymentUrl` as appropriate.

---

### **3. Payment Callback** (Server-Side Redirect)

**Endpoint:** `GET /api/enterprise/payment/callback?ref={paymentReference}`  
**Authentication:** None required  
**Note:** This is called by Paystack after payment, not directly by frontend

**Flow:**
1. User completes payment on Paystack
2. Paystack redirects to: `/api/enterprise/payment/callback?ref={paymentReference}`
3. Server verifies payment, creates account
4. Server redirects to success/failure page

**Redirect URLs:**
- **Success:** `/enterprise-payment-success.html?quoteId={quoteId}&enterpriseId={enterpriseId}`
- **Failure:** `/enterprise-payment-failure.html?error={errorCode}&ref={paymentReference}`

**Frontend Actions:**
- Create success/failure pages at these URLs
- Success page should display enterprise account details
- Failure page should show error message and allow retry

---

### **4. Subscription Status**

**Endpoint:** `GET /api/enterprise/subscription/:enterpriseId/status`  
**Rate Limit:** None (but use responsibly)  
**Authentication:** None required

**Request:**
- URL Parameter: `enterpriseId` (e.g., `ent_quote_1769413843504_nthapdug5`)

**Success Response (200):**
```json
{
  "success": true,
  "subscription": {
    "status": "active",                    // Paystack status: "active", "cancelled", "non-renewing"
    "accountStatus": "active",             // Our status: "active", "suspended"
    "nextBillingDate": "2026-01-27T10:30:00.000Z",
    "lastBillingDate": "2025-01-27T10:30:00.000Z",
    "subscriptionEndDate": "2026-01-27T10:30:00.000Z",
    "amount": 60000,                       // Price in cents
    "currency": "ZAR",
    "numberOfEmployees": 50,
    "isActive": true,                      // true if accountStatus="active" and subscription is active/non-renewing
    "warningBanner": {                     // Grace period warnings
      "show": false,
      "message": "",
      "severity": "info",                  // "info", "warning", "error"
      "actionRequired": false,
      "actionUrl": ""
    }
  }
}
```

**Warning Banner Examples:**
```json
// Grace period active (payment failed, 7 days grace)
{
  "show": true,
  "message": "Payment failed. Your account will be suspended in 3 days if payment is not received.",
  "severity": "warning",
  "actionRequired": true,
  "actionUrl": "/update-payment-method"
}

// Account suspended
{
  "show": true,
  "message": "Your account has been suspended due to payment failure.",
  "severity": "error",
  "actionRequired": true,
  "actionUrl": "/reactivate-subscription"
}
```

**Error Responses:**
- **400** - Missing enterpriseId
- **404** - Account not found
- **500** - Server error

**Frontend Actions:**
- Display subscription status dashboard
- Show warning banners when `warningBanner.show === true`
- Display next billing date
- Show account status (active/suspended)
- Handle grace period warnings

---

### **5. Cancel Subscription**

**Endpoint:** `POST /api/enterprise/subscription/:enterpriseId/cancel`  
**Rate Limit:** None  
**Authentication:** None required

**Request:**
- URL Parameter: `enterpriseId`
- Body: `{}` (empty object)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription cancelled. Account active until 1/27/2026.",
  "subscriptionEndDate": "2026-01-27T10:30:00.000Z"
}
```

**Error Responses:**
- **400** - Already cancelled or missing enterpriseId
- **404** - Account not found
- **500** - Server error

**Frontend Actions:**
- Show confirmation dialog before cancelling
- Display message to user
- Show subscription end date
- Update UI to reflect cancelled status

---

### **6. Update Employee Count**

**Endpoint:** `POST /api/enterprise/subscription/:enterpriseId/update-employees`  
**Rate Limit:** None  
**Authentication:** None required

**Request:**
- URL Parameter: `enterpriseId`
- Body:
```json
{
  "newNumberOfEmployees": 75
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Employee count updated. New price will take effect on next renewal.",
  "nextRenewalDate": "2026-01-27T10:30:00.000Z",
  "newPrice": 85000,                    // New price in cents
  "newNumberOfEmployees": 75
}
```

**Error Responses:**
- **400** - Validation failed (invalid count, same count, missing enterpriseId)
- **404** - Account not found
- **500** - Server error

**Frontend Actions:**
- Show new price preview before updating
- Display message that change takes effect on next renewal
- Update UI with new employee count
- Show next renewal date

---

### **7. Health Check**

**Endpoint:** `GET /api/enterprise/health`  
**Rate Limit:** None  
**Authentication:** None required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Enterprise routes module loaded successfully",
  "phase": 7
}
```

**Frontend Actions:**
- Use for connectivity checks
- Verify API is available before making requests

---

## 💰 PRICING INFORMATION

### **Pricing Formula:**
```
Total Price = Base Price + (Number of Employees × Price Per Employee)
```

### **Pricing by Currency:**

**ZAR (South African Rand):**
- Base Price: R100.00 (10,000 cents)
- Per Employee: R10.00 (1,000 cents)
- Example: 50 employees = R100 + (50 × R10) = R600.00 (60,000 cents)

**USD (US Dollar):**
- Base Price: $5.00 (500 cents)
- Per Employee: $0.50 (50 cents)
- Example: 50 employees = $5 + (50 × $0.50) = $30.00 (3,000 cents)

### **Important Notes:**
- All prices are returned in **cents** (not dollars/rands)
- Use `formattedPrice` from quote response for display
- Divide by 100 to convert cents to currency units
- Employee count range: 1-10,000

---

## ⚠️ ERROR HANDLING

### **Common Error Status Codes:**

**400 - Bad Request:**
- Validation errors (missing/invalid fields)
- Quote expired
- Quote already paid
- Invalid employee count
- Same employee count (for updates)

**404 - Not Found:**
- Quote not found
- Account not found

**429 - Too Many Requests:**
- Rate limit exceeded
- Retry after the rate limit window expires

**500 - Internal Server Error:**
- Database errors
- Paystack API errors
- Unexpected server errors

### **Error Response Format:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "errors": ["Detailed error 1", "Detailed error 2"]  // For validation errors
}
```

### **Frontend Error Handling:**
1. Check `success` field first
2. Display `message` to user
3. For validation errors, show `errors` array
4. Handle rate limits (disable button, show countdown)
5. Retry logic for 500 errors (with exponential backoff)

---

## 🔗 HOW ENDPOINTS RELATE TO EACH OTHER

### **Complete Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND USER JOURNEY                     │
└─────────────────────────────────────────────────────────────┘

1. QUOTE GENERATION
   POST /api/enterprise/quote
   ↓ Returns: quoteId, calculatedPrice, formattedPrice
   ↓
   [User reviews quote, sees price]
   ↓

2. PAYMENT INITIALIZATION
   POST /api/enterprise/payment/initialize
   ↓ Uses: quoteId
   ↓ Returns: paymentUrl, paymentReference
   ↓
   [Redirect user to paymentUrl - Paystack page]
   ↓

3. PAYSTACK PAYMENT PAGE (External)
   [User enters payment details, completes payment]
   ↓

4. PAYMENT CALLBACK (Automatic)
   GET /api/enterprise/payment/callback?ref={paymentReference}
   ↓ Server-side: Verifies payment, creates account
   ↓ Redirects to: /enterprise-payment-success.html
   ↓
   [Frontend success page shows enterpriseId]
   ↓

5. ONGOING MANAGEMENT
   GET /api/enterprise/subscription/:enterpriseId/status
   ↓ Returns: subscription status, warning banners
   ↓
   [Frontend displays dashboard]
   ↓
   POST /api/enterprise/subscription/:enterpriseId/cancel
   POST /api/enterprise/subscription/:enterpriseId/update-employees
   ↓
   [User manages subscription]
```

### **Data Flow:**

```
Quote (Phase 2)
  ├─ quoteId → Used in Payment Init (Phase 4)
  ├─ calculatedPrice → Used to create Paystack plan
  └─ currency → Used for pricing

Payment Init (Phase 4)
  ├─ paymentUrl → Redirect user to Paystack
  ├─ paymentReference → Used in callback
  └─ planCode → Paystack plan code

Payment Callback (Phase 5)
  ├─ paymentReference → Verifies payment
  ├─ Creates enterprise account
  └─ enterpriseId → Used for all management endpoints

Subscription Status (Phase 7)
  ├─ enterpriseId → Identifies account
  ├─ Syncs with Paystack → Gets latest status
  └─ warningBanner → Shows grace period/suspension warnings

Webhooks (Phase 6) - Background
  ├─ Payment success → Updates account, clears grace period
  ├─ Payment failed → Sets grace period, shows warning
  └─ Subscription cancelled → Updates status
```

---

## 📱 FRONTEND INTEGRATION EXAMPLES

### **Example 1: Generate Quote**

```javascript
async function generateQuote(formData) {
  try {
    const response = await fetch('http://localhost:8383/api/enterprise/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyName: formData.companyName,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        numberOfEmployees: parseInt(formData.numberOfEmployees),
        currency: formData.currency || 'ZAR'
      })
    });

    const data = await response.json();

    if (data.success) {
      // Store quoteId for next step
      localStorage.setItem('quoteId', data.quote.quoteId);
      
      // Display quote to user
      showQuoteSummary({
        price: data.quote.formattedPrice,
        employees: data.quote.numberOfEmployees,
        expiresAt: data.quote.expiresAt
      });
      
      return data.quote;
    } else {
      // Handle errors
      showErrors(data.errors || [data.message]);
      return null;
    }
  } catch (error) {
    console.error('Quote generation failed:', error);
    showError('Failed to generate quote. Please try again.');
    return null;
  }
}
```

### **Example 2: Initialize Payment**

```javascript
async function initializePayment(quoteId) {
  try {
    const response = await fetch('http://localhost:8383/api/enterprise/payment/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quoteId })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to Paystack payment page
      window.location.href = data.paymentUrl;
    } else {
      if (data.error === 'Quote expired') {
        // Show message and allow new quote
        showError('Quote expired. Please generate a new quote.');
        // Optionally auto-generate new quote
      } else {
        showError(data.message || 'Failed to initialize payment.');
      }
    }
  } catch (error) {
    console.error('Payment initialization failed:', error);
    showError('Failed to initialize payment. Please try again.');
  }
}
```

### **Example 3: Check Subscription Status**

```javascript
async function getSubscriptionStatus(enterpriseId) {
  try {
    const response = await fetch(
      `http://localhost:8383/api/enterprise/subscription/${enterpriseId}/status`
    );

    const data = await response.json();

    if (data.success) {
      const subscription = data.subscription;
      
      // Display status
      updateStatusDisplay({
        status: subscription.status,
        accountStatus: subscription.accountStatus,
        isActive: subscription.isActive,
        nextBillingDate: subscription.nextBillingDate,
        numberOfEmployees: subscription.numberOfEmployees
      });

      // Show warning banner if needed
      if (subscription.warningBanner.show) {
        showWarningBanner({
          message: subscription.warningBanner.message,
          severity: subscription.warningBanner.severity,
          actionRequired: subscription.warningBanner.actionRequired,
          actionUrl: subscription.warningBanner.actionUrl
        });
      }

      return subscription;
    } else {
      if (response.status === 404) {
        showError('Account not found.');
      } else {
        showError(data.message || 'Failed to fetch subscription status.');
      }
      return null;
    }
  } catch (error) {
    console.error('Status check failed:', error);
    showError('Failed to check subscription status.');
    return null;
  }
}
```

### **Example 4: Cancel Subscription**

```javascript
async function cancelSubscription(enterpriseId) {
  // Show confirmation first
  const confirmed = await showConfirmDialog(
    'Are you sure you want to cancel your subscription?'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `http://localhost:8383/api/enterprise/subscription/${enterpriseId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      }
    );

    const data = await response.json();

    if (data.success) {
      showSuccess(data.message);
      // Update UI to show cancelled status
      updateSubscriptionStatus('cancelled', data.subscriptionEndDate);
    } else {
      if (data.error === 'Already cancelled') {
        showInfo('Subscription is already cancelled.');
      } else {
        showError(data.message || 'Failed to cancel subscription.');
      }
    }
  } catch (error) {
    console.error('Cancellation failed:', error);
    showError('Failed to cancel subscription. Please try again.');
  }
}
```

### **Example 5: Update Employee Count**

```javascript
async function updateEmployeeCount(enterpriseId, newCount) {
  // Calculate and show price preview first
  const previewPrice = calculatePrice(newCount, currentCurrency);
  const confirmed = await showConfirmDialog(
    `Update to ${newCount} employees? New price: ${previewPrice}. Change takes effect on next renewal.`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `http://localhost:8383/api/enterprise/subscription/${enterpriseId}/update-employees`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newNumberOfEmployees: parseInt(newCount)
        })
      }
    );

    const data = await response.json();

    if (data.success) {
      showSuccess(data.message);
      // Update UI
      updateEmployeeDisplay(data.newNumberOfEmployees, data.newPrice);
      showNextRenewalDate(data.nextRenewalDate);
    } else {
      if (data.error === 'No change') {
        showInfo('Employee count is already set to this value.');
      } else {
        showError(data.message || 'Failed to update employee count.');
      }
    }
  } catch (error) {
    console.error('Update failed:', error);
    showError('Failed to update employee count. Please try again.');
  }
}
```

---

## 🎯 KEY INTEGRATION POINTS

### **1. Quote Flow**
- Generate quote → Store `quoteId` → Show price → Proceed to payment

### **2. Payment Flow**
- Initialize payment → Redirect to `paymentUrl` → Handle callback redirect

### **3. Status Monitoring**
- Poll or refresh subscription status → Display dashboard → Show warnings

### **4. Management Actions**
- Cancel subscription → Show confirmation → Update UI
- Update employees → Show price preview → Confirm → Update UI

---

## 📊 RESPONSE FIELD REFERENCE

### **Quote Response Fields:**
- `quoteId` - Unique identifier, store for payment initialization
- `calculatedPrice` - Price in cents (divide by 100 for display)
- `formattedPrice` - Pre-formatted string (e.g., "R 600.00")
- `expiresAt` - ISO timestamp, quote valid for 30 days

### **Payment Init Response Fields:**
- `paymentUrl` - Redirect user here for payment
- `paymentReference` - Optional tracking ID
- `amount` - Price in cents
- `planCode` - Paystack plan code (for reference)

### **Subscription Status Fields:**
- `status` - Paystack subscription status
- `accountStatus` - Our account status (active/suspended)
- `isActive` - Combined active check
- `warningBanner` - Grace period/suspension warnings
- `nextBillingDate` - Next payment date
- `subscriptionEndDate` - When subscription ends

---

## 🔐 SECURITY NOTES

1. **No Authentication Required** - Enterprise endpoints are public
2. **Rate Limiting** - Quote generation: 10/hour, Payment init: 5/hour per quote
3. **Validation** - All inputs validated server-side
4. **Webhooks** - Secured with HMAC-SHA512 signatures (server-side only)

---

## 🚀 PRODUCTION CONSIDERATIONS

1. **Update Base URL** - Change from `localhost:8383` to production URL
2. **Error Monitoring** - Log all API errors
3. **Retry Logic** - Implement for 500 errors
4. **Rate Limit Handling** - Show user-friendly messages
5. **Loading States** - Show spinners during API calls
6. **Success/Failure Pages** - Create pages for payment callback redirects

---

**Happy Integrating! 🎉**

