# 🏗️ Phase 1: Backend Infrastructure Implementation Layout
**Bulk Registration - Minimal Changes Approach**

---

## 📋 Phase 1 Overview

**Goal:** Implement core backend infrastructure for bulk registrations with minimal changes to existing systems.

**Timeline:** 2-3 weeks  
**Effort:** 40-50 hours  
**Risk Level:** Low (leverages existing infrastructure)

---

## 🎯 Implementation Strategy

### **Core Principle: Extend, Don't Replace**
- Reuse existing payment infrastructure
- Leverage existing ticket creation logic
- Extend existing email system
- Maintain existing API patterns

### **Minimal Database Changes**
- Add one new collection: `bulk_registrations`
- Add two fields to existing `tickets` collection
- No changes to existing `events` or `event_registrations` collections

---

## 📊 Database Schema Implementation

### **1. New Collection: `bulk_registrations`**

```javascript
// Collection: bulk_registrations
{
  id: string,                    // Auto-generated
  eventId: string,              // Reference to events collection
  purchaserId: string,          // Reference to users collection
  purchaserInfo: {
    name: string,
    email: string,
    phone: string
  },
  attendees: [                  // Array of attendee objects
    {
      name: string,
      surname: string,
      email: string,
      phone?: string,
      specialRequests?: string,
      ticketId: string,         // Generated when tickets created
      qrGenerated: boolean,     // Default: false
      emailSent: boolean        // Default: false
    }
  ],
  totalAmount: number,          // Total in cents (e.g., 75000 for R750)
  ticketPrice: number,          // Price per ticket in cents
  quantity: number,             // Number of tickets
  status: 'pending_payment' | 'completed' | 'failed' | 'cancelled',
  paymentReference: string,     // Paystack reference
  paymentUrl: string,           // Paystack payment URL
  paymentStatus: 'pending' | 'completed' | 'failed' | 'abandoned',
  createdAt: admin.firestore.Timestamp,
  updatedAt: admin.firestore.Timestamp,
  paymentCompletedAt?: admin.firestore.Timestamp
}
```

### **2. Enhanced `tickets` Collection**

```javascript
// Add to existing tickets collection schema
{
  // ... existing fields remain unchanged
  bulkRegistrationId?: string,  // NEW: Link to bulk_registrations
  attendeeIndex?: number,       // NEW: Position in bulk (0-based)
  bulkPurchaser?: {            // NEW: Purchaser info for bulk tickets
    name: string,
    email: string,
    phone: string
  }
}
```

**Migration Strategy:**
- Add fields as optional (backward compatible)
- Existing tickets remain unaffected
- New bulk tickets include these fields

---

## 🔧 Backend Controller Implementation

### **1. New Controller Functions**

#### **`initializeBulkRegistration()`**
**File:** `backend/controllers/eventController.js`  
**Function:** Create bulk registration and initialize payment

```javascript
// Add to existing eventController.js
exports.initializeBulkRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;
    const { attendees, quantity } = req.body;

    // Validation
    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return sendError(res, 400, 'Attendees array is required');
    }

    if (quantity !== attendees.length) {
      return sendError(res, 400, 'Quantity must match attendees count');
    }

    // Get event details
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();
    
    // Validate event status
    if (eventData.status !== 'published') {
      return sendError(res, 400, 'Event is not available for registration');
    }

    // Check capacity
    if (eventData.maxAttendees > 0 && 
        (eventData.currentAttendees + quantity) > eventData.maxAttendees) {
      return sendError(res, 400, 'Event capacity exceeded');
    }

    // Validate attendee data
    const validationResult = await validateBulkAttendees(attendees, eventId);
    if (!validationResult.valid) {
      return sendError(res, 400, validationResult.error);
    }

    // Calculate payment amount
    const ticketPrice = eventData.ticketPrice * 100; // Convert to cents
    const totalAmount = ticketPrice * quantity;

    // Create bulk registration record
    const bulkRegistrationId = db.collection('bulk_registrations').doc().id;
    const paymentReference = `bulk_${eventId.substring(0, 8)}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const bulkRegistrationData = {
      id: bulkRegistrationId,
      eventId,
      purchaserId: userId,
      purchaserInfo: await getUserInfo(userId),
      attendees: attendees.map((attendee, index) => ({
        ...attendee,
        ticketId: '', // Will be generated after payment
        qrGenerated: false,
        emailSent: false
      })),
      totalAmount,
      ticketPrice,
      quantity,
      status: 'pending_payment',
      paymentReference,
      paymentUrl: '', // Will be set after payment initialization
      paymentStatus: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    // Initialize payment (reuse existing payment logic)
    const paymentResult = await initializeBulkPayment(bulkRegistrationData, eventData);
    
    if (!paymentResult.success) {
      return sendError(res, 500, 'Failed to initialize payment');
    }

    // Update bulk registration with payment URL
    bulkRegistrationData.paymentUrl = paymentResult.paymentUrl;

    // Save bulk registration
    await db.collection('bulk_registrations').doc(bulkRegistrationId).set(bulkRegistrationData);

    res.status(200).json({
      success: true,
      message: 'Bulk registration initialized successfully',
      bulkRegistrationId,
      paymentUrl: paymentResult.paymentUrl,
      paymentReference,
      totalAmount: totalAmount / 100, // Convert back to regular currency
      quantity
    });

  } catch (error) {
    console.error('Error initializing bulk registration:', error);
    sendError(res, 500, 'Failed to initialize bulk registration', error);
  }
};
```

#### **`validateBulkAttendees()`**
**File:** `backend/controllers/eventController.js`  
**Function:** Validate attendee data for bulk registration

```javascript
// Helper function for bulk registration validation
const validateBulkAttendees = async (attendees, eventId) => {
  try {
    // Check for duplicate emails within the bulk registration
    const emails = attendees.map(a => a.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    
    if (emails.length !== uniqueEmails.size) {
      return { valid: false, error: 'Duplicate emails found in bulk registration' };
    }

    // Check for existing registrations (any attendee already registered)
    for (const attendee of attendees) {
      const existingRegistration = await db.collection('event_registrations')
        .where('eventId', '==', eventId)
        .where('userInfo.email', '==', attendee.email)
        .limit(1)
        .get();

      if (!existingRegistration.empty) {
        return { 
          valid: false, 
          error: `${attendee.email} is already registered for this event` 
        };
      }
    }

    // Validate required fields
    for (const attendee of attendees) {
      if (!attendee.name || !attendee.surname || !attendee.email) {
        return { 
          valid: false, 
          error: 'Name, surname, and email are required for all attendees' 
        };
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(attendee.email)) {
        return { 
          valid: false, 
          error: `Invalid email format: ${attendee.email}` 
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating bulk attendees:', error);
    return { valid: false, error: 'Validation error occurred' };
  }
};
```

#### **`initializeBulkPayment()`**
**File:** `backend/controllers/eventController.js`  
**Function:** Initialize payment for bulk registration (reuse existing payment logic)

```javascript
// Helper function for bulk payment initialization
const initializeBulkPayment = async (bulkRegistrationData, eventData) => {
  try {
    const baseUrl = process.env.APP_URL;
    const paymentAmount = bulkRegistrationData.totalAmount;
    const paymentReference = bulkRegistrationData.paymentReference;

    // Prepare payment parameters (reuse existing payment logic)
    const paymentParams = {
      email: bulkRegistrationData.purchaserInfo.email,
      amount: paymentAmount,
      reference: paymentReference,
      callback_url: `${baseUrl}/events/registration/payment/callback?ref=${paymentReference}&type=bulk`,
      metadata: {
        eventId: bulkRegistrationData.eventId,
        purchaserId: bulkRegistrationData.purchaserId,
        bulkRegistrationId: bulkRegistrationData.id,
        type: 'bulk_registration',
        quantity: bulkRegistrationData.quantity,
        organiser_id: eventData.organizerId
      }
    };

    // Add subaccount if available (reuse existing logic)
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_BANK_VERIFICATION === 'true';
    
    try {
      const organiserDoc = await db.collection('event_organisers').doc(eventData.organizerId).get();
      if (organiserDoc.exists) {
        const organiserData = organiserDoc.data();
        if (organiserData.status === 'active' && organiserData.paystackSubaccountCode) {
          if (!isDevelopment) {
            paymentParams.subaccount = organiserData.paystackSubaccountCode;
            paymentParams.transaction_charge = 1000; // 10% platform fee
          }
        }
      }
    } catch (error) {
      console.error('Error fetching organiser subaccount:', error);
    }

    // Make Paystack API request (reuse existing payment logic)
    const paymentResponse = await new Promise((resolve, reject) => {
      const params = JSON.stringify(paymentParams);
      
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const paymentReq = https.request(options, paymentRes => {
        let data = '';
        paymentRes.on('data', (chunk) => { data += chunk; });
        paymentRes.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      paymentReq.on('error', (error) => { reject(error); });
      paymentReq.write(params);
      paymentReq.end();
    });

    if (!paymentResponse.status) {
      return { success: false, error: paymentResponse.message };
    }

    return { 
      success: true, 
      paymentUrl: paymentResponse.data.authorization_url 
    };

  } catch (error) {
    console.error('Error initializing bulk payment:', error);
    return { success: false, error: error.message };
  }
};
```

### **2. Enhanced Existing Functions**

#### **Enhanced Payment Callback Handler**
**File:** `backend/controllers/eventController.js`  
**Function:** Extend existing `handleRegistrationPaymentCallback()` to handle bulk registrations

```javascript
// Add to existing handleRegistrationPaymentCallback function
exports.handleRegistrationPaymentCallback = async (req, res) => {
  try {
    const { ref: paymentReference, type } = req.query;
    
    // Check if this is a bulk registration payment
    if (type === 'bulk') {
      return await handleBulkRegistrationPaymentCallback(req, res);
    }
    
    // Existing individual registration logic continues unchanged
    // ... existing code ...
  } catch (error) {
    console.error('Error handling registration payment callback:', error);
    return res.redirect(`/event-payment-failed.html?reason=server_error&type=registration`);
  }
};
```

#### **New Bulk Payment Callback Handler**
**File:** `backend/controllers/eventController.js`  
**Function:** Handle bulk registration payment completion

```javascript
// New function for bulk registration payment callback
const handleBulkRegistrationPaymentCallback = async (req, res) => {
  try {
    const { ref: paymentReference } = req.query;
    
    // Verify payment with Paystack (reuse existing verification logic)
    const verified = await verifyPaystackTransaction(paymentReference);
    
    if (!verified.success) {
      console.error('Bulk payment verification failed:', verified);
      return res.redirect(`/event-payment-failed.html?reason=verification_failed&type=bulk_registration`);
    }

    // Get bulk registration
    const bulkRegistrationsSnapshot = await db.collection('bulk_registrations')
      .where('paymentReference', '==', paymentReference)
      .limit(1)
      .get();

    if (bulkRegistrationsSnapshot.empty) {
      console.error(`Bulk registration not found for payment: ${paymentReference}`);
      return res.redirect(`/event-payment-failed.html?reason=registration_not_found&type=bulk_registration`);
    }

    const bulkRegistrationDoc = bulkRegistrationsSnapshot.docs[0];
    const bulkRegistrationData = bulkRegistrationDoc.data();

    // Check if already processed
    if (bulkRegistrationData.status === 'completed') {
      return res.redirect(`/event-payment-success.html?eventId=${bulkRegistrationData.eventId}&type=bulk_registration&bulkId=${bulkRegistrationData.id}`);
    }

    // Update bulk registration status
    await bulkRegistrationDoc.ref.update({
      status: 'completed',
      paymentStatus: 'completed',
      paymentCompletedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Create individual tickets for each attendee
    const ticketCreationPromises = bulkRegistrationData.attendees.map(async (attendee, index) => {
      const ticketId = db.collection('tickets').doc().id;
      
      const ticketData = {
        id: ticketId,
        eventId: bulkRegistrationData.eventId,
        userId: bulkRegistrationData.purchaserId, // Purchaser is the ticket holder
        userInfo: {
          name: attendee.name,
          email: attendee.email,
          phone: attendee.phone || ''
        },
        status: 'active',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        specialRequests: attendee.specialRequests || '',
        ticketType: 'paid',
        ticketPrice: bulkRegistrationData.ticketPrice / 100, // Convert back to regular currency
        paymentReference: paymentReference,
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
        qrGenerated: false,
        qrGeneratedAt: null,
        // NEW: Bulk registration fields
        bulkRegistrationId: bulkRegistrationData.id,
        attendeeIndex: index,
        bulkPurchaser: bulkRegistrationData.purchaserInfo
      };

      // Create ticket
      await db.collection('tickets').doc(ticketId).set(ticketData);

      // Update attendee with ticket ID
      await bulkRegistrationDoc.ref.update({
        [`attendees.${index}.ticketId`]: ticketId
      });

      return ticketData;
    });

    await Promise.all(ticketCreationPromises);

    // Update event attendee count
    await db.collection('events').doc(bulkRegistrationData.eventId).update({
      currentAttendees: admin.firestore.FieldValue.increment(bulkRegistrationData.quantity),
      attendeesList: admin.firestore.FieldValue.arrayUnion(bulkRegistrationData.purchaserId)
    });

    // Send confirmation emails (async, don't wait)
    sendBulkRegistrationEmails(bulkRegistrationData).catch(error => {
      console.error('Error sending bulk registration emails:', error);
    });

    // Redirect to success page
    return res.redirect(`/event-payment-success.html?eventId=${bulkRegistrationData.eventId}&type=bulk_registration&bulkId=${bulkRegistrationData.id}`);

  } catch (error) {
    console.error('Error handling bulk registration payment callback:', error);
    return res.redirect(`/event-payment-failed.html?reason=server_error&type=bulk_registration`);
  }
};
```

---

## 📧 Email System Enhancement

### **New Email Function**
**File:** `backend/controllers/eventController.js`  
**Function:** Send bulk registration confirmation emails

```javascript
// New function for sending bulk registration emails
const sendBulkRegistrationEmails = async (bulkRegistrationData) => {
  try {
    // Send individual emails to each attendee
    const emailPromises = bulkRegistrationData.attendees.map(async (attendee, index) => {
      try {
        // Generate QR code for this ticket
        const qrResult = await QRService.generateTicketQR(
          bulkRegistrationData.eventId,
          bulkRegistrationData.purchaserId,
          attendee.ticketId
        );

        // Send individual ticket email
        await sendMailWithStatus({
          to: attendee.email,
          subject: `Your Ticket for ${bulkRegistrationData.eventTitle || 'Event'}`,
          html: generateIndividualTicketEmail(attendee, bulkRegistrationData, qrResult)
        });

        // Update attendee email status
        await db.collection('bulk_registrations').doc(bulkRegistrationData.id).update({
          [`attendees.${index}.emailSent`]: true
        });

      } catch (error) {
        console.error(`Error sending email to ${attendee.email}:`, error);
      }
    });

    await Promise.all(emailPromises);

    // Send summary email to purchaser
    await sendMailWithStatus({
      to: bulkRegistrationData.purchaserInfo.email,
      subject: `Bulk Registration Confirmation - ${bulkRegistrationData.quantity} tickets`,
      html: generateBulkSummaryEmail(bulkRegistrationData)
    });

  } catch (error) {
    console.error('Error sending bulk registration emails:', error);
  }
};
```

---

## 🛣️ API Routes Implementation

### **New Routes**
**File:** `backend/routes/eventRoutes.js`  
**Add these routes:**

```javascript
// Bulk Registration Routes (add to existing routes)
router.post('/events/:eventId/register/bulk', 
  authenticateUser,
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterRegistration),
  eventController.initializeBulkRegistration
);

// Enhanced existing route to handle bulk registrations
// The existing payment callback route will be enhanced to handle both individual and bulk
```

---

## 🧪 Testing Strategy

### **Unit Tests**
```javascript
// Test files to create:
- test/controllers/bulkRegistration.test.js
- test/validation/bulkAttendees.test.js
- test/payment/bulkPayment.test.js
```

### **Integration Tests**
```javascript
// Test scenarios:
1. Valid bulk registration flow
2. Invalid attendee data handling
3. Payment failure scenarios
4. Email delivery testing
5. Capacity limit testing
```

---

## 📋 Implementation Checklist

### **Week 1: Database & Core Logic**
- [ ] Create `bulk_registrations` collection schema
- [ ] Add fields to `tickets` collection
- [ ] Implement `validateBulkAttendees()` function
- [ ] Implement `initializeBulkPayment()` function
- [ ] Create unit tests for validation logic

### **Week 2: Registration & Payment**
- [ ] Implement `initializeBulkRegistration()` controller
- [ ] Enhance payment callback to handle bulk registrations
- [ ] Implement `handleBulkRegistrationPaymentCallback()` function
- [ ] Add API routes for bulk registration
- [ ] Test payment flow end-to-end

### **Week 3: Email & Integration**
- [ ] Implement `sendBulkRegistrationEmails()` function
- [ ] Create email templates for bulk registrations
- [ ] Integrate with existing QR code generation
- [ ] Add error handling and rollback mechanisms
- [ ] Performance testing with large groups

---

## 🚨 Risk Mitigation

### **Data Consistency**
- Use database transactions for bulk operations
- Implement rollback mechanisms for failed operations
- Add comprehensive error logging

### **Payment Security**
- Reuse existing payment verification logic
- Add additional validation for bulk payment amounts
- Implement payment timeout handling

### **Email Delivery**
- Use async email sending to prevent blocking
- Implement email retry mechanisms
- Add email delivery status tracking

---

## 📊 Success Metrics

### **Technical Metrics**
- Bulk registration success rate > 95%
- Payment processing time < 5 seconds
- Email delivery rate > 99%
- Zero data consistency issues

### **Business Metrics**
- Average bulk registration size: 3-5 tickets
- Bulk registration conversion rate > 90%
- Reduced individual registration abandonment

---

**Phase 1 Status:** Ready for Implementation  
**Next Phase:** Frontend Integration  
**Estimated Completion:** 3 weeks 