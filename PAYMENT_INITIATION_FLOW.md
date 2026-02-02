# Payment Initiation Flow - From Quote to Payment

**Current Status:** Quote generated with status `pending`  
**Next Step:** Initialize payment to get Paystack payment URL

---

## 🔄 Complete Flow Overview

```
1. Quote Generated (Phase 2)
   ↓ Status: "pending"
   ↓ Quote ID: "quote_1769538064841_qklzctsr9"
   
2. Payment Initialization (Phase 4) ← YOU ARE HERE
   ↓ Call: POST /api/enterprise/payment/initialize
   ↓
   ├─→ 2a. Plan Management (Phase 3) [Internal Step]
   │    ↓ Checks database for existing plan
   │    ↓ If not found: Creates Paystack plan
   │    ↓ Stores plan for reuse
   │    ↓ Returns plan code
   │
   ↓ Status changes to: "accepted"
   ↓ Get: paymentUrl
   
3. Redirect to Paystack
   ↓ User pays on Paystack
   
4. Payment Callback (Phase 5)
   ↓ Paystack redirects back
   ↓ Status changes to: "paid"
   ↓ Account created
```

---

## 📋 Step-by-Step: How to Start Payment

### Step 1: You Have a Quote ✅

**Your Current Quote:**
- **Quote ID:** `quote_1769538064841_qklzctsr9`
- **Status:** `pending`
- **Amount:** R 43,310.00
- **Employees:** 4,321
- **Valid Until:** 26 February 2026

### Step 2: Call Payment Initialization Endpoint

**Endpoint:** `POST /api/enterprise/payment/initialize`  
**Rate Limit:** 5 requests/hour per quote  
**Authentication:** None required

**Request:**
```javascript
POST http://localhost:8383/api/enterprise/payment/initialize
Content-Type: application/json

{
  "quoteId": "quote_1769538064841_qklzctsr9"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://paystack.com/pay/ent_quote_quote_1769538064841_qklzctsr9_1769538123456_abc123",
  "paymentReference": "ent_quote_quote_1769538064841_qklzctsr9_1769538123456_abc123",
  "quoteId": "quote_1769538064841_qklzctsr9",
  "amount": 4331000,
  "currency": "ZAR",
  "planCode": "PLN_4sa2jlinoluho2g",
  "subscriptionType": "yearly"
}
```

### Step 3: What Happens Behind the Scenes

When you call the payment initialization endpoint:

1. **Validates Quote** (Phase 4)
   - Checks quote exists ✅
   - Checks quote is not already paid ✅
   - Checks quote is not expired ✅

2. **Plan Management** (Phase 3 - Internal Step)
   - **Step 2a:** Checks database for existing plan matching:
     - Number of employees: 4,321
     - Amount: R 43,310.00
     - Currency: ZAR
   - **Step 2b:** If plan found in database:
     - Verifies plan still exists in Paystack
     - Returns existing plan code
   - **Step 2c:** If plan NOT found:
     - Creates new Paystack plan via API
     - Stores plan in database for future reuse
     - Returns new plan code
   - **Result:** Plan code ready for payment initialization

3. **Initializes Paystack Subscription** (Phase 4)
   - Calls Paystack `/transaction/initialize` with plan code
   - Creates payment reference
   - Gets authorization URL from Paystack

4. **Updates Quote** (Phase 4)
   - Sets `quoteStatus` to `"accepted"` (from `"pending"`)
   - Stores `paymentReference`
   - Stores `paymentUrl`
   - Stores `planCode`

5. **Returns Payment URL** (Phase 4)
   - Returns `paymentUrl` for frontend redirect

### Step 4: Redirect User to Paystack

**Frontend Action:**
```javascript
// After receiving paymentUrl from initialization
window.location.href = paymentUrl;
// or
window.open(paymentUrl, '_blank');
```

**User Experience:**
- User is redirected to Paystack payment page
- User enters payment details
- User completes payment

### Step 5: Payment Callback (Automatic)

**What Happens:**
- Paystack redirects to: `/api/enterprise/payment/callback?ref={paymentReference}`
- Server verifies payment
- Creates enterprise account
- Updates quote status to `"paid"`
- Redirects to success page

---

## 💻 Frontend Implementation Example

### JavaScript/TypeScript Example

```javascript
/**
 * Initialize payment for a quote
 * @param {string} quoteId - The quote ID from quote generation
 */
async function startPayment(quoteId) {
  try {
    // Show loading state
    showLoading('Initializing payment...');
    
    // Call payment initialization endpoint
    const response = await fetch('/api/enterprise/payment/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quoteId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle errors
      if (data.error === 'Quote expired') {
        showError('Quote expired. Please generate a new quote.');
        // Optionally redirect to quote generation
        return;
      } else if (data.error === 'Quote already paid') {
        showError('This quote has already been paid.');
        return;
      } else if (response.status === 429) {
        showError('Too many requests. Please wait before trying again.');
        return;
      } else {
        showError(data.message || 'Failed to initialize payment.');
        return;
      }
    }
    
    if (data.success && data.paymentUrl) {
      // Success! Redirect to Paystack
      console.log('Payment initialized:', data.paymentReference);
      
      // Store payment reference (optional, for tracking)
      sessionStorage.setItem('paymentReference', data.paymentReference);
      sessionStorage.setItem('quoteId', quoteId);
      
      // Redirect to Paystack payment page
      window.location.href = data.paymentUrl;
      
      // OR open in new tab/window
      // window.open(data.paymentUrl, '_blank');
    } else {
      showError('Invalid response from server.');
    }
    
  } catch (error) {
    console.error('Payment initialization failed:', error);
    showError('Failed to initialize payment. Please try again.');
  } finally {
    hideLoading();
  }
}

// Usage: Call this function with your quote ID
startPayment('quote_1769538064841_qklzctsr9');
```

### React Example

```jsx
import { useState } from 'react';

function PaymentButton({ quoteId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/enterprise/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId })
      });
      
      const data = await response.json();
      
      if (data.success && data.paymentUrl) {
        // Redirect to Paystack
        window.location.href = data.paymentUrl;
      } else {
        setError(data.message || 'Failed to initialize payment');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button 
        onClick={handlePayment} 
        disabled={loading}
      >
        {loading ? 'Initializing...' : 'Proceed to Payment'}
      </button>
    </div>
  );
}
```

### HTML/JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Enterprise Payment</title>
</head>
<body>
  <div id="quote-display">
    <h2>Your Quote</h2>
    <p>Quote ID: <span id="quote-id">quote_1769538064841_qklzctsr9</span></p>
    <p>Amount: R 43,310.00</p>
    <p>Status: <span id="quote-status">pending</span></p>
  </div>
  
  <button id="pay-button" onclick="initializePayment()">
    Proceed to Payment
  </button>
  
  <div id="error-message" style="color: red; display: none;"></div>
  
  <script>
    async function initializePayment() {
      const quoteId = document.getElementById('quote-id').textContent;
      const button = document.getElementById('pay-button');
      const errorDiv = document.getElementById('error-message');
      
      // Disable button and show loading
      button.disabled = true;
      button.textContent = 'Initializing...';
      errorDiv.style.display = 'none';
      
      try {
        const response = await fetch('/api/enterprise/payment/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId })
        });
        
        const data = await response.json();
        
        if (data.success && data.paymentUrl) {
          // Redirect to Paystack
          window.location.href = data.paymentUrl;
        } else {
          // Show error
          errorDiv.textContent = data.message || 'Failed to initialize payment';
          errorDiv.style.display = 'block';
          button.disabled = false;
          button.textContent = 'Proceed to Payment';
        }
      } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
        button.disabled = false;
        button.textContent = 'Proceed to Payment';
      }
    }
  </script>
</body>
</html>
```

---

## 🔍 Status Changes

### Quote Status Flow

```
pending → accepted → paid
   ↓         ↓        ↓
Quote    Payment   Account
Created  Initiated  Created
```

**Status Meanings:**
- **`pending`** - Quote generated, waiting for payment initialization
- **`accepted`** - Payment initialized, user redirected to Paystack
- **`paid`** - Payment completed, account created
- **`expired`** - Quote expired (30 days), cannot be used

---

## ⚠️ Error Handling

### Common Errors

**1. Quote Expired (400)**
```json
{
  "success": false,
  "error": "Quote expired",
  "message": "This quote has expired. Please generate a new quote."
}
```
**Action:** Generate a new quote

**2. Quote Already Paid (400)**
```json
{
  "success": false,
  "error": "Quote already paid",
  "message": "This quote has already been paid."
}
```
**Action:** Show success message or redirect to account page

**3. Rate Limit Exceeded (429)**
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later."
}
```
**Action:** Show message, disable button, allow retry after delay

**4. Quote Not Found (404)**
```json
{
  "success": false,
  "error": "Quote not found",
  "message": "The specified quote does not exist."
}
```
**Action:** Generate a new quote

---

## 📊 API Reference Summary

### Payment Initialization Endpoint

**URL:** `POST /api/enterprise/payment/initialize`

**Request Body:**
```json
{
  "quoteId": "quote_1769538064841_qklzctsr9"
}
```

**Success Response:**
```json
{
  "success": true,
  "paymentUrl": "https://paystack.com/pay/...",
  "paymentReference": "ent_quote_...",
  "quoteId": "quote_1769538064841_qklzctsr9",
  "amount": 4331000,
  "currency": "ZAR",
  "planCode": "PLN_...",
  "subscriptionType": "yearly"
}
```

**Error Responses:**
- `400` - Validation failed, quote expired, or quote already paid
- `404` - Quote not found
- `429` - Rate limit exceeded (5/hour per quote)
- `500` - Server error

---

## ✅ Quick Start Checklist

- [x] Quote generated (status: `pending`)
- [ ] Call `POST /api/enterprise/payment/initialize` with `quoteId`
- [ ] Receive `paymentUrl` in response
- [ ] Redirect user to `paymentUrl`
- [ ] User completes payment on Paystack
- [ ] Paystack redirects to callback (automatic)
- [ ] Account created (automatic)

---

## 🎯 For Your Current Quote

**To start payment for your quote:**

```javascript
// Your quote ID
const quoteId = 'quote_1769538064841_qklzctsr9';

// Call initialization
fetch('/api/enterprise/payment/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quoteId })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    window.location.href = data.paymentUrl;
  }
});
```

---

**Ready to proceed!** 🚀

