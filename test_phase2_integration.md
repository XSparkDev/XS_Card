# Event Registration Payment Integration Testing Guide

## Overview
This guide outlines how to test the implementation of the event registration payment system. The implementation allows users to pay for tickets when registering for paid events.

## Prerequisites
- A running backend server (port 8383)
- A running frontend app (Expo or native)
- Test user credentials
- At least one published paid event in the system

## Test Scenarios

### 1. Register for a Paid Event

**Steps:**
1. Log in to the app using your test credentials
2. Navigate to the Events tab
3. Find and select a published paid event
4. On the event details screen, tap "Register for Event"
5. The app should redirect to the PaymentPendingScreen
6. Verify that the payment URL opens automatically in the browser
7. Complete the payment using Paystack test cards:
   - Success: `4084084084084081`
   - Failure: `4084084084084085`

**Expected Results:**
- The payment page loads correctly
- After successful payment, you return to the app and see a success message
- The event shows as registered in your events list
- You can view your ticket for the event

### 2. Test Payment Abandonment

**Steps:**
1. Start a new registration for a paid event
2. When the payment page opens, close it without completing payment
3. Return to the app and observe the PaymentPendingScreen
4. Wait for the polling to detect the abandoned payment (30-60 seconds)

**Expected Results:**
- The PaymentPendingScreen should update to show "Payment was abandoned"
- You should see options to try again or go back
- The registration should not be completed

### 3. Test Payment Failure

**Steps:**
1. Start a new registration for a paid event
2. When the payment page opens, use the declined test card: `4084084084084085`
3. Complete the payment form with the declined card
4. Return to the app

**Expected Results:**
- The PaymentPendingScreen should update to show "Payment failed"
- You should see options to try again or go back
- The registration should not be completed

### 4. Test Polling and Status Updates

**Steps:**
1. Start a new registration for a paid event
2. When the payment page opens, keep it open but don't complete it yet
3. Observe the PaymentPendingScreen showing "Processing Payment..."
4. Complete the payment with a success card
5. Return to the app

**Expected Results:**
- The polling mechanism should detect the completed payment
- The screen should update to show "Payment Successful"
- After a short delay, you should be redirected to the event details screen
- The event should show as registered

### 5. Test Manual Payment URL Opening

**Steps:**
1. Start a new registration for a paid event
2. When the payment URL opens, immediately close it
3. On the PaymentPendingScreen, tap "Open Payment Page" to reopen it
4. Complete the payment

**Expected Results:**
- The payment URL should reopen correctly
- After completing payment, the registration should be successful

## Troubleshooting

### Payment Not Being Detected
- Check server logs for payment verification attempts
- Verify that the payment reference matches between frontend and backend
- Ensure the polling mechanism is working correctly

### Payment Page Not Opening
- Check if the payment URL is correctly passed to the PaymentPendingScreen
- Verify that the WebBrowser.openBrowserAsync function is working
- Try manually opening the URL

### Registration Not Completing After Payment
- Check server logs for webhook/callback processing
- Verify that the registration status is being updated in the database
- Check if the ticket status is being updated correctly

## Backend Testing

To test the backend implementation directly:

```bash
# 1. Test registration endpoint
curl -X POST "https://xscard-app.onrender.com/api/events/{eventId}/register" \
  -H "Authorization: Bearer {your_token}" \
  -H "Content-Type: application/json" \
  -d '{"specialRequests":"Test registration"}'

# 2. Test payment status endpoint
curl -X GET "https://xscard-app.onrender.com/api/events/{eventId}/registration/{registrationId}/payment/status" \
  -H "Authorization: Bearer {your_token}"

# 3. Test payment callback (simulating Paystack)
curl -X GET "https://xscard-app.onrender.com/events/registration/payment/callback?reference={payment_reference}"

# 4. Test payment webhook (simulating Paystack)
curl -X POST "https://xscard-app.onrender.com/events/registration/payment/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "{payment_reference}",
      "metadata": {
        "type": "event_registration",
        "eventId": "{event_id}",
        "registrationId": "{registration_id}",
        "userId": "{user_id}",
        "ticketId": "{ticket_id}"
      }
    }
  }'
```

## Production Considerations

- Always test with Paystack test mode before going to production
- Verify all error handling scenarios
- Test on multiple devices and network conditions
- Ensure proper security measures for payment data
- Monitor payment conversion rates and abandonment 