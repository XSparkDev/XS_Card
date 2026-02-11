# Invoice/Receipt Data Model - Based on Cursor Receipt Structure

**Reference:** Cursor Receipt (Receipt-2736-3055 (2).pdf)  
**Date:** 2025-01-27  
**Status:** Proposal for Discussion

---

## Overview

This document proposes an invoice/receipt data model that **reuses quote data** while adding invoice-specific fields based on the Cursor receipt structure.

---

## Data Structure Comparison

### What We Can Reuse from Quotes ✅

| Quote Field | Invoice/Receipt Usage | Notes |
|------------|----------------------|-------|
| `companyName` | Bill To → Company Name | Direct reuse |
| `contactEmail` | Bill To → Email | Direct reuse |
| `contactName` | Bill To → Contact Person | Direct reuse |
| `calculatedPrice` | Line Items → Amount | Direct reuse (in cents) |
| `currency` | Currency (ZAR/USD) | Direct reuse |
| `numberOfEmployees` | Line Item Description | Used in description |
| `subscriptionType` | Line Item Description | "yearly subscription" |
| `createdAt` | Invoice Date | When quote was created |
| `paidAt` | Date Paid | When payment completed |
| `paymentReference` | Payment History → Reference | Paystack reference |

### What We Need to Add 🆕

Based on Cursor receipt structure:

1. **Invoice/Receipt Numbers**
   - `invoiceNumber` - Sequential invoice number (e.g., "INV-2025-001")
   - `receiptNumber` - Unique receipt number (e.g., "RCP-2736-3055")

2. **Company Information (XSCard)**
   - `companyAddress` - Full address
   - `companyPhone` - Phone number
   - `companyEmail` - Support email
   - `companyVAT` - VAT/Tax ID (if applicable)

3. **Bill To (Customer)**
   - `billingAddress` - Full customer address (street, city, province, postal code, country)
   - `customerVAT` - Customer VAT number (if applicable)

4. **Line Items**
   - `lineItems` - Array of line items with:
     - `description` - Detailed description
     - `quantity` - Quantity (usually 1 for subscriptions)
     - `unitPrice` - Price per unit (in cents)
     - `amount` - Total amount (in cents)

5. **Payment Information**
   - `paymentMethod` - Payment method (e.g., "Visa - 4043")
   - `paymentDate` - When payment was made
   - `currencyConversion` - If paid in different currency (e.g., "Charged R334.87 using 1 USD = 16.5612 ZAR")

6. **Invoice Status**
   - `invoiceStatus` - 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
   - `dueDate` - Payment due date (for invoices, not receipts)

---

## Final Schema: `enterprise_invoices`

**Single collection with `isReceipt` flag** - Simpler approach, easier to maintain.

```javascript
{
  // ===== INVOICE IDENTIFIERS =====
  invoiceId: string,              // Unique invoice ID (format: "inv_{timestamp}_{random}")
  invoiceNumber: string,          // Sequential invoice number (e.g., "INV-2025-001")
  receiptNumber: string,          // Receipt number (e.g., "RCP-2736-3055") - only when paid
  quoteId: string,                // Reference to original quote (if converted from quote)
  enterpriseId: string,           // Reference to enterprise account (if applicable)
  
  // ===== COMPANY INFO (XSCard) =====
  companyInfo: {
    name: string,                 // "XSCard" or your company name
    address: {
      street: string,             // "801 West End Avenue"
      city: string,               // "New York"
      province: string,           // "New York"
      postalCode: string,         // "10025"
      country: string             // "United States"
    },
    phone: string,                // "+1 831-425-9504"
    email: string,                // "hi@xscard.com"
    vatNumber: string             // "US EIN 87-4436547" or "ZA VAT 4610232680" (optional)
  },
  
  // ===== BILL TO (Customer) - REUSED FROM QUOTE =====
  billTo: {
    companyName: string,          // From quote.companyName
    contactName: string,          // From quote.contactName
    contactEmail: string,         // From quote.contactEmail
    address: {                     // NEW - needs to be collected
      street: string,             // "546 16th Road"
      building: string,           // "Building 2, Randjespark" (optional)
      city: string,               // "Midrand"
      province: string,           // "Gauteng" (optional)
      postalCode: string,        // "1685"
      country: string             // "South Africa"
    },
    vatNumber: string             // "ZA VAT 4610232680" (optional)
  },
  
  // ===== LINE ITEMS - SINGLE ITEM FOR SUBSCRIPTIONS =====
  lineItems: [
    {
      description: string,         // "XSCard Enterprise License for {employees} employees - {subscriptionType} subscription"
      quantity: number,            // Always 1 for subscriptions
      unitPrice: number,           // Price per unit (in cents) - from quote.calculatedPrice
      amount: number               // Total amount (in cents) - same as unitPrice
    }
  ],
  
  // ===== PRICING SUMMARY - REUSED FROM QUOTE =====
  subtotal: number,               // Sum of line items (in cents) - from quote.calculatedPrice
  tax: number,                    // Tax amount (in cents) - 0 if no tax
  total: number,                  // Total amount (in cents) - from quote.calculatedPrice
  amountPaid: number,             // Amount paid (in cents) - from quote.calculatedPrice
  
  // ===== CURRENCY - REUSED FROM QUOTE =====
  currency: 'ZAR' | 'USD',         // From quote.currency
  
  // ===== DATES =====
  invoiceDate: Timestamp,         // When invoice was created (from quote.createdAt or now)
  dueDate: Timestamp,              // Payment due date (30 days from invoice date, null for receipts)
  datePaid: Timestamp,             // When payment was completed (from quote.paidAt, null for invoices)
  
  // ===== PAYMENT INFORMATION =====
  paymentReference: string,        // Paystack payment reference - from quote.paymentReference
  paymentMethod: string,           // "Visa - 4043" (optional, fetched from Paystack when paid)
  
  // ===== STATUS =====
  invoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
  isReceipt: boolean,               // true if this is a receipt (paid), false if invoice (unpaid)
  
  // ===== METADATA =====
  metadata: {
    subscriptionType: string,      // From quote.subscriptionType ("yearly")
    numberOfEmployees: number      // From quote.numberOfEmployees
  },
  
  // ===== TRACKING =====
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Data Flow: Quote → Invoice/Receipt

### Scenario 1: Quote Paid → Generate Receipt

```javascript
// When quote.paidAt is set (payment completed)
const receiptData = {
  // Reuse quote data
  quoteId: quote.quoteId,
  billTo: {
    companyName: quote.companyName,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    address: quote.billingAddress || {}, // Need to collect this
    vatNumber: quote.customerVAT || null
  },
  lineItems: [{
    description: `XSCard Enterprise License for ${quote.numberOfEmployees} employees - ${quote.subscriptionType} subscription`,
    quantity: 1,
    unitPrice: quote.calculatedPrice,
    amount: quote.calculatedPrice
  }],
  subtotal: quote.calculatedPrice,
  total: quote.calculatedPrice,
  amountPaid: quote.calculatedPrice,
  currency: quote.currency,
  invoiceDate: quote.createdAt,
  datePaid: quote.paidAt,
  paymentReference: quote.paymentReference,
  invoiceStatus: 'paid',
  isReceipt: true,
  // Generate numbers
  invoiceNumber: generateInvoiceNumber(),
  receiptNumber: generateReceiptNumber(),
  paymentMethod: await extractPaymentMethod(quote.paymentReference) // From Paystack (optional)
};
```

### Scenario 2: Enterprise Account Renewal → Generate Invoice

```javascript
// When enterprise_account.nextBillingDate arrives
const invoiceData = {
  enterpriseId: account.enterpriseId,
  billTo: {
    companyName: account.companyName,
    contactName: account.contactName,
    contactEmail: account.contactEmail,
    address: account.billingAddress || {}, // Need to store this
    vatNumber: account.customerVAT || null
  },
  lineItems: [{
    description: `XSCard Enterprise License for ${account.numberOfEmployees} employees - Renewal`,
    quantity: 1,
    unitPrice: calculatePrice(account.numberOfEmployees, account.currency),
    amount: calculatePrice(account.numberOfEmployees, account.currency)
  }],
  invoiceDate: now,
  dueDate: addDays(now, 30), // 30 days payment terms
  invoiceStatus: 'sent',
  isReceipt: false
};
```

---

## Helper Functions Needed

### 1. Generate Invoice Number
```javascript
function generateInvoiceNumber() {
  // Format: INV-YYYY-NNNN
  const year = new Date().getFullYear();
  const sequence = await getNextInvoiceSequence(year);
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}
```

### 2. Generate Receipt Number
```javascript
function generateReceiptNumber() {
  // Format: RCP-YYYY-NNNN or similar
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${timestamp}-${random}`;
}
```

### 3. Build Line Item Description
```javascript
function buildLineItemDescription(quote) {
  return `XSCard Enterprise License for ${quote.numberOfEmployees} employees - ${quote.subscriptionType} subscription`;
}
```

### 4. Extract Payment Method from Paystack
```javascript
async function extractPaymentMethod(paymentReference) {
  // Fetch transaction from Paystack
  const transaction = await paystack.transaction.verify(paymentReference);
  return `${transaction.authorization.brand} - ${transaction.authorization.last4}`;
  // Returns: "Visa - 4043"
}
```

---

## PDF Generation Structure

Based on Cursor receipt, PDF should include:

1. **Header**
   - "Receipt" or "Invoice" title
   - Invoice number / Receipt number
   - Date paid (for receipts) or Due date (for invoices)

2. **Company Info Section**
   - XSCard company details (address, phone, email)

3. **Bill To Section**
   - Customer company name
   - Full address
   - Email
   - VAT number (if applicable)

4. **Payment Summary**
   - Amount paid / Amount due
   - Currency
   - Cycle dates (if applicable)

5. **Line Items Table**
   - Description | Qty | Unit Price | Amount

6. **Totals**
   - Subtotal
   - Tax (if applicable)
   - Total
   - Amount Paid

7. **Footer**
   - Company tax/VAT information

---

## Decisions Made ✅

1. **Billing Address Collection**
   - ✅ **Collect during quote creation** - Add `billingAddress` to quote payload
   - ✅ **Required field** - Address is mandatory

2. **VAT/Tax Numbers**
   - ✅ **Collect customer VAT number** - Add `vatNumber` to quote payload (optional)
   - ✅ **Store company VAT in env vars** - Fetch via helper function

3. **Invoice vs Receipt**
   - ✅ **Single collection with `isReceipt` flag** - Simpler approach, easier to maintain
   - ✅ **Auto-convert to receipt** - When invoice is paid, set `isReceipt: true` and `invoiceStatus: 'paid'`

4. **Line Items**
   - ✅ **Single line item** - No breakdown needed for subscriptions
   - ✅ **Simple description** - "XSCard Enterprise License for {employees} employees - {subscriptionType} subscription"

5. **Payment History**
   - ✅ **Not implemented** - Removed from schema (simpler)

6. **Company Information**
   - ✅ **Environment variables** - Store XSCard company details in `.env`
   - ✅ **Helper function** - Fetch via `getCompanyInfo()` helper

---

## Next Steps

1. ✅ Review and discuss this proposal
2. ⏳ Decide on billing address collection strategy
3. ⏳ Create invoice/receipt schema in `backend/schemas/enterpriseCollections.js`
4. ⏳ Implement invoice generation from quotes
5. ⏳ Implement receipt generation from paid quotes
6. ⏳ Create PDF generation for invoices/receipts (reuse quote PDF logic)
7. ⏳ Add invoice/receipt endpoints to API

---

**Last Updated:** 2025-01-27
