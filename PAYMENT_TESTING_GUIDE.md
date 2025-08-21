# Payment Testing Guide

## Testing Different Payment Scenarios with Paystack

### 1. Testing Successful Payments

**Steps:**
1. Publish a paid event
2. Complete payment with valid test card details:
   - **Card Number**: `4084084084084081` (Visa)
   - **Expiry**: Any future date (e.g., `12/26`)
   - **CVV**: Any 3 digits (e.g., `123`)
3. **Expected Result**: Event publishes successfully

### 2. Testing Failed/Declined Payments ❌

**Steps:**
1. Publish a paid event
2. Use Paystack's **"Declined Transaction Simulator"**:
   - Click the "Simulate a declined transaction" button on the payment page
   - OR use declined test cards: `4084084084084085`
3. **Expected Result**: 
   - Event reverts to draft status ✅
   - User can retry publishing
   - Clear error message shown

### 3. Testing Abandoned Payments 🚪

**Steps:**
1. Publish a paid event
2. Open the Paystack payment page
3. Close the browser/tab without completing payment
4. Wait for polling to detect abandonment (~30-60 seconds)
5. **Expected Result**:
   - Event reverts to draft status ✅
   - User can retry publishing
   - Abandonment message shown

### 4. Testing Network/Timeout Issues ⏳

**Steps:**
1. Publish a paid event
2. Disconnect internet during payment process
3. Wait for polling timeout (5 minutes)
4. **Expected Result**:
   - Timeout message shown
   - Manual "Check Now" button available
   - Event status can be verified manually

## Test Cards for Different Scenarios

### Successful Payments
- `4084084084084081` - Always succeeds
- `5060666666666666` - Mastercard success
- `4239970000000006` - Visa success

### Failed Payments
- `4084084084084085` - Always declines
- `5181178478239446` - Mastercard decline

### Special Test Scenarios
- `4000000000000002` - Card declined (generic)
- `4000000000000069` - Expired card
- `4000000000000127` - Incorrect CVV

## Monitoring Payment Status

### Backend Logs to Watch For:
```
Verifying payment with Paystack: [reference]
Paystack verification response: { status: true, dataStatus: 'success/failed/abandoned' }
Event [eventId] reverted to draft after [failed/abandoned] payment
Event [eventId] auto-published after payment verification
```

### Frontend Behavior:
- **Success**: Green toast + navigation to event
- **Failed**: Red toast + navigation to events list
- **Abandoned**: Yellow toast + navigation to events list
- **Timeout**: Warning toast + manual retry options

## Expected Database State Changes

### Successful Payment:
```
status: 'draft' → 'pending_payment' → 'published'
paymentCompletedAt: [timestamp]
publishedAt: [timestamp]
```

### Failed Payment:
```
status: 'draft' → 'pending_payment' → 'draft'
paymentFailedAt: [timestamp]
paymentReference: [kept for audit]
```

### Abandoned Payment:
```
status: 'draft' → 'pending_payment' → 'draft'
paymentAbandonedAt: [timestamp]
paymentUrl: null
```

## Troubleshooting Common Issues

### Event Stuck in Pending Payment
- Check Paystack dashboard for transaction status
- Check backend logs for verification attempts
- Manually trigger payment status check API
- Use declined simulator to force failure and retry

### Payment URL Not Opening
- Verify `paymentUrl` is stored in database
- Check browser popup blockers
- Test on different devices/browsers

### Polling Not Working
- Check network connectivity
- Verify API endpoints are accessible
- Check authentication tokens
- Monitor console logs for errors

## Production vs Test Environment

### Test Environment (Paystack Test Mode):
- Use test API keys
- Payments are simulated (no real money)
- Test cards always work predictably
- Can simulate any scenario

### Production Environment:
- Real payments with real cards
- Real money transactions
- More complex failure scenarios
- Regulatory compliance required

Always test thoroughly in test mode before deploying to production!
