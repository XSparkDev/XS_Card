# Abandoned Payment Handling - Implementation Guide

## Overview
This document explains how the XSCard app handles abandoned payments when users start but don't complete the Paystack payment flow for event publishing.

## Problem Statement
Previously, when users opened a Paystack payment page but didn't complete the payment (abandoned), the event remained in `pending_payment` status indefinitely. This prevented users from retrying the publish process and caused a poor user experience.

## Solution Implementation

### Backend Changes

#### 1. Enhanced Payment Status Check (`checkEventPaymentStatus`)
**File:** `backend/controllers/eventController.js`

When checking payment status, if a payment is found to be abandoned:
- Event status is updated from `pending_payment` to `draft`
- Payment URL is cleared (set to null)
- `paymentAbandonedAt` timestamp is recorded
- Payment reference is kept for audit trail

```javascript
} else if (verified.abandoned) {
  // Payment was abandoned - revert to draft status so user can try again
  await eventRef.update({
    status: 'draft',
    updatedAt: admin.firestore.Timestamp.now(),
    paymentAbandonedAt: admin.firestore.Timestamp.now(),
    paymentUrl: null
  });
  
  response.event.status = 'draft';
  response.message = 'Payment was abandoned. Event reverted to draft status. You can try publishing again.';
  response.paymentStatus = 'abandoned';
}
```

#### 2. Smart Retry Logic in Publish Event (`publishEvent`)
**File:** `backend/controllers/eventController.js`

When a user tries to publish an event that's in `pending_payment` status:
- Check if the existing payment was abandoned or failed
- If so, automatically revert the event to `draft` and allow retry
- If payment is genuinely pending, block the retry

```javascript
if (eventData.status === 'pending_payment') {
  if (eventData.paymentReference) {
    const verified = await verifyPaystackTransaction(eventData.paymentReference);
    
    if (verified.abandoned || verified.failed) {
      // Allow retry by reverting to draft
      await eventRef.update({
        status: 'draft',
        updatedAt: admin.firestore.Timestamp.now(),
        paymentAbandonedAt: admin.firestore.Timestamp.now(),
        paymentUrl: null
      });
    } else {
      // Payment is still genuinely pending
      return sendError(res, 400, 'Event is pending payment. Please complete payment first.');
    }
  }
}
```

### Frontend Changes

#### Enhanced PaymentPendingScreen
**File:** `src/screens/events/PaymentPendingScreen.tsx`

When payment abandonment is detected:
- Shows appropriate toast message
- Automatically navigates back to MyEventsScreen after 2 seconds
- Stops polling immediately

```typescript
if (result.paymentStatus === 'abandoned') {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
  }
  setPollingActive(false);
  toast.warning('Payment Abandoned', 'Payment was abandoned. Your event has been reverted to draft status.');
  
  // Navigate back to MyEvents since event is now in draft
  setTimeout(() => {
    navigation.navigate('MyEventsScreen' as never);
  }, 2000);
  return;
}
```

## User Flow

### Scenario: User Abandons Payment

1. **User publishes paid event** → Redirected to PaymentPendingScreen
2. **Payment URL opens in browser** → User sees Paystack payment page
3. **User closes browser/doesn't complete payment** → Paystack marks as "abandoned"
4. **PaymentPendingScreen polls for status** → Backend detects abandonment
5. **Backend reverts event to draft** → Clears payment URL, records abandonment
6. **Frontend shows abandonment message** → Auto-navigates to MyEventsScreen
7. **User can retry publishing** → New payment URL generated, fresh attempt

### Scenario: User Retries After Abandonment

1. **User goes to MyEventsScreen** → Sees event in "Draft" status
2. **User clicks "Publish Event" again** → Backend checks previous payment
3. **Backend detects abandoned payment** → Automatically allows retry
4. **New payment session created** → Fresh Paystack URL generated
5. **User completes payment** → Event published successfully

## Key Benefits

1. **No Stuck Events**: Events don't remain in limbo after abandoned payments
2. **Seamless Retries**: Users can easily retry publishing without manual intervention
3. **Clear User Feedback**: Users understand what happened and what to do next
4. **Audit Trail**: All payment attempts are tracked with timestamps
5. **Automatic Recovery**: System self-heals from abandoned payment states

## Database Schema Impact

### New Fields Added to Events Collection
- `paymentAbandonedAt` (Timestamp): When payment was abandoned
- `paymentUrl` set to `null`: Cleared when payment is abandoned

### Existing Fields Used
- `paymentReference`: Kept for audit trail
- `status`: Changed from `pending_payment` to `draft`
- `updatedAt`: Updated when status changes

## Testing Scenarios

### Test Case 1: Abandon and Retry
1. Create paid event and publish (triggers payment)
2. Open payment URL but close without completing
3. Wait for polling to detect abandonment
4. Verify event is back in draft status
5. Retry publishing and complete payment
6. Verify event publishes successfully

### Test Case 2: Multiple Abandonment
1. Abandon payment multiple times
2. Verify each retry works correctly
3. Verify audit trail is maintained

### Test Case 3: Mixed Success/Abandonment
1. Have some users complete payments
2. Have others abandon payments
3. Verify system handles both correctly

## Monitoring and Logging

The system logs all payment state changes:
- Payment initiation
- Abandonment detection
- Status reversions
- Retry attempts

Search logs for patterns like:
- "Payment was abandoned"
- "reverted to draft after abandoned payment"
- "Checking payment status for retry attempt"

## Related Files

- `backend/controllers/eventController.js` - Main payment logic
- `src/screens/events/PaymentPendingScreen.tsx` - Polling and UI
- `src/screens/events/MyEventsScreen.tsx` - Event listing and retry
- `backend/routes/eventRoutes.js` - Payment status endpoints
- `src/services/eventService.ts` - API communication

## Paystack Integration

The implementation leverages Paystack's transaction verification API:
- `GET /transaction/verify/{reference}` returns status including "abandoned"
- Webhook notifications are also handled for real-time updates
- Both polling and webhook work together for reliability
