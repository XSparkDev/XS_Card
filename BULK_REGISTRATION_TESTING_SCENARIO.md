# 🧪 Bulk Registration Testing Scenario
**Comprehensive Testing Guide for Bulk Registration Implementation**

---

## 📋 Testing Overview

This document outlines a complete testing scenario to validate the bulk registration functionality from end-to-end, covering both backend infrastructure and frontend user experience.

---

## 🎯 Test Objectives

### **Functional Testing**
- ✅ Verify bulk registration creation and processing
- ✅ Test payment integration for paid events
- ✅ Validate ticket generation and QR codes
- ✅ Confirm email notifications
- ✅ Test capacity and validation limits

### **User Experience Testing**
- ✅ Validate intuitive quantity selection
- ✅ Test attendee form functionality
- ✅ Verify real-time cost calculation
- ✅ Confirm smooth step navigation
- ✅ Test error handling and validation

### **Integration Testing**
- ✅ Backend API endpoints
- ✅ Frontend-backend communication
- ✅ Payment system integration
- ✅ Email service integration
- ✅ Database operations

---

## 🧪 Test Scenarios

### **Scenario 1: Basic Bulk Registration Flow (Free Event)**

#### **Setup**
- Create a free event with bulk registration enabled
- Event capacity: 50 people
- Current registrations: 10 people
- Current registrations: 10 people
- Available spots: 40 people

#### **Prerequisites**
1. **Enable Bulk Registration**: In the event creation form, ensure the "Bulk Registration" toggle is enabled
2. **Verify Field**: The `allowBulkRegistrations` field should be set to `true` in the database
3. **Test Enabler**: Run `node test-bulk-registration-enabler.js` to verify the field is working

#### **Test Steps**

**Step 1: Access Event Details**
```
1. Navigate to Events screen
2. Find and tap on the test event
3. Verify "Register Multiple" button is visible
4. Confirm button shows green color (#4CAF50)
```

**Step 2: Initiate Bulk Registration**
```
1. Tap "Register Multiple" button
2. Verify modal opens with step indicator
3. Confirm "Select Quantity" step is active
4. Check that quantity starts at 2
```

**Step 3: Select Quantity**
```
1. Tap "+" button to increase quantity to 5
2. Verify quantity display updates to "5"
3. Confirm cost shows "R0.00" (free event)
4. Check capacity info shows "35 spots available"
5. Tap "Next" button
```

**Step 4: Enter Attendee Details**
```
1. Verify 5 attendee forms are displayed
2. Fill first attendee:
   - Name: "John Doe"
   - Email: "john@example.com"
   - Phone: "+27123456789"
3. Fill second attendee:
   - Name: "Jane Smith"
   - Email: "jane@example.com"
   - Phone: "+27123456790"
4. Fill remaining attendees with test data
5. Verify real-time validation works
6. Tap "Next" button
```

**Step 5: Review and Confirm**
```
1. Verify event details are correct
2. Confirm attendee list shows all 5 people
3. Check total cost is R0.00
4. Tap "Proceed to Registration"
5. Verify success message appears
6. Confirm modal closes
```

**Step 6: Verify Backend Processing**
```
1. Check database for bulk_registrations record
2. Verify 5 tickets were created
3. Confirm each ticket has unique QR code
4. Check email notifications were sent
5. Verify event capacity updated correctly
```

#### **Expected Results**
- ✅ Modal opens and displays correctly
- ✅ Quantity selector works with animations
- ✅ Attendee forms validate in real-time
- ✅ Review screen shows all details correctly
- ✅ Registration completes successfully
- ✅ Database records created properly
- ✅ Tickets generated with QR codes
- ✅ Email notifications sent

---

### **Scenario 2: Paid Event Bulk Registration**

#### **Setup**
- Create a paid event with bulk registration enabled
- Ticket price: R150.00
- Event capacity: 30 people
- Current registrations: 5 people
- Available spots: 25 people

#### **Test Steps**

**Step 1: Access Event Details**
```
1. Navigate to Events screen
2. Find and tap on the paid test event
3. Verify both "Register" and "Register Multiple" buttons visible
4. Confirm pricing information is displayed
```

**Step 2: Initiate Bulk Registration**
```
1. Tap "Register Multiple" button
2. Verify modal opens
3. Confirm quantity selector shows cost calculation
```

**Step 3: Select Quantity and Verify Pricing**
```
1. Set quantity to 3 tickets
2. Verify cost calculation: R150.00 × 3 = R450.00
3. Confirm cost display shows "R450.00"
4. Check capacity info shows "22 spots available"
5. Tap "Next" button
```

**Step 4: Enter Attendee Details**
```
1. Fill attendee details for 3 people
2. Use "Copy from First" feature
3. Verify copied data is properly formatted
4. Test validation with invalid emails
5. Confirm error messages appear
6. Fix validation errors
7. Tap "Next" button
```

**Step 5: Review and Payment**
```
1. Verify cost breakdown is correct
2. Confirm attendee list is accurate
3. Tap "Proceed to Payment"
4. Verify payment URL is generated
5. Confirm payment modal/redirect works
```

**Step 6: Complete Payment**
```
1. Complete payment in test environment
2. Verify payment callback processing
3. Check bulk registration status updates
4. Confirm tickets are generated
5. Verify email notifications sent
```

#### **Expected Results**
- ✅ Real-time cost calculation works
- ✅ Payment integration functions correctly
- ✅ Payment callbacks process properly
- ✅ Tickets generated after payment
- ✅ Email notifications sent to all attendees

---

### **Scenario 3: Edge Cases and Error Handling**

#### **Test Case 3.1: Capacity Limits**
```
1. Create event with capacity: 5 people
2. Current registrations: 3 people
3. Try to register 4 people (exceeds capacity)
4. Verify error message: "Only 2 spots available"
5. Confirm increment button is disabled
```

#### **Test Case 3.2: Validation Errors**
```
1. Start bulk registration for 3 people
2. Leave required fields empty
3. Enter invalid email formats
4. Verify real-time validation errors
5. Confirm "Next" button is disabled
6. Fix validation errors
7. Verify "Next" button becomes enabled
```

#### **Test Case 3.3: Quantity Limits**
```
1. Try to set quantity to 1 (below minimum)
2. Verify error message appears
3. Try to set quantity to 51 (above maximum)
4. Confirm increment button is disabled
5. Verify appropriate error messages
```

#### **Test Case 3.4: Network Errors**
```
1. Disconnect internet connection
2. Try to submit bulk registration
3. Verify error handling and retry options
4. Reconnect internet
5. Verify retry functionality works
```

---

### **Scenario 4: Bulk Registration Management**

#### **Test Case 4.1: View Bulk Registrations**
```
1. Complete a bulk registration
2. Navigate to My Events screen
3. Verify bulk registration appears
4. Check bulk registration indicators
5. Tap on bulk registration
6. Verify detailed view shows all attendees
```

#### **Test Case 4.2: Cancel Bulk Registration**
```
1. Start bulk registration process
2. Navigate away before completing
3. Return to event details
4. Verify no partial registration exists
5. Confirm clean state for new registration
```

---

## 🔧 Technical Testing

### **Backend API Testing**

#### **Test Endpoint: POST /api/events/{eventId}/bulk-register**
```bash
# Test valid bulk registration
curl -X POST https://xscard-app.onrender.com/api/events/test-event-123/bulk-register \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3,
    "attendeeDetails": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+27123456789"
      },
      {
        "name": "Jane Smith", 
        "email": "jane@example.com",
        "phone": "+27123456790"
      },
      {
        "name": "Bob Wilson",
        "email": "bob@example.com",
        "phone": "+27123456791"
      }
    ]
  }'

# Expected Response
{
  "success": true,
  "message": "Bulk registration created successfully. Payment required.",
  "data": {
    "bulkRegistrationId": "bulk_123456",
    "paymentUrl": "https://checkout.paystack.com/...",
    "reference": "BULK_bulk_123456_1234567890",
    "totalAmount": 45000,
    "quantity": 3
  }
}
```

#### **Test Endpoint: GET /api/bulk-registrations/{bulkRegistrationId}**
```bash
curl -X GET https://xscard-app.onrender.com/api/bulk-registrations/bulk_123456 \
  -H "Authorization: Bearer {token}"

# Expected Response
{
  "success": true,
  "data": {
    "id": "bulk_123456",
    "eventId": "test-event-123",
    "userId": "user_123",
    "quantity": 3,
    "totalAmount": 45000,
    "status": "completed",
    "attendeeDetails": [...],
    "tickets": [...],
    "event": {...}
  }
}
```

### **Database Testing**

#### **Verify Bulk Registration Record**
```javascript
// Check bulk_registrations collection
const bulkReg = await db.collection('bulk_registrations').doc('bulk_123456').get();
console.log('Bulk Registration:', bulkReg.data());

// Expected structure
{
  eventId: "test-event-123",
  userId: "user_123", 
  quantity: 3,
  totalAmount: 45000,
  status: "completed",
  attendeeDetails: [...],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  ticketIds: ["ticket_1", "ticket_2", "ticket_3"]
}
```

#### **Verify Ticket Records**
```javascript
// Check tickets collection
const tickets = await db.collection('tickets')
  .where('bulkRegistrationId', '==', 'bulk_123456')
  .orderBy('attendeeIndex')
  .get();

tickets.forEach(doc => {
  console.log('Ticket:', doc.data());
});

// Expected structure for each ticket
{
  eventId: "test-event-123",
  userId: "user_123",
  attendeeName: "John Doe",
  attendeeEmail: "john@example.com", 
  attendeePhone: "+27123456789",
  ticketType: "attendee",
  status: "active",
  bulkRegistrationId: "bulk_123456",
  attendeeIndex: 1,
  qrCode: "qr_code_data",
  createdAt: Timestamp
}
```

---

## 📊 Test Results Tracking

### **Test Checklist**

#### **Frontend Components**
- [ ] QuantitySelector renders correctly
- [ ] Increment/decrement buttons work
- [ ] Cost calculation updates in real-time
- [ ] Capacity validation works
- [ ] AttendeeForm generates correct number of forms
- [ ] Form validation works in real-time
- [ ] "Copy from First" functionality works
- [ ] "Clear All" functionality works
- [ ] BulkRegistrationSummary shows correct data
- [ ] Modal navigation works smoothly
- [ ] Progress indicator updates correctly

#### **Backend API**
- [ ] POST /api/events/{eventId}/bulk-register works
- [ ] GET /api/bulk-registrations/{id} works
- [ ] GET /api/user/bulk-registrations works
- [ ] DELETE /api/bulk-registrations/{id} works
- [ ] Payment integration works
- [ ] Email notifications sent
- [ ] QR code generation works
- [ ] Database operations work correctly

#### **Integration**
- [ ] Frontend-backend communication works
- [ ] Error handling works properly
- [ ] Loading states display correctly
- [ ] Success/error messages show appropriately
- [ ] Navigation flow works end-to-end

---

## 🚀 Running the Tests

### **Prerequisites**
1. Backend server running on port 8383
2. Frontend app running
3. Test events created with bulk registration enabled
4. Test user account with valid authentication

### **Test Execution Order**
1. **Backend Infrastructure Test** - Run `node test-bulk-registration.js`
2. **API Endpoint Testing** - Use Postman or curl commands
3. **Frontend Component Testing** - Manual testing through app
4. **Integration Testing** - End-to-end user flows
5. **Edge Case Testing** - Error scenarios and limits

### **Expected Outcomes**
- ✅ All tests pass
- ✅ No console errors
- ✅ Database records created correctly
- ✅ Email notifications sent
- ✅ User experience is smooth and intuitive
- ✅ Error handling works appropriately

---

## 📝 Test Documentation

### **Bugs Found**
- [ ] Document any issues discovered
- [ ] Include steps to reproduce
- [ ] Note severity and impact
- [ ] Track resolution status

### **Performance Metrics**
- [ ] Modal open time: < 500ms
- [ ] Form validation: < 100ms
- [ ] API response time: < 2s
- [ ] Payment processing: < 5s
- [ ] Email delivery: < 30s

### **User Experience Notes**
- [ ] Intuitive flow and navigation
- [ ] Clear error messages
- [ ] Responsive design
- [ ] Accessibility compliance
- [ ] Mobile optimization

---

## 🎉 Success Criteria

The bulk registration implementation is considered **successful** when:

1. ✅ **All test scenarios pass** without errors
2. ✅ **User can complete bulk registration** in under 2 minutes
3. ✅ **Payment integration works** seamlessly
4. ✅ **Email notifications are delivered** to all attendees
5. ✅ **Tickets are generated** with unique QR codes
6. ✅ **Database integrity is maintained** throughout the process
7. ✅ **Error handling is robust** and user-friendly
8. ✅ **Performance meets** specified requirements

**Ready to begin testing!** 🚀 