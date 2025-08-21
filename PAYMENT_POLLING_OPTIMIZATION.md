# Payment Polling Optimization & Payment URL Fix

## Issues Fixed

### 1. **CRITICAL: Payment URL Not Opening** ⚠️
**Problem**: Users clicking "Complete Payment" never reached the Paystack payment page, causing all payments to be "abandoned"
**Root Cause**: "Complete Payment" action only passed `eventId` but PaymentPendingScreen needed the actual payment URL to open Paystack
**Solution** (Following subscription code pattern): 
- **Backend**: Store payment URL in database when event is published (like subscription does)
- **Backend**: Payment status endpoint returns stored payment URL for pending payments
- **Frontend**: PaymentPendingScreen fetches payment URL from status endpoint if not provided initially
- **Frontend**: Auto-opens payment URL when it becomes available (either passed or fetched)

### 2. Excessive Backend Polling
**Problem**: Frontend was polling every 3 seconds indefinitely, causing backend spam
**Solution**: 
- Reduced polling interval from 3s to 5s
- Added exponential backoff (increases to max 15s after 10 attempts)
- Reduced max attempts from 100 to 60 (5 minutes total)
- Added `pollingActive` state to stop polling when payment status is determined

### 3. Abandoned Payment Handling
**Problem**: Paystack returns different failure statuses ("abandoned", "failed", "declined") but backend/frontend didn't handle them properly
**Solution**:
- **Backend**: Enhanced `verifyPaystackTransaction` to detect abandoned/failed/declined payments
- **Backend**: Added specific handling for all failure types in `checkEventPaymentStatus`
- **Frontend**: Added detection and UI feedback for all payment failure scenarios
- **Frontend**: Stop polling when payment is abandoned/failed/declined

### 4. User Experience
**Problem**: Users didn't know what happened when payment was abandoned
**Solution**:
- Clear toast messages for different payment states
- Informative error messages explaining next steps
- Manual "Check Now" button to retry verification
- "Open Payment Page" button to retry payment

## Technical Changes

### Backend (`eventController.js`)
1. **Enhanced `verifyPaystackTransaction`**:
   - Returns `abandoned: true` for abandoned payments
   - Returns `failed: true` for failed/reversed payments
   - More specific error handling

2. **Enhanced `checkEventPaymentStatus`**:
   - Handles abandoned payments (reverts to draft status)
   - Handles failed/declined payments (reverts to draft status)
   - Returns `paymentStatus` field in response for better frontend handling

### Frontend (`PaymentPendingScreen.tsx`)
1. **Optimized Polling**:
   - 5-second intervals instead of 3-second
   - Exponential backoff after 10 attempts
   - `pollingActive` state to control polling

2. **Payment Status Handling**:
   - Detects `paymentStatus: 'abandoned'` and `paymentStatus: 'failed'`
   - Stops polling when status is determined
   - Clear user feedback for each scenario

3. **User Controls**:
   - Manual refresh resets polling state
   - Better error messages with actionable next steps

## Expected Behavior Now

### **Complete Payment Flow (Fixed!)**
1. User clicks "Complete Payment" → PaymentPendingScreen opens
2. Backend generates fresh Paystack payment URL 
3. Paystack payment page opens automatically in browser
4. User enters card details and completes payment
5. Frontend detects success and publishes event

### Successful Payment
1. User completes payment → Status becomes "published" → Event goes live

### Abandoned Payment
1. User opens payment page but doesn't complete (closes browser) → Backend detects "abandoned"
2. Frontend stops polling and shows "Payment was abandoned" message
3. Event reverts to draft status → User can retry publishing from events list

### Failed/Declined Payment
1. User attempts payment but it fails/declines (card declined, insufficient funds, etc.) → Backend detects "failed"
2. Event reverts to draft status → Frontend shows failure message and stops polling
3. User can retry publishing with different payment method from events list

### Timeout
1. After 5 minutes of polling → Frontend stops and shows timeout message
2. User can manually check or retry from events list

## Payment Status Scenarios Explained

### Understanding Different Payment Outcomes

#### ✅ **Successful Payment**
- **Paystack Status**: `success`
- **What Happens**: Event immediately publishes and goes live
- **User Experience**: Success message, redirected to published event

#### ❌ **Failed/Declined Payment**  
- **Paystack Status**: `failed` or `declined`
- **Triggers**: Card declined, insufficient funds, payment method issues
- **What Happens**: Event reverts to draft status
- **User Experience**: Error message, can retry with different payment method
- **Example**: Using Paystack's "declined transaction simulator"

#### 🚪 **Abandoned Payment**
- **Paystack Status**: `abandoned`
- **Triggers**: User opens payment page but closes browser/app without completing
- **What Happens**: Event reverts to draft status
- **User Experience**: Abandonment message, can retry publishing

#### ⏳ **Pending Payment**
- **Paystack Status**: `pending` or no response yet
- **Triggers**: Payment processing, network delays, webhook delays
- **What Happens**: Frontend continues polling for status updates
- **User Experience**: Loading screen with progress indicators

#### ⚠️ **Unknown/Error States**
- **Paystack Status**: Invalid response, network errors
- **What Happens**: Polling continues or shows error message
- **User Experience**: "Unable to verify payment" message with retry options

### Why Events Revert to Draft

When payments fail or are abandoned, events automatically revert to **draft status** because:

1. **Financial Integrity**: Unpaid events shouldn't be published
2. **User Control**: Users can retry with different payment methods
3. **System Consistency**: Clear state management prevents stuck events
4. **Audit Trail**: Failed attempts are tracked for analytics

This behavior is **expected and correct** - it protects both users and the platform.

## Benefits
- ✅ Reduced backend load (fewer API calls)
- ✅ Better user experience (clear status updates)
- ✅ Proper handling of all payment scenarios
- ✅ No infinite polling loops
- ✅ Production-ready error handling

The payment flow now gracefully handles all Paystack payment states and provides a much better user experience while being more efficient on the backend.
