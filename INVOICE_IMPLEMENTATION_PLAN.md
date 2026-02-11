## Invoice & Receipt Implementation Plan

**Status**: Design & planning complete – ready for implementation  
**Scope**: End‑to‑end flow from quote → payment → receipt, plus recurring invoices  

---

## 1. Objectives

- **Receipts**  
  - Automatically generate a **receipt document + PDF** when a quote payment completes (Paystack webhook).  
  - Auto‑email the receipt PDF to the customer.

- **Invoices**  
  - For recurring enterprise billing, generate **invoices** (unpaid, `isReceipt: false`).  
  - Allow download of invoice PDF and “send invoice to my email” on demand (no auto‑email).

- **Storage & PDFs**  
  - Store all invoices and receipts in the **single** `enterprise_invoices` collection (with `isReceipt` flag).  
  - Use the existing **invoice/receipt PDF generator** (`generateInvoicePDF`) and **quote PDF generator** (`generateQuotePDF`).

---

## 2. Invariants & Existing Building Blocks

These are considered done and **not in scope** to redesign unless bugs are found:

- **Data model & schemas**
  - `enterprise_quotes` and `enterprise_invoices` structures in `INVOICE_RECEIPT_DATA_MODEL.md`.
  - `ENTERPRISE_QUOTES_SCHEMA` and `ENTERPRISE_INVOICES_SCHEMA` in `backend/schemas/enterpriseCollections.js`.

- **Validation**
  - `billingAddress` (required) and `vatNumber` (optional) validation in `backend/utils/enterpriseValidation.js`.

- **Company information**
  - `backend/utils/companyInfo.js` with:
    - `getCompanyInfo()` – reads from `.env`.
    - `getFormattedCompanyAddress()` – formatted address string.

- **PDF generators**
  - `generateQuotePDF(quote, baseUrl)` – quote PDFs (already tuned to match frontend).
  - `generateInvoicePDF(invoice)` – invoice/receipt PDFs (matches sample receipt layout, includes logo space).

---

## 3. Phase 1 – Number Generators & Cycle Fields

### 3.1 `getNextInvoiceSequence(year)`

- **Purpose**: Provide the next integer `sequence` for a given `year`, atomically.
- **Storage**:
  - Collection: `invoice_counters`
  - Document ID: `<year>` (e.g. `"2026"`)
  - Fields: `{ sequence: number }`
- **Behavior**:
  - Use a **Firestore transaction**:
    - If doc does not exist → create with `{ sequence: 1 }`.
    - Else → increment `sequence` and return the new value.

### 3.2 `generateInvoiceNumber()`

- **Format**: `INV-{year}-{NNNN}`, e.g. `INV-2026-0001`.
- **Behavior**:
  - `year = new Date().getFullYear()`.
  - `sequence = await getNextInvoiceSequence(year)`.
  - Return `INV-${year}-${String(sequence).padStart(4, '0')}`.

### 3.3 `generateReceiptNumber()`

- **Goal**: Collision‑free, no strict business format required (receipt number is not the primary key).
- **Initial simple format**:
  - `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
- Can be refined later without changing the core flow.

### 3.4 Cycle Fields

- **Fields**:
  - `billingCycleStart: Timestamp`
  - `billingCycleEnd: Timestamp | null` (optional)
- **Initial behavior**:
  - For receipts generated from quotes:
    - `billingCycleStart = quote.createdAt`
    - `billingCycleEnd = null`
  - Rendered in the receipt PDF as:  
    `Cycle: {formatDate(billingCycleStart)} --`

---

## 4. Phase 2 – Receipt Flow

Phase 2 is split into two concrete sub‑phases:

- **Phase 2A – Core helpers (pure utils)**  
  Implement reusable utilities that can be called from any payment entry point.
- **Phase 2B – Wiring into the existing payment callback**  
  Use the existing `handlePaymentCallback` flow as the trigger for generating receipts.

---

### 4.1 Phase 2A – Core Helpers (DONE)

#### 4.1.1 `extractPaymentMethodFromVerification(verificationResult)`

- **Input**: Result from `verifyEnterprisePayment(paymentReference)` in `enterprisePaymentUtils.js`.
- **Output**: `"Brand - last4"` or `null` if unavailable.
- **Logic**:
  - Read `verificationResult.transaction.authorization.brand` and `.last4`.
  - Normalize brand (capitalize first letter).
  - Example output: `"Visa - 4043"`.

#### 4.1.2 `generateReceiptFromQuote(quoteData, verificationResult)`

**Purpose**: Build and store a receipt in `enterprise_invoices`, generate its PDF, and trigger email.

**Inputs**:

- `quoteData` – quote document data from `enterprise_quotes`.
- `verificationResult` – object from `verifyEnterprisePayment(paymentReference)` (contains `transaction.authorization` etc.).

**High‑level behavior** (implemented in `backend/utils/invoiceReceiptUtils.js`):

1. Get `companyInfo` from `getCompanyInfo()`.
2. Build `billTo` from `quoteData` (`companyName`, `contactName`, `contactEmail`, `billingAddress`, `vatNumber`).
3. Build a single line item:
   - `"XSCard Enterprise License for {numberOfEmployees} employees - {subscriptionType} subscription"`.
4. Set pricing: `subtotal`, `tax = 0`, `total`, `amountPaid`, `currency`.
5. Set dates: `invoiceDate = quote.createdAt`, `datePaid = quote.paidAt || now`, plus cycle fields in metadata.
6. Set payment info: `paymentReference`, `paymentMethod = extractPaymentMethodFromVerification(verificationResult)`.
7. Generate identifiers:
   - `invoiceId = "inv_" + timestamp + "_" + random`
   - `invoiceNumber = await generateInvoiceNumber()`
   - `receiptNumber = generateReceiptNumber()`
   - `invoiceStatus = 'paid'`, `isReceipt = true`.
8. Write document to `enterprise_invoices`.
9. Generate PDF via `generateInvoicePDF(invoiceDoc)`.
10. Send receipt email (attachment) via `sendMailWithStatus`, and log errors with `logEnterpriseError` if email fails.

> **Status**: Phase 2A helpers are implemented.

---

### 4.2 Phase 2B – Wiring into Existing Payment Callback

Instead of introducing a brand‑new webhook endpoint immediately, we will first
wire receipt generation into the **existing Paystack payment callback**:

- **Entry point**: `handlePaymentCallback` in `backend/controllers/enterpriseController.js`
- **Trigger**: After:
  - Payment is verified, and
  - The enterprise account is successfully created via `createEnterpriseAccountWithRetry`.

**Steps**:

1. **Import helpers**
   - Import `generateReceiptFromQuote` from `backend/utils/invoiceReceiptUtils.js`.

2. **After successful account creation**
   - In `handlePaymentCallback`, once:
     - `createEnterpriseAccountWithRetry(accountData, quoteRef, quoteData)` resolves, and
     - audit logging + welcome email sending are done,
   - Call:
     - `await generateReceiptFromQuote(quoteDataWithPaidAt, verificationResult)`
   - Where `quoteDataWithPaidAt` is `quoteData` cloned with `paidAt` set to `now` if not already defined.

3. **Idempotency**
   - `handlePaymentCallback` already checks `if (quoteData.quoteStatus === 'paid')` and exits early, so:
     - We only call `generateReceiptFromQuote` in the **first successful** callback.
   - Future enhancement: before creating a new receipt, optionally query `enterprise_invoices` for an existing document with `quoteId = quote.quoteId` and skip creation if found.

4. **Error handling**
   - Wrap `generateReceiptFromQuote` in a `try/catch`:
     - On failure:
       - Log a warning and rely on `generateReceiptFromQuote`’s internal `logEnterpriseError` calls.
       - **Do not** block the user redirect to the success page (receipt failures should not break access).

5. **Future Webhook Support (optional)**
   - Once the callback‑based wiring is stable, we can add a dedicated
     `POST /webhooks/paystack` endpoint that:
       - Verifies signatures,
       - Finds the quote,
       - Calls the same `generateReceiptFromQuote` helper.
   - This would be a later sub‑phase (2C) if needed; it is not required for the initial production rollout.

---

## 5. Phase 3 – Invoice Generation from Enterprise Account

### 5.1 `generateInvoiceFromAccount(account)`

**When called**: From scheduled job / Cloud Function when `account.nextBillingDate <= now`.

**Inputs**:

- `account` with:
  - `enterpriseId`
  - `companyName`, `contactName`, `contactEmail`
  - `billingAddress`
  - `vatNumber` (customer VAT)
  - `numberOfEmployees`
  - `currency`

**Steps**:

1. **Build `billTo`** from account (same structure as receipts).
2. **Calculate price** using existing enterprise pricing logic:
   - `priceInCents = calculatePrice(account.numberOfEmployees, account.currency)`
3. **Line item**:
   - Description: `XSCard Enterprise License for {account.numberOfEmployees} employees - Renewal`
   - Quantity: `1`
   - Unit price & amount: `priceInCents`
4. **Pricing**:
   - `subtotal = priceInCents`
   - `tax = 0`
   - `total = priceInCents`
   - `amountPaid = 0` (unpaid invoice)
5. **Dates**:
   - `invoiceDate = now`
   - `dueDate = addDays(now, 30)`
6. **Identifiers & status**:
   - `invoiceId = "inv_" + timestamp + "_" + randomString`
   - `invoiceNumber = await generateInvoiceNumber()`
   - `isReceipt = false`
   - `invoiceStatus = 'sent'`
   - `enterpriseId = account.enterpriseId`
7. **Write `enterprise_invoices` doc**
   - Include `metadata.subscriptionType`, `metadata.numberOfEmployees`, cycle info if available.
8. **PDF & email**:
   - Generate PDF via `generateInvoicePDF(invoiceDocData)`.
   - **Do not auto‑email** (per requirements).  
     - PDF is accessible via download + “email me” endpoints.

---

## 6. Phase 4 – API Endpoints

### 6.1 Get Invoice/Receipt JSON

- **Route**: `GET /api/enterprise/invoices/:invoiceId`
- **Behavior**:
  - Auth: enterprise‑level auth (similar to quote access).
  - Fetch `enterprise_invoices/:invoiceId`.
  - 404 if not found or not owned by this enterprise.
  - Return invoice/receipt JSON (may omit internal metadata if needed).

### 6.2 Download Invoice/Receipt PDF

- **Route**: `GET /api/enterprise/invoices/:invoiceId/pdf`
- **Behavior**:
  - Auth: same as above.
  - Fetch invoice/receipt doc.
  - Call `generateInvoicePDF(docData)`.
  - Response headers:
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename=\"XS_Card_${doc.isReceipt ? 'Receipt' : 'Invoice'}_${doc.invoiceNumber || doc.receiptNumber}_${date}.pdf\"`

### 6.3 Send Invoice Email (On Demand)

- **Route**: `POST /api/enterprise/invoices/:invoiceId/email`
- **Body** (optional): `{ toEmail?: string }`
- **Behavior**:
  - Auth: enterprise.
  - Fetch invoice doc.
  - Determine `to`:
    - Provided `toEmail` OR `doc.billTo.contactEmail`.
  - Generate PDF (`generateInvoicePDF`) or reuse stored link.
  - Use existing email service to send:
    - Subject: `"Your XSCard Invoice ${invoiceNumber}"`
    - Attach PDF or include link.

---

## 7. Phase 5 – Frontend Integration (High Level)

> Note: Implementation is primarily backend, but these expectations guide API design.

- **Quotes / Payment success flow**
  - After payment, the backend webhook:
    - Marks quote as paid.
    - Creates receipt.
    - Emails receipt automatically.
  - UI can simply show a success message; no need to directly generate the PDF on the frontend.

- **Billing / Invoices screen**
  - List documents from `enterprise_invoices` filtered by `enterpriseId`.
  - Show:
    - `invoiceNumber` / `receiptNumber`
    - `invoiceStatus`
    - `isReceipt` (tag as “Invoice” vs “Receipt”)
    - `invoiceDate` / `datePaid` / `dueDate`
  - Actions:
    - “Download PDF” → `GET /api/enterprise/invoices/:invoiceId/pdf`
    - “Email me this invoice” → `POST /api/enterprise/invoices/:invoiceId/email`

---

## 8. Phase 6 – Observability, Safety & Edge Cases

- **Logging**
  - Webhook:
    - Log payment events (reference, amount, quoteId).
    - Log when receipts are created.
    - Log email success/failure.
  - Invoice generation (cron):
    - Log invoices created and any failures.

- **Idempotency**
  - Webhook:
    - If quote already `paidAt` and a receipt exists for that `quoteId`, treat as **already processed**.
  - Invoice generation:
    - Ensure only one invoice per billing period (e.g. track `lastInvoicedAt` on the account).

- **Failure modes**
  - If PDF generation fails:
    - Still record the receipt/invoice in Firestore.
    - Log and alert; email can be retried later.
  - If email fails:
    - Do **not** roll back the receipt.
    - Log failure; allow resend via `/invoices/:id/email`.

---

## 9. Implementation Order Checklist

1. **Number generators**
   - [ ] `invoice_counters` collection + `getNextInvoiceSequence(year)`
   - [ ] `generateInvoiceNumber()`
   - [ ] `generateReceiptNumber()`

2. **Receipt flow**
   - [ ] Paystack webhook handler (verify + find quote + update quote).
   - [ ] `extractPaymentMethod(paystackTx)`
   - [ ] `generateReceiptFromQuote(quote, paystackTx)`

3. **Invoice flow (renewals)**
   - [ ] `generateInvoiceFromAccount(account)`
   - [ ] Hook into cron/Cloud Function (when ready).

4. **API endpoints**
   - [ ] `GET /api/enterprise/invoices/:invoiceId`
   - [ ] `GET /api/enterprise/invoices/:invoiceId/pdf`
   - [ ] `POST /api/enterprise/invoices/:invoiceId/email`

5. **Frontend integration**
   - [ ] Use new endpoints in billing UI.
   - [ ] Remove any remaining frontend PDF generation for invoices/receipts (quotes already moved to backend).

