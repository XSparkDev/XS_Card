# Frontend Requirements for Enterprise Payment System

**Last Updated:** 2025-01-27  
**Status:** Complete requirements checklist

---

## 📋 Overview

This document outlines all frontend components, screens, and functionality needed to implement the enterprise payment flow.

---

## 🎯 Required Frontend Components

### 1. **Quote Generation Form** (Phase 2)

**Purpose:** Allow users to request enterprise quotes

**Required Fields:**
- Company Name (text input, required)
- Contact Name (text input, required)
- Contact Email (email input, required)
- Number of Employees (number input, required, min: 1, max: configurable via env)
- Currency (dropdown: ZAR/USD, optional, defaults to ZAR)

**Features Needed:**
- ✅ Form validation (client-side)
- ✅ Loading state during submission
- ✅ Error display for validation errors
- ✅ Rate limiting handling (429 errors)
- ✅ Success display with quote details
- ✅ Quote ID storage (localStorage/sessionStorage)

**API Call:**
```javascript
POST /api/enterprise/quote
```

**Example Component Structure:**
```typescript
// QuoteGenerationForm.tsx
interface QuoteFormData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  numberOfEmployees: number;
  currency?: 'ZAR' | 'USD';
}

// State needed:
- formData: QuoteFormData
- loading: boolean
- errors: string[]
- quote: Quote | null
```

---

### 2. **Quote Display/Preview Component** (Phase 2)

**Purpose:** Show generated quote details to user

**Display Information:**
- Quote ID
- Company Name
- Contact Name
- Contact Email
- Number of Employees
- Calculated Price (formatted)
- Currency
- Quote Status (pending/accepted/paid/expired)
- Created Date
- Expiration Date
- Download PDF button (optional)

**Features Needed:**
- ✅ Format price display (e.g., "R 43,310.00")
- ✅ Show expiration countdown/timer
- ✅ Status badge/indicator
- ✅ PDF download functionality
- ✅ "Proceed to Payment" button (if status is "pending")

**Example Component Structure:**
```typescript
// QuoteDisplay.tsx
interface Quote {
  quoteId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  numberOfEmployees: number;
  calculatedPrice: number;
  formattedPrice: string;
  currency: string;
  quoteStatus: 'pending' | 'accepted' | 'expired' | 'paid';
  createdAt: string;
  expiresAt: string;
}
```

---

### 3. **Payment Initialization Button/Component** (Phase 4)

**Purpose:** Start payment process for a quote

**Features Needed:**
- ✅ Button to trigger payment initialization
- ✅ Loading state ("Initializing payment...")
- ✅ Error handling (expired quote, already paid, rate limit)
- ✅ Redirect to Paystack payment URL
- ✅ Store payment reference (optional, for tracking)

**API Call:**
```javascript
POST /api/enterprise/payment/initialize
Body: { quoteId: string }
```

**Error Handling:**
- Quote expired → Show message, allow new quote
- Quote already paid → Show success message or redirect
- Rate limit exceeded → Show message with retry time
- Network errors → Show retry option

**Example Component Structure:**
```typescript
// PaymentButton.tsx
interface PaymentButtonProps {
  quoteId: string;
  onSuccess?: (paymentUrl: string) => void;
  onError?: (error: string) => void;
}

// State needed:
- loading: boolean
- error: string | null
```

---

### 4. **Payment Success Page** (Phase 5)

**Purpose:** Display success message after payment completion

**URL Pattern:**
```
/enterprise-payment-success.html?quoteId={quoteId}&enterpriseId={enterpriseId}
```

**Display Information:**
- Success message
- Enterprise Account ID
- Company Name
- Subscription details (if available)
- Next steps/instructions
- Link to account dashboard (if exists)

**Features Needed:**
- ✅ Parse URL parameters (quoteId, enterpriseId)
- ✅ Display success confirmation
- ✅ Show account details
- ✅ Navigation to next steps

**Example Component Structure:**
```typescript
// PaymentSuccessScreen.tsx
// Read from URL params:
- quoteId: string
- enterpriseId: string

// Display:
- Success message
- Account information
- Next steps
```

---

### 5. **Payment Failure Page** (Phase 5)

**Purpose:** Display error message if payment fails

**URL Pattern:**
```
/enterprise-payment-failure.html?error={errorCode}&ref={paymentReference}
```

**Display Information:**
- Error message
- Payment reference (for support)
- Retry payment option
- Contact support link

**Features Needed:**
- ✅ Parse URL parameters (error, ref)
- ✅ Display user-friendly error message
- ✅ Retry button (if applicable)
- ✅ Support contact information

**Example Component Structure:**
```typescript
// PaymentFailureScreen.tsx
// Read from URL params:
- error: string
- ref: string

// Display:
- Error message
- Retry option
- Support contact
```

---

### 6. **Subscription Status Dashboard** (Phase 7 - Optional)

**Purpose:** Display subscription status and details

**Features Needed:**
- ✅ Fetch subscription status
- ✅ Display account status
- ✅ Show billing dates
- ✅ Display warning banners (grace period, suspension)
- ✅ Employee count display
- ✅ Cancel subscription option
- ✅ Update employee count option

**API Calls:**
```javascript
GET /api/enterprise/subscription/:enterpriseId/status
POST /api/enterprise/subscription/:enterpriseId/cancel
POST /api/enterprise/subscription/:enterpriseId/update-employees
```

**Example Component Structure:**
```typescript
// SubscriptionDashboard.tsx
interface SubscriptionStatus {
  status: string;
  accountStatus: 'active' | 'suspended' | 'cancelled';
  nextBillingDate: string;
  lastBillingDate: string;
  numberOfEmployees: number;
  amount: number;
  currency: string;
  isActive: boolean;
  warningBanner: {
    show: boolean;
    message: string;
    severity: 'info' | 'warning' | 'error';
    actionRequired: boolean;
    actionUrl: string;
  };
}
```

---

## 🔧 Utility Functions Needed

### 1. **API Service Functions**

```typescript
// services/enterpriseService.ts

// Quote Generation
async function generateQuote(data: QuoteFormData): Promise<Quote | null>

// Payment Initialization
async function initializePayment(quoteId: string): Promise<PaymentInitResponse | null>

// Subscription Status
async function getSubscriptionStatus(enterpriseId: string): Promise<SubscriptionStatus | null>

// Cancel Subscription
async function cancelSubscription(enterpriseId: string): Promise<boolean>

// Update Employee Count
async function updateEmployeeCount(enterpriseId: string, newCount: number): Promise<boolean>
```

### 2. **Error Handling Utilities**

```typescript
// utils/errorHandler.ts

function handleApiError(error: ApiError): string {
  // Convert API errors to user-friendly messages
}

function isRateLimitError(error: ApiError): boolean {
  // Check if error is rate limit (429)
}

function getRetryTime(error: ApiError): number | null {
  // Extract retry time from rate limit error
}
```

### 3. **Formatting Utilities**

```typescript
// utils/formatters.ts

function formatPrice(amount: number, currency: string): string {
  // Format: "R 43,310.00" or "$ 5,000.00"
}

function formatDate(date: string): string {
  // Format ISO date to readable format
}

function getDaysUntilExpiration(expiresAt: string): number {
  // Calculate days until expiration
}
```

---

## 📱 Screen/Page Structure

### **Option 1: Multi-Step Form (Recommended)**

```
Step 1: Quote Request Form
  ↓ (Submit)
Step 2: Quote Preview/Display
  ↓ (Proceed to Payment)
Step 3: Payment Initialization (Loading)
  ↓ (Redirect to Paystack)
Step 4: Paystack Payment (External)
  ↓ (Paystack redirects back)
Step 5: Success/Failure Page
```

### **Option 2: Single Page with Modal**

```
Main Page: Quote Form
  ↓ (Submit)
Modal: Quote Preview
  ↓ (Proceed to Payment)
Loading: Payment Initialization
  ↓ (Redirect to Paystack)
External: Paystack Payment
  ↓ (Redirect back)
Page: Success/Failure
```

---

## 🎨 UI/UX Requirements

### **1. Loading States**

- Quote generation: "Generating quote..."
- Payment initialization: "Initializing payment..."
- Status checks: "Loading subscription status..."

### **2. Error States**

- Validation errors: Show inline with fields
- API errors: Show at top of form or in modal
- Rate limit errors: Show with retry timer
- Network errors: Show with retry button

### **3. Success States**

- Quote generated: Show quote preview
- Payment initialized: Redirect to Paystack
- Payment completed: Show success page

### **4. Status Indicators**

- Quote status badges: pending, accepted, paid, expired
- Account status badges: active, suspended, cancelled
- Warning banners: For grace period, payment failures

---

## 📦 State Management

### **Local Storage/Session Storage**

Store for user session:
```typescript
// Quote ID (persist across page reloads)
localStorage.setItem('enterpriseQuoteId', quoteId);

// Payment reference (for tracking)
sessionStorage.setItem('paymentReference', paymentReference);

// Enterprise ID (after payment success)
localStorage.setItem('enterpriseId', enterpriseId);
```

### **React State (if using React)**

```typescript
// Quote state
const [quote, setQuote] = useState<Quote | null>(null);
const [loading, setLoading] = useState(false);
const [errors, setErrors] = useState<string[]>([]);

// Payment state
const [paymentInitializing, setPaymentInitializing] = useState(false);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

---

## 🔐 Security Considerations

### **1. Input Validation**

- ✅ Client-side validation (UX)
- ✅ Server-side validation (Security) - Already implemented
- ✅ Sanitize user inputs before display

### **2. Rate Limiting Handling**

- ✅ Disable buttons during rate limit
- ✅ Show retry countdown
- ✅ Prevent multiple simultaneous requests

### **3. Error Message Display**

- ✅ Don't expose sensitive server errors
- ✅ Show user-friendly messages
- ✅ Log errors for debugging (client-side)

---

## 📊 Data Flow Summary

```
User Input (Form)
  ↓
Client Validation
  ↓
API Call (Quote Generation)
  ↓
Store Quote ID
  ↓
Display Quote Preview
  ↓
User Clicks "Proceed to Payment"
  ↓
API Call (Payment Initialization)
  ↓
Redirect to Paystack
  ↓
User Pays on Paystack
  ↓
Paystack Redirects Back
  ↓
Display Success/Failure Page
```

---

## ✅ Implementation Checklist

### **Phase 2: Quote Generation**
- [ ] Quote generation form component
- [ ] Form validation (client-side)
- [ ] API integration for quote generation
- [ ] Quote display/preview component
- [ ] PDF download functionality (optional)
- [ ] Error handling
- [ ] Rate limiting handling
- [ ] Loading states

### **Phase 4: Payment Initialization**
- [ ] Payment button/component
- [ ] API integration for payment initialization
- [ ] Redirect to Paystack
- [ ] Error handling (expired, paid, rate limit)
- [ ] Loading states
- [ ] Payment reference storage (optional)

### **Phase 5: Payment Callback**
- [ ] Success page component
- [ ] Failure page component
- [ ] URL parameter parsing
- [ ] Account information display
- [ ] Navigation/next steps

### **Phase 7: Subscription Management (Optional)**
- [ ] Subscription status dashboard
- [ ] Status API integration
- [ ] Warning banner display
- [ ] Cancel subscription functionality
- [ ] Update employee count functionality

---

## 🚀 Quick Start Implementation

### **Minimal Implementation (Essential Only)**

1. **Quote Form** - Generate quotes
2. **Quote Display** - Show quote details
3. **Payment Button** - Initialize payment
4. **Success Page** - Show after payment

### **Full Implementation (Recommended)**

All components listed above with:
- Error handling
- Loading states
- Status management
- Subscription dashboard

---

## 📝 Example File Structure

```
src/
├── screens/
│   └── enterprise/
│       ├── EnterpriseQuoteScreen.tsx      # Quote form
│       ├── QuotePreviewScreen.tsx          # Quote display
│       ├── PaymentSuccessScreen.tsx        # Success page
│       └── PaymentFailureScreen.tsx        # Failure page
├── components/
│   └── enterprise/
│       ├── QuoteForm.tsx                   # Quote form component
│       ├── QuoteDisplay.tsx                # Quote display component
│       ├── PaymentButton.tsx               # Payment button
│       └── SubscriptionDashboard.tsx       # Status dashboard
├── services/
│   └── enterpriseService.ts                # API service functions
└── utils/
    ├── formatters.ts                       # Formatting utilities
    └── errorHandler.ts                     # Error handling
```

---

## 🎯 Next Steps

1. **Start with Quote Form** - Most important, user entry point
2. **Add Quote Display** - Show generated quote
3. **Implement Payment Button** - Connect to payment initialization
4. **Create Success/Failure Pages** - Handle payment completion
5. **Add Subscription Dashboard** - Optional, for ongoing management

---

**Ready to implement!** 🚀

