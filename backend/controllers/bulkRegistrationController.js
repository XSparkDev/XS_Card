const admin = require('firebase-admin');
const db = admin.firestore();

// Reuse existing utilities and services
const { sendError } = require('./eventController');
const { generateTicketPDF, sendTicketEmail } = require('./ticketController');
const QRService = require('../services/qrService');

/**
 * Create a bulk registration for multiple attendees
 * Extends existing registration system with minimal changes
 */
const createBulkRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { quantity, attendeeDetails, paymentMethod } = req.body;
    const userId = req.user.uid;

    // Validate input
    if (!quantity || quantity < 2 || quantity > 50) {
      return sendError(res, 400, 'Invalid quantity. Must be between 2 and 50 tickets.');
    }

    if (!attendeeDetails || !Array.isArray(attendeeDetails) || attendeeDetails.length !== quantity) {
      return sendError(res, 400, 'Attendee details must match the quantity specified.');
    }

    // Get event details (reuse existing logic)
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();
    
    // Add the document ID to eventData
    eventData.id = eventId;
    
    // Check if event allows bulk registrations
    if (!eventData.allowBulkRegistrations) {
      return sendError(res, 400, 'This event does not allow bulk registrations');
    }

    // Check capacity (reuse existing logic)
    const existingRegistrations = await db.collection('event_registrations')
      .where('eventId', '==', eventId)
      .get();
    
    const totalExistingTickets = existingRegistrations.docs.reduce((sum, doc) => {
      return sum + (doc.data().quantity || 1);
    }, 0);

    // Check capacity (0 means unlimited)
    if (eventData.maxAttendees > 0 && (eventData.currentAttendees + quantity) > eventData.maxAttendees) {
      return sendError(res, 400, 'Event capacity exceeded');
    }

    // Calculate total cost (reuse existing pricing logic)
    const ticketPrice = eventData.ticketPrice || 0;
    const totalAmount = ticketPrice * quantity;

    // Create bulk registration record
    const bulkRegistrationData = {
      eventId,
      userId,
      quantity,
      totalAmount,
      status: 'pending',
      paymentMethod,
      attendeeDetails,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const bulkRegistrationRef = await db.collection('bulk_registrations').add(bulkRegistrationData);
    const bulkRegistrationId = bulkRegistrationRef.id;

    // Initialize payment if event is paid
    if (totalAmount > 0) {
      try {
        // Reuse existing payment initialization logic
        const paymentParams = {
          amount: totalAmount * 100, // Convert to kobo
          email: req.user.email,
          reference: `BULK_${bulkRegistrationId}_${Date.now()}`,
          callback_url: `${process.env.BASE_URL}/events/registration/payment/callback`,
          metadata: {
            bulkRegistrationId,
            eventId,
            userId,
            quantity,
            type: 'bulk_registration'
          }
        };

        // Get event organiser's Paystack subaccount (reuse existing logic)
        let subaccount = null;
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (!isDevelopment) {
          try {
            const organiserDoc = await db.collection('event_organisers').doc(eventData.organizerId).get();
            if (organiserDoc.exists) {
              const organiserData = organiserDoc.data();
              if (organiserData.status === 'active' && organiserData.paystackSubaccountCode) {
                subaccount = organiserData.paystackSubaccountCode;
              }
            }
          } catch (error) {
            console.error('Error fetching organiser subaccount:', error);
          }
        }

        // Add subaccount if available
        if (subaccount) {
          paymentParams.subaccount = subaccount;
          paymentParams.transaction_charge = 1000; // 10% platform fee in kobo
        }

        // Initialize payment with Paystack
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentParams),
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok) {
          throw new Error(paystackData.message || 'Payment initialization failed');
        }

        // Update bulk registration with payment reference
        await bulkRegistrationRef.update({
          paymentReference: paystackData.data.reference,
          paymentUrl: paystackData.data.authorization_url,
          paymentStatus: 'pending'
        });

        return res.json({
          success: true,
          message: 'Bulk registration created successfully. Payment required.',
          data: {
            bulkRegistrationId,
            paymentUrl: paystackData.data.authorization_url,
            reference: paystackData.data.reference,
            totalAmount,
            quantity
          }
        });

      } catch (paymentError) {
        console.error('Payment initialization error:', paymentError);
        return sendError(res, 500, 'Payment initialization failed. Please try again.');
      }
    } else {
      // Free event - process immediately
      await processBulkRegistration(bulkRegistrationId, eventData, attendeeDetails, userId);
      
      return res.json({
        success: true,
        message: 'Bulk registration completed successfully for free event.',
        data: {
          bulkRegistrationId,
          totalAmount: 0,
          quantity
        }
      });
    }

  } catch (error) {
    console.error('Bulk registration error:', error);
    return sendError(res, 500, 'Failed to create bulk registration');
  }
};

/**
 * Process a bulk registration after payment confirmation
 * Creates individual tickets and sends emails
 */
const processBulkRegistration = async (bulkRegistrationId, eventData, attendeeDetails, userId) => {
  const batch = db.batch();
  const tickets = [];

  try {
    // Create individual tickets for each attendee
    for (let i = 0; i < attendeeDetails.length; i++) {
      const attendee = attendeeDetails[i];
      
      // Create ticket (reuse existing ticket creation logic)
      const ticketData = {
        eventId: eventData.id,
        userId,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        ticketType: 'attendee',
        status: 'active',
        bulkRegistrationId,
        attendeeIndex: i + 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        qrCode: null, // Will be generated after creation
      };

      const ticketRef = db.collection('tickets').doc();
      batch.set(ticketRef, ticketData);
      
      tickets.push({
        id: ticketRef.id,
        ...ticketData
      });
    }

    // Update bulk registration status
    const bulkRegistrationRef = db.collection('bulk_registrations').doc(bulkRegistrationId);
    batch.update(bulkRegistrationRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      ticketIds: tickets.map(t => t.id)
    });

    // Commit the batch
    await batch.commit();

    // Update event attendance count
    const eventRef = db.collection('events').doc(eventData.id);
    await eventRef.update({
      currentAttendees: admin.firestore.FieldValue.increment(attendeeDetails.length)
    });

    // Generate QR codes for all tickets and send PDF ticket emails
    for (const ticket of tickets) {
      try {
        // Correct QR code generation: eventId, userId, ticketId
        const qrResult = await QRService.generateTicketQR(
          ticket.eventId,
          ticket.userId,
          ticket.id
        );
        await db.collection('tickets').doc(ticket.id).update({
          qrCode: qrResult.qrCode
        });
        // Fetch attendee info for PDF
        const attendeeName = ticket.attendeeName;
        const attendeeEmail = ticket.attendeeEmail;
        const attendeePhone = ticket.attendeePhone;
        // Compose ticket data for PDF
        const ticketData = {
          eventId: eventData.id,
          ticketId: ticket.id,
          eventTitle: eventData.title,
          eventDate: eventData.eventDate || eventData.date,
          eventTime: eventData.time || '',
          venue: eventData.location?.venue || '',
          city: eventData.location?.city || '',
          userName: attendeeName,
          qrCode: qrResult.qrDataString, // Use raw QR data string for PDF generation
          ticketStatus: ticket.status
        };
        // Generate PDF
        const pdfBuffer = await generateTicketPDF(ticketData);
        // Send PDF ticket email
        await sendTicketEmail({
          userEmail: attendeeEmail,
          userName: attendeeName,
          eventTitle: eventData.title,
          eventDate: ticketData.eventDate,
          eventTime: ticketData.eventTime,
          venue: ticketData.venue,
          city: ticketData.city,
          ticketId: ticket.id,
          pdfBuffer
        });
      } catch (qrError) {
        console.error(`Error generating QR or sending PDF for ticket ${ticket.id}:`, qrError);
      }
    }

    // Remove old bulk registration summary email logic
    // try {
    //   await sendBulkRegistrationEmail(userId, bulkRegistrationId, eventData, tickets);
    // } catch (emailError) {
    //   console.error('Error sending bulk registration email:', emailError);
    // }

    return tickets;

  } catch (error) {
    console.error('Error processing bulk registration:', error);
    throw error;
  }
};

/**
 * Get bulk registration details
 */
const getBulkRegistration = async (req, res) => {
  try {
    const { bulkRegistrationId } = req.params;
    const userId = req.user.uid;

    const bulkRegistrationDoc = await db.collection('bulk_registrations').doc(bulkRegistrationId).get();
    
    if (!bulkRegistrationDoc.exists) {
      return sendError(res, 404, 'Bulk registration not found');
    }

    const bulkRegistrationData = bulkRegistrationDoc.data();

    // Verify ownership
    if (bulkRegistrationData.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Get associated tickets
    const ticketsSnapshot = await db.collection('tickets')
      .where('bulkRegistrationId', '==', bulkRegistrationId)
      .orderBy('attendeeIndex')
      .get();

    const tickets = ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get event details
    const eventDoc = await db.collection('events').doc(bulkRegistrationData.eventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() : null;

    return res.json({
      success: true,
      data: {
        ...bulkRegistrationData,
        tickets,
        event: eventData
      }
    });

  } catch (error) {
    console.error('Get bulk registration error:', error);
    return sendError(res, 500, 'Failed to get bulk registration details');
  }
};

/**
 * Get user's bulk registrations
 */
const getUserBulkRegistrations = async (req, res) => {
  try {
    const userId = req.user.uid;

    const bulkRegistrationsSnapshot = await db.collection('bulk_registrations')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const bulkRegistrations = [];

    for (const doc of bulkRegistrationsSnapshot.docs) {
      const bulkRegistrationData = doc.data();
      
      // Get event details
      const eventDoc = await db.collection('events').doc(bulkRegistrationData.eventId).get();
      const eventData = eventDoc.exists ? eventDoc.data() : null;

      bulkRegistrations.push({
        id: doc.id,
        ...bulkRegistrationData,
        event: eventData
      });
    }

    return res.json({
      success: true,
      data: bulkRegistrations
    });

  } catch (error) {
    console.error('Get user bulk registrations error:', error);
    return sendError(res, 500, 'Failed to get bulk registrations');
  }
};

/**
 * Cancel a bulk registration (if payment is still pending)
 */
const cancelBulkRegistration = async (req, res) => {
  try {
    const { bulkRegistrationId } = req.params;
    const userId = req.user.uid;

    const bulkRegistrationDoc = await db.collection('bulk_registrations').doc(bulkRegistrationId).get();
    
    if (!bulkRegistrationDoc.exists) {
      return sendError(res, 404, 'Bulk registration not found');
    }

    const bulkRegistrationData = bulkRegistrationDoc.data();

    // Verify ownership
    if (bulkRegistrationData.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Only allow cancellation if payment is pending
    if (bulkRegistrationData.status !== 'pending') {
      return sendError(res, 400, 'Cannot cancel completed or cancelled registration');
    }

    // Delete the bulk registration
    await db.collection('bulk_registrations').doc(bulkRegistrationId).delete();

    return res.json({
      success: true,
      message: 'Bulk registration cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel bulk registration error:', error);
    return sendError(res, 500, 'Failed to cancel bulk registration');
  }
};

module.exports = {
  createBulkRegistration,
  processBulkRegistration,
  getBulkRegistration,
  getUserBulkRegistrations,
  cancelBulkRegistration
}; 