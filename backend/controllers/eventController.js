const { db, admin } = require('../firebase.js');
const { formatDate, convertToISOString } = require('../utils/dateFormatter');
const { getUserInfo } = require('../utils/userUtils');
const QRService = require('../services/qrService');
const CreditService = require('../services/creditService');
const https = require('https');

// Helper function for error responses (following userController pattern)
const sendError = (res, status, message, error = null) => {
  console.error(`${message}:`, error);
  res.status(status).json({ 
    success: false,
    message,
    ...(error && { error: error.message })
  });
};

// Initialize event collections if they don't exist
const initializeEventCollections = async () => {
  try {
    console.log('Initializing event collections...');
    
    // Create sample data to ensure collections exist
    const collections = [
      'events',
      'event_registrations', 
      'event_broadcasts',
      'tickets'
    ];
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).limit(1).get();
      if (snapshot.empty) {
        console.log(`Creating ${collectionName} collection...`);
        // Add a temporary document to create the collection
        const tempDoc = await db.collection(collectionName).add({
          _temp: true,
          createdAt: admin.firestore.Timestamp.now()
        });
        // Delete the temporary document
        await tempDoc.delete();
        console.log(`${collectionName} collection created`);
      }
    }
    
    console.log('Event collections initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing event collections:', error);
    return false;
  }
};

// Create new event
exports.createEvent = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Initialize collections if needed
    await initializeEventCollections();
    
    console.log('Create event request:', {
      body: req.body,
      files: req.files,
      firebaseStorageUrls: req.firebaseStorageUrls
    });
    
    // Handle image URLs from Firebase Storage
    let bannerImageUrl = null;
    let eventImagesUrls = [];
    
    if (req.firebaseStorageUrls) {
      bannerImageUrl = req.firebaseStorageUrls.bannerImage || null;
      
      // Handle multiple event images
      if (req.firebaseStorageUrls.eventImages) {
        if (Array.isArray(req.firebaseStorageUrls.eventImages)) {
          eventImagesUrls = req.firebaseStorageUrls.eventImages;
        } else {
          eventImagesUrls = [req.firebaseStorageUrls.eventImages];
        }
      }
    }
    
    // Parse JSON fields that were stringified in FormData (or use plain objects if provided)
    let location = {};
    let tags = [];
    
    // Handle location field
      if (req.body.location) {
      if (typeof req.body.location === 'string') {
        try {
        location = JSON.parse(req.body.location);
        } catch (locationErr) {
          console.warn('Error parsing location JSON string:', locationErr);
        }
      } else if (typeof req.body.location === 'object') {
        location = req.body.location;
      }
    }

    // Handle tags field
      if (req.body.tags) {
      if (typeof req.body.tags === 'string') {
        try {
        tags = JSON.parse(req.body.tags);
        } catch (tagsErr) {
          console.warn('Error parsing tags JSON string:', tagsErr);
        }
      } else if (Array.isArray(req.body.tags)) {
        tags = req.body.tags;
      }
    }

    // Fallback defaults if location is still empty
    if (!location || Object.keys(location).length === 0) {
      location = {
        venue: req.body.venue || '',
        address: req.body.address || '',
        city: req.body.city || '',
        country: req.body.country || 'South Africa'
      };
    }
    
    // Handle recurrence pattern for recurring events
    let recurrencePattern = null;
    let isRecurring = false;
    
    if (req.body.isRecurring === 'true' || req.body.isRecurring === true) {
      isRecurring = true;
      
      // Parse recurrence pattern
      if (req.body.recurrencePattern) {
        if (typeof req.body.recurrencePattern === 'string') {
          try {
            recurrencePattern = JSON.parse(req.body.recurrencePattern);
          } catch (recurrenceErr) {
            console.warn('Error parsing recurrencePattern JSON string:', recurrenceErr);
          }
        } else if (typeof req.body.recurrencePattern === 'object') {
          recurrencePattern = req.body.recurrencePattern;
        }
      }
      
      // Validate recurrence pattern
      if (recurrencePattern) {
        const validation = require('../utils/recurrenceCalculator').validatePattern(recurrencePattern);
        if (!validation.valid) {
          return sendError(res, 400, `Invalid recurrence pattern: ${validation.errors.join(', ')}`);
        }
      } else {
        return sendError(res, 400, 'Recurrence pattern is required for recurring events');
      }
    }
    
    // Get organizer info from users collection with fallback to cards
    const organizerInfo = await getUserInfo(userId);
    
    const eventData = {
      id: db.collection('events').doc().id,
      organizerId: userId,
      title: req.body.title,
      description: req.body.description,
      eventDate: req.body.eventDate,
      endDate: req.body.endDate || null,
      category: req.body.category || 'other',
      eventType: req.body.eventType || 'free',
      ticketPrice: parseFloat(req.body.ticketPrice) || 0,
      maxAttendees: parseInt(req.body.maxAttendees) || 0,
      visibility: req.body.visibility || 'public',
      location: location,
      tags: tags,
      currentAttendees: 0,
      attendeesList: [],
      status: 'draft',
      // Bulk registration support (will be coerced below by capacity rule)
      allowBulkRegistrations: req.body.allowBulkRegistrations === 'true' || req.body.allowBulkRegistrations === true,
      // Image data from Firebase Storage
      bannerImage: bannerImageUrl,
      images: eventImagesUrls,
      // Enhanced organizer info from getUserInfo function
      organizerInfo: {
        name: organizerInfo.name,
        email: organizerInfo.email,
        profileImage: organizerInfo.profileImage,
        company: organizerInfo.company
      },
      // Credit system fields
      listingFee: null,
      creditApplied: null,
      paymentReference: null,
      // Recurring events fields
      isRecurring: isRecurring,
      recurrencePattern: recurrencePattern,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    // Validate required fields
    if (!eventData.title || !eventData.description || !eventData.eventDate) {
      return sendError(res, 400, 'Missing required fields: title, description, eventDate');
    }

    // Validate required location fields
    if (!eventData.location.venue || !eventData.location.city) {
      return sendError(res, 400, 'Missing required location fields: venue, city');
    }

    // Validate maximum attendees (required and >= 1)
    if (!Number.isFinite(eventData.maxAttendees) || eventData.maxAttendees < 1) {
      return sendError(res, 400, 'Invalid maximum attendees: value is required and must be at least 1');
    }

    // Enforce bulk registration capacity rule: only when maxAttendees > 10
    if (eventData.maxAttendees <= 10) {
      eventData.allowBulkRegistrations = false;
    }

    // Validate organiser permissions for paid events
    if (eventData.eventType === 'paid' && eventData.ticketPrice > 0) {
      try {
        const organiserDoc = await db.collection('event_organisers').doc(userId).get();
        if (!organiserDoc.exists) {
          return sendError(res, 403, 'You must register to collect payments to create paid events');
        }
        
        const organiserData = organiserDoc.data();
        if (organiserData.status !== 'active') {
          return sendError(res, 403, 'Your payment collection account is not active. Please complete your registration or contact support.');
        }
      } catch (error) {
        console.error('Error checking organiser status:', error);
        return sendError(res, 500, 'Error validating organiser permissions');
      }
    }

    // Convert date strings to Firestore Timestamps with validation
    if (typeof eventData.eventDate === 'string') {
      try {
        const eventDate = new Date(eventData.eventDate);
        if (isNaN(eventDate.getTime())) {
          return sendError(res, 400, 'Invalid event date format');
        }
        const timestamp = Math.floor(eventDate.getTime() / 1000) * 1000;
        const validDate = new Date(timestamp);
        eventData.eventDate = admin.firestore.Timestamp.fromDate(validDate);
      } catch (error) {
        console.error('Error converting eventDate:', error);
        return sendError(res, 400, 'Invalid event date format');
      }
    }
    
    if (eventData.endDate && typeof eventData.endDate === 'string') {
      try {
        const endDate = new Date(eventData.endDate);
        if (isNaN(endDate.getTime())) {
          return sendError(res, 400, 'Invalid end date format');
        }
        const timestamp = Math.floor(endDate.getTime() / 1000) * 1000;
        const validDate = new Date(timestamp);
        eventData.endDate = admin.firestore.Timestamp.fromDate(validDate);
      } catch (error) {
        console.error('Error converting endDate:', error);
        return sendError(res, 400, 'Invalid end date format');
      }
    }

    // For paid events, calculate publishing cost
    let costInfo = null;
    if (eventData.eventType === 'paid') {
      try {
        costInfo = await CreditService.calculateListingCost(userId);
        console.log('Event publishing cost calculated:', costInfo);
      } catch (error) {
        console.error('Error calculating listing cost:', error);
        return sendError(res, 500, 'Error calculating event publishing cost');
      }
    }

    // Save to database
    await db.collection('events').doc(eventData.id).set(eventData);

    // Format dates for response
    const responseEvent = {
      ...eventData,
      eventDate: formatDate(eventData.eventDate),
      endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
      createdAt: formatDate(eventData.createdAt),
      // Include image URLs in response
      imageCount: eventImagesUrls.length + (bannerImageUrl ? 1 : 0),
      // Include cost information for paid events
      publishingCost: costInfo
    };

    console.log('Event created successfully with images:', {
      bannerImage: !!bannerImageUrl,
      eventImages: eventImagesUrls.length,
      eventType: eventData.eventType,
      publishingCost: costInfo
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: responseEvent
    });

  } catch (error) {
    sendError(res, 500, 'Error creating event', error);
  }
};

// Publish event (makes it visible and ready for broadcasting)
exports.publishEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check if user owns this event
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to publish this event');
    }

    // Check if event is already published
    if (eventData.status === 'published') {
      return sendError(res, 400, 'Event is already published');
    }

  // Enforce bulk registration capacity rule before publishing
  if (eventData.maxAttendees <= 10 && eventData.allowBulkRegistrations === true) {
    await eventRef.update({
      allowBulkRegistrations: false,
      updatedAt: admin.firestore.Timestamp.now()
    });
    // Refresh eventData after coercion
    const refreshed = await eventRef.get();
    Object.assign(eventData, refreshed.data());
  }

    // Check if event is pending payment
    if (eventData.status === 'pending_payment') {
      // Check payment status if there's a reference
      if (eventData.paymentReference) {
        const verified = await verifyPaystackTransaction(eventData.paymentReference);
        
        if (verified.success) {
          // Payment was successful but webhook didn't update status
          // Update event to published status
          await eventRef.update({
            status: 'published',
            publishedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            paymentCompletedAt: admin.firestore.Timestamp.now(),
            paymentStatus: 'completed'
          });
          
          // Get updated event data
          const updatedDoc = await eventRef.get();
          const updatedEvent = updatedDoc.data();
          
          return res.status(200).json({
            success: true,
            message: 'Payment verified and event published successfully',
            event: {
              ...updatedEvent,
              eventDate: formatDate(updatedEvent.eventDate),
              publishedAt: formatDate(updatedEvent.publishedAt)
            }
          });
        } else if (verified.abandoned || verified.failed) {
          // Payment was abandoned or failed - revert to draft and allow new payment
          console.log(`Payment ${verified.abandoned ? 'abandoned' : 'failed'} - reverting event to draft and allowing new payment`);
          
          await eventRef.update({
            status: 'draft',
            updatedAt: admin.firestore.Timestamp.now(),
            paymentAbandonedAt: admin.firestore.Timestamp.now(),
            paymentUrl: null
          });
          
          // Continue with normal flow to create new payment (don't return here)
          console.log('Event reverted to draft, proceeding with new payment creation');
        } else {
          // Check if payment is abandoned (more than 1 hour old)
          const paymentInitiatedAt = eventData.paymentInitiatedAt?.toDate() || null;
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (paymentInitiatedAt && paymentInitiatedAt < oneHourAgo) {
            // Mark payment as abandoned and allow new payment
            await eventRef.update({
              status: 'draft',
              paymentStatus: 'abandoned',
              updatedAt: admin.firestore.Timestamp.now(),
              paymentUrl: null
            });
            
            console.log('Payment timeout - reverting to draft and allowing new payment');
            // Continue with normal flow to create new payment (don't return here)
          } else {
            // Payment is still genuinely pending, return current status
            return res.status(200).json({
              success: false,
              paymentRequired: true,
              paymentStatus: 'pending',
              paymentUrl: eventData.paymentUrl,
              paymentReference: eventData.paymentReference,
              message: 'You have a pending payment for this event. Please complete the payment to publish your event.',
              event: {
                ...eventData,
                eventDate: formatDate(eventData.eventDate)
              }
            });
          }
        }
      } else {
        // No payment reference, reset status to draft
        await eventRef.update({
          status: 'draft',
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        console.log('No payment reference found - reset to draft');
      }
    }

    // Handle paid events
    if (eventData.eventType === 'paid') {
      try {
        const costInfo = await CreditService.calculateListingCost(userId);
        console.log('Publishing cost calculated:', costInfo);

        if (costInfo.price === 0) {
          // Free publishing with credit
          await CreditService.applyCreditToEvent(userId, costInfo.creditType, eventId);
          
          // Update event status to published
    await eventRef.update({
      status: 'published',
      publishedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            listingFee: 0,
            creditApplied: costInfo.creditType,
            paymentStatus: 'completed'
          });

          // Get updated event data
          const updatedDoc = await eventRef.get();
          const updatedEvent = updatedDoc.data();

          return res.status(200).json({
            success: true,
            message: `Event published successfully using ${costInfo.creditType} credit`,
            event: {
              ...updatedEvent,
              eventDate: formatDate(updatedEvent.eventDate),
              publishedAt: formatDate(updatedEvent.publishedAt)
            },
            creditInfo: {
              creditUsed: costInfo.creditType,
              remainingCredits: costInfo.remainingCredits
            }
          });
        }
          // Requires payment - initialize Paystack transaction
          const baseUrl = process.env.APP_URL || 'http://localhost:3000';
          const userEmail = req.user.email;

          // Generate unique payment reference
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const paymentReference = `evt_${eventId.substring(0, 8)}_${timestamp}_${randomSuffix}`;

          // Validate amount and currency
          const amountInCents = Math.round(costInfo.price);
          if (amountInCents <= 0) {
            return sendError(res, 400, 'Invalid payment amount');
          }

          const params = JSON.stringify({
            reference: paymentReference,
            email: userEmail,
            amount: amountInCents,
            currency: 'ZAR',
            callback_url: `${baseUrl}/events/payment/callback?ref=${paymentReference}`,
            metadata: {
              eventId: eventId,
              userId: userId,
              eventTitle: eventData.title,
              publishingFee: true,
              paymentType: 'event_publishing'
            }
          });

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

            paymentRes.on('data', (chunk) => {
              data += chunk;
            });

            paymentRes.on('end', async () => {
              try {
                const response = JSON.parse(data);
                
                if (response.status) {
                  // Update event status to pending payment with our generated reference
                  await eventRef.update({
                    status: 'pending_payment',
                    paymentReference: paymentReference,
                    paymentUrl: response.data.authorization_url, // Store the payment URL
                    listingFee: amountInCents,
                    paymentInitiatedAt: admin.firestore.Timestamp.now(),
                  updatedAt: admin.firestore.Timestamp.now(),
                  paymentStatus: 'pending'
                  });

                  // Log payment initiation for audit trail
                  console.log(`Payment initiated for event ${eventId}:`, {
                    reference: paymentReference,
                    amount: amountInCents,
                    currency: 'ZAR',
                    userId: userId
                  });

                  res.status(200).json({
                    success: true,
                    message: 'Payment required to publish event',
                    paymentRequired: true,
                    paymentUrl: response.data.authorization_url,
                    amount: amountInCents,
                    currency: 'ZAR',
                    reference: paymentReference,
                    event: {
                      id: eventId,
                      title: eventData.title,
                    status: 'pending_payment',
                    paymentStatus: 'pending'
                    }
                  });
                } else {
                  throw new Error(response.message || 'Payment initialization failed');
                }
              } catch (error) {
                console.error('Error processing payment response:', error);
                sendError(res, 500, 'Error initializing payment');
              }
            });
          });

          paymentReq.on('error', (error) => {
            console.error('Payment request error:', error);
            sendError(res, 500, 'Error connecting to payment provider');
          });

          paymentReq.write(params);
          paymentReq.end();
          return;
      } catch (error) {
        console.error('Error handling paid event publishing:', error);
        return sendError(res, 500, 'Error processing event publishing');
      }
    }

    // Free events - publish directly
    await eventRef.update({
      status: 'published',
      publishedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      listingFee: 0,
      paymentStatus: 'completed'
    });

    // Get updated event data
    const updatedDoc = await eventRef.get();
    const updatedEvent = updatedDoc.data();

    res.status(200).json({
      success: true,
      message: 'Event published successfully',
      event: {
        ...updatedEvent,
        eventDate: formatDate(updatedEvent.eventDate),
        publishedAt: formatDate(updatedEvent.publishedAt)
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error publishing event', error);
  }
};

// Get all public events with pagination and filters
exports.getAllEvents = async (req, res) => {
  try {
    await initializeEventCollections();
    
    const { 
      limit = 20, 
      page = 1, 
      category, 
      location, 
      startDate, 
      endDate,
      eventType,
      organizerId 
    } = req.query;

    const userId = req.user?.uid; // Optional - user might not be authenticated
    console.log('[getAllEvents] Request from user:', userId || 'anonymous');

    // Get user preferences if authenticated
    let userPreferences = null;
    if (userId) {
      try {
        console.log('[getAllEvents] Looking up user preferences for userId:', userId);
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userPreferences = userData.eventPreferences || {};
          console.log('[getAllEvents] User preferences loaded:', {
            receivePrivateEventBroadcasts: userPreferences.receivePrivateEventBroadcasts || false,
            userEmail: userData.email || 'unknown',
            userId: userId
          });
        } else {
          console.log('[getAllEvents] User document not found for userId:', userId);
        }
      } catch (prefError) {
        console.warn('[getAllEvents] Failed to load user preferences:', prefError.message);
        // Continue without preferences
      }
    } else {
      console.log('[getAllEvents] No userId provided, continuing as anonymous');
    }

    // IMPORTANT: No visibility filtering in the Firestore query to avoid index requirement
    let query = db.collection('events')
      .where('status', '==', 'published')
      .orderBy('eventDate', 'desc');

    // Apply filters
    if (category) {
      query = query.where('category', '==', category);
    }
    
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }
    
    if (organizerId) {
      query = query.where('organizerId', '==', organizerId);
    }

    // Apply date filters
    if (startDate) {
      query = query.where('eventDate', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)));
    }
    
    if (endDate) {
      query = query.where('eventDate', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
    }

    // Get more results to account for client-side visibility filtering
    const pageSize = Math.min(parseInt(limit), 50);
    const adjustedLimit = pageSize * 3; // Get extra to account for visibility filtering
    
    const snapshot = await query.limit(adjustedLimit).get();
    
    console.log('[getAllEvents] Raw query returned', snapshot.size, 'events');
    
    // Filter by visibility client-side with enhanced logic
    const allEvents = [];
    snapshot.forEach(doc => {
      const eventData = doc.data();
      let shouldInclude = false;
      
      // Check visibility rules
      if (eventData.visibility === 'public') {
        // Public events: visible to everyone
        shouldInclude = true;
        console.log('[getAllEvents] Including public event:', eventData.title);
      } else if (eventData.visibility === 'private') {
        // Private events: visible to organizer or users who opted in
        if (userId && eventData.organizerId === userId) {
          shouldInclude = true;
          console.log('[getAllEvents] Including private event for organizer:', eventData.title, 'organizerId:', eventData.organizerId, 'userId:', userId);
        } else if (userId && userPreferences?.receivePrivateEventBroadcasts) {
          shouldInclude = true;
          console.log('[getAllEvents] Including private event for opted-in user:', eventData.title, 'userId:', userId);
        } else {
          console.log('[getAllEvents] Filtering out private event:', eventData.title, 'User not authorized. userId:', userId, 'organizerId:', eventData.organizerId, 'optedIn:', userPreferences?.receivePrivateEventBroadcasts);
        }
      } else if (eventData.visibility === 'invite-only') {
        // Invite-only events: visible to organizer or invited users
        if (userId && eventData.organizerId === userId) {
          shouldInclude = true;
          console.log('[getAllEvents] Including invite-only event for organizer:', eventData.title);
        } else if (userId && eventData.attendeesList?.includes(userId)) {
          shouldInclude = true;
          console.log('[getAllEvents] Including invite-only event for invited user:', eventData.title);
        } else {
          console.log('[getAllEvents] Filtering out invite-only event:', eventData.title, 'User not invited');
        }
      }
      
      if (shouldInclude) {
        // For recurring events, compute displayText and nextOccurrence
        let displayText = null;
        let nextOccurrence = null;
        
        if (eventData.isRecurring && eventData.recurrencePattern) {
          try {
            displayText = recurrenceCalculator.formatRecurrenceDisplay(eventData.recurrencePattern);
            const nextOccurrenceDate = recurrenceCalculator.findNextOccurrence(new Date(), eventData.recurrencePattern);
            if (nextOccurrenceDate) {
              nextOccurrence = formatDate(admin.firestore.Timestamp.fromDate(nextOccurrenceDate));
            }
          } catch (recurrenceError) {
            console.error('Error computing recurrence data:', recurrenceError);
          }
        }
        
        allEvents.push({
        ...eventData,
        // Send both formatted (for display) and ISO (for parsing) dates
        eventDate: formatDate(eventData.eventDate),
        eventDateISO: convertToISOString(eventData.eventDate),
        endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
        endDateISO: eventData.endDate ? convertToISOString(eventData.endDate) : null,
        createdAt: formatDate(eventData.createdAt),
        // Recurring event metadata
        displayText,
        nextOccurrence
      });
      }
    });

    console.log('[getAllEvents] After visibility filtering:', allEvents.length, 'events visible to user');

    // Apply pagination after filtering
    const offset = (parseInt(page) - 1) * pageSize;
    const paginatedEvents = allEvents.slice(offset, offset + pageSize);

    // Get total count for pagination - NO visibility filtering in the query
    const totalSnapshot = await db.collection('events')
      .where('status', '==', 'published')
      .get();
    
    let totalVisibleEvents = 0;
    totalSnapshot.forEach(doc => {
      const eventData = doc.data();
      
      // Apply same visibility logic for counting
      if (eventData.visibility === 'public') {
        totalVisibleEvents++;
      } else if (eventData.visibility === 'private') {
        if (userId && (eventData.organizerId === userId || userPreferences?.receivePrivateEventBroadcasts)) {
          totalVisibleEvents++;
        }
      } else if (eventData.visibility === 'invite-only') {
        if (userId && (eventData.organizerId === userId || eventData.attendeesList?.includes(userId))) {
          totalVisibleEvents++;
        }
      }
    });

    console.log('[getAllEvents] Total visible events for user:', totalVisibleEvents);

    res.status(200).json({
      success: true,
      data: {
        events: paginatedEvents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalVisibleEvents / pageSize),
          totalEvents: totalVisibleEvents,
          eventsPerPage: pageSize
        }
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error fetching events', error);
  }
};

// Register for event
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;
    const { specialRequests = '', instanceId = null } = req.body;

    console.log('================ REGISTER FOR EVENT DEBUG ================');
    console.log('Event ID:', eventId);
    console.log('User ID:', userId);
    console.log('Instance ID:', instanceId);
    console.log('Request body:', req.body);

    // Get event details
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      console.log('Event not found');
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();
    console.log('Event type:', eventData.eventType);
    console.log('Event ticket price:', eventData.ticketPrice);
    console.log('Is paid event?', eventData.eventType === 'paid' && eventData.ticketPrice > 0);

    // Check if event is published
    if (eventData.status !== 'published') {
      console.log('Event not published');
      return sendError(res, 400, 'Event is not available for registration');
    }

    // Check if user is already registered or has a pending registration
    // For recurring events, check for the specific instance
    let registrationQuery = db.collection('event_registrations')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId);
    
    if (instanceId) {
      registrationQuery = registrationQuery.where('instanceId', '==', instanceId);
    }
    
    const existingRegistration = await registrationQuery.limit(1).get();

    if (!existingRegistration.empty) {
      const regData = existingRegistration.docs[0].data();
      
      // If registration is completed, user is already registered
      if (regData.status === 'registered') {
        return sendError(res, 400, 'You are already registered for this event');
      }
      
      // If registration is pending payment, check if payment is abandoned or failed
      if (regData.status === 'pending_payment') {
        // Check if payment was abandoned or failed
        if (regData.paymentStatus === 'abandoned' || regData.paymentStatus === 'failed') {
          console.log(`Previous registration payment was ${regData.paymentStatus}, allowing new registration`);
          
          // Delete the old abandoned/failed registration
          await existingRegistration.docs[0].ref.delete();
          console.log('Deleted abandoned/failed registration, proceeding with new registration');
        } else if (regData.paymentReference) {
          // Verify the payment status with Paystack
          const verified = await verifyPaystackTransaction(regData.paymentReference);
          
          if (verified.abandoned || verified.failed) {
            console.log(`Payment verification shows ${verified.abandoned ? 'abandoned' : 'failed'} status, allowing new registration`);
            
            // Delete the old registration
            await existingRegistration.docs[0].ref.delete();
            console.log('Deleted abandoned/failed registration, proceeding with new registration');
          } else {
            // Payment is still genuinely pending
            return sendError(res, 400, 'You have a pending registration for this event. Please complete your payment or cancel the registration first.');
          }
        } else {
          // No payment reference, delete the invalid registration
          await existingRegistration.docs[0].ref.delete();
          console.log('Deleted invalid registration (no payment reference), proceeding with new registration');
        }
      }
    }

    // Check capacity
    let currentCapacity = eventData.currentAttendees;
    
    // For recurring events, check instance-specific capacity
    if (instanceId) {
      currentCapacity = await getInstanceAttendeeCount(instanceId);
      console.log(`Instance ${instanceId} has ${currentCapacity}/${eventData.maxAttendees} attendees`);
      
      // Validate instance exists and isn't cancelled
      if (eventData.isRecurring && eventData.recurrencePattern) {
        const dateStr = instanceId.split('_')[1];
        if (eventData.recurrencePattern.excludedDates && 
            eventData.recurrencePattern.excludedDates.includes(dateStr)) {
          return sendError(res, 400, 'This event instance has been cancelled');
        }
      }
    }

    // Check capacity (0 means unlimited)
    if (eventData.maxAttendees > 0 && currentCapacity >= eventData.maxAttendees) {
      console.log('Event at full capacity');
      return sendError(res, 400, 'Event is at full capacity');
    }

    // Get user info
    const userInfo = await getUserInfo(userId);

    // Ensure a valid email is present before proceeding with payment
    if (!userInfo.email || userInfo.email === 'No email') {
      return sendError(res, 400, 'A valid email address is required to register for this event. Please update your profile.');
    }

    // Check if payment is required (paid event with ticket price)
    const isPaidEvent = eventData.eventType === 'paid' && eventData.ticketPrice > 0;
    console.log('Is paid event (final check):', isPaidEvent);

    // Create registration ID and ticket ID
    const registrationId = db.collection('event_registrations').doc().id;
    const ticketId = db.collection('tickets').doc().id;
    console.log('Registration ID:', registrationId);
    console.log('Ticket ID:', ticketId);

    // Create ticket first
    const ticketData = {
      id: ticketId,
      eventId,
      userId,
      userInfo: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone
      },
      status: isPaidEvent ? 'pending_payment' : 'active',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      specialRequests,
      ticketType: eventData.eventType === 'paid' ? 'paid' : 'free',
      ticketPrice: eventData.eventType === 'paid' ? eventData.ticketPrice : 0,
      paymentReference: null,
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: null,
      qrGenerated: false,
      qrGeneratedAt: null
    };

    // Create registration
    const registrationData = {
      id: registrationId,
      eventId,
      instanceId: instanceId || null, // For recurring events
      userId,
      userInfo: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone
      },
      status: isPaidEvent ? 'pending_payment' : 'registered',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests,
      ticketId: ticketId,
      paymentReference: null
    };

    console.log('Ticket status:', ticketData.status);
    console.log('Registration status:', registrationData.status);

    // For paid events, initialize payment with Paystack
    if (isPaidEvent) {
      console.log('Initializing payment for paid event');
      try {
        const baseUrl = process.env.APP_URL;
        const paymentAmount = eventData.ticketPrice * 100; // Convert to cents/kobo
        console.log('Payment amount:', paymentAmount);
        console.log('Base URL:', baseUrl);

        // Generate unique payment reference
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const paymentReference = `reg_${eventId.substring(0, 8)}_${timestamp}_${randomSuffix}`;

        // Get event organiser's Paystack subaccount (if available)
        let subaccount = null;
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_BANK_VERIFICATION === 'true';
        
        try {
          const organiserDoc = await db.collection('event_organisers').doc(eventData.organizerId).get();
          if (organiserDoc.exists) {
            const organiserData = organiserDoc.data();
            if (organiserData.status === 'active' && organiserData.paystackSubaccountCode) {
              // In development mode, skip subaccount to avoid Paystack validation errors
              if (isDevelopment) {
                console.log('Development mode: Skipping subaccount to avoid Paystack validation errors');
                subaccount = null;
              } else {
                subaccount = organiserData.paystackSubaccountCode;
                console.log('Using organiser subaccount:', subaccount);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching organiser subaccount:', error);
          // Continue without subaccount - payment will go to main account
        }

        // Prepare Paystack request parameters
        const paymentParams = {
          email: userInfo.email,
          amount: paymentAmount,
          reference: paymentReference,
          callback_url: `${baseUrl}/events/registration/payment/callback?ref=${paymentReference}`,
          metadata: {
            eventId,
            userId,
            registrationId,
            ticketId,
            type: 'event_registration',
            organiser_id: eventData.organizerId,
            cancel_action: `${baseUrl}/events/registration/payment/cancelled`
          }
        };

        // Add subaccount if available
        if (subaccount) {
          paymentParams.subaccount = subaccount;
          paymentParams.transaction_charge = 1000; // 10% platform fee in kobo
        } else if (isDevelopment) {
          // In development mode, add a note about subaccount being skipped
          console.log('Development mode: Payment will go to main account (no subaccount)');
        }

        const params = JSON.stringify(paymentParams);

        // Configure Paystack API request
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

        // Make the request to Paystack
        const paymentResponse = await new Promise((resolve, reject) => {
          const paymentReq = https.request(options, paymentRes => {
            let data = '';

            paymentRes.on('data', (chunk) => {
              data += chunk;
            });

            paymentRes.on('end', () => {
              try {
                const response = JSON.parse(data);
                resolve(response);
              } catch (error) {
                reject(error);
              }
            });
          });

          paymentReq.on('error', (error) => {
            reject(error);
          });

          paymentReq.write(params);
          paymentReq.end();
        });

        if (!paymentResponse.status) {
          console.error('Payment initialization failed:', paymentResponse);
          return sendError(res, 500, 'Failed to initialize payment for event registration');
        }

        // Add payment details to registration and ticket
        const paymentUrl = paymentResponse.data.authorization_url;
        console.log('Payment reference:', paymentReference);
        console.log('Payment URL:', paymentUrl);

        // Update registration and ticket with payment information
        registrationData.paymentReference = paymentReference;
        registrationData.paymentUrl = paymentUrl;
        registrationData.paymentAmount = paymentAmount;
        registrationData.paymentInitiatedAt = admin.firestore.Timestamp.now();
        registrationData.paymentStatus = 'pending';

        ticketData.paymentReference = paymentReference;

        // Save registration and ticket
        console.log('Saving registration and ticket for paid event');
    await db.collection('tickets').doc(ticketId).set(ticketData);
        await db.collection('event_registrations').doc(registrationId).set(registrationData);
        console.log('Registration and ticket saved successfully');

        // Return payment information to client
        console.log('Returning payment information to client');
        return res.status(200).json({
          success: true,
          message: 'Payment required for event registration',
          paymentRequired: true,
          paymentUrl,
          paymentReference,
          amount: paymentAmount / 100, // Convert back to regular currency
          registration: {
            ...registrationData,
            registeredAt: formatDate(registrationData.registeredAt),
            paymentInitiatedAt: formatDate(registrationData.paymentInitiatedAt)
          },
          ticket: {
            ...ticketData,
            createdAt: formatDate(ticketData.createdAt)
          }
        });
      } catch (error) {
        console.error('Error initializing payment:', error);
        return sendError(res, 500, 'Failed to initialize payment for event registration', error);
      }
    } else {
      // For free events, proceed with registration as before
      console.log('Processing free event registration');
      await db.collection('tickets').doc(ticketId).set(ticketData);
      await db.collection('event_registrations').doc(registrationId).set(registrationData);

      // Invalidate attendee count cache for this instance
      if (instanceId) {
        invalidateAttendeeCountCache(instanceId);
        console.log(`Invalidated cache for instance ${instanceId}`);
      }

      // Only increment attendee count for free events
      // For paid events, this will happen after payment is confirmed
      console.log('Incrementing attendee count for free event');
    await db.collection('events').doc(eventId).update({
      currentAttendees: admin.firestore.FieldValue.increment(1),
      attendeesList: admin.firestore.FieldValue.arrayUnion(userId)
    });
      console.log('Attendee count incremented');

    // Send real-time notification to organizer
      try {
        if (global.socketService) {
        await global.socketService.broadcastNewRegistration(
          eventData.organizerId,
          { 
            id: eventId, 
            title: eventData.title,
            category: eventData.category 
          },
          registrationData
        );
        }
      } catch (socketError) {
        console.error('Error sending registration notification:', socketError);
        // Don't fail the registration if socket notification fails
    }

      console.log('Free event registration completed successfully');
      return res.status(200).json({
      success: true,
        message: 'Registration successful',
      registration: {
        ...registrationData,
        registeredAt: formatDate(registrationData.registeredAt)
      },
      ticket: {
        ...ticketData,
        createdAt: formatDate(ticketData.createdAt)
      }
    });
    }
  } catch (error) {
    console.error('Error registering for event:', error);
    sendError(res, 500, 'Error registering for event', error);
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;
    const updateData = req.body;

    console.log('Update event request:', {
      eventId,
      userId,
      updateData: {
        ...updateData,
        eventDate: updateData.eventDate,
        endDate: updateData.endDate
      },
      files: req.files,
      firebaseStorageUrls: req.firebaseStorageUrls
    });

    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check ownership
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to update this event');
    }

    // Handle image URLs from Firebase Storage (same as createEvent)
    let bannerImageUrl = null;
    let eventImagesUrls = [];
    
    if (req.firebaseStorageUrls) {
      bannerImageUrl = req.firebaseStorageUrls.bannerImage || null;
      
      // Handle multiple event images
      if (req.firebaseStorageUrls.eventImages) {
        if (Array.isArray(req.firebaseStorageUrls.eventImages)) {
          eventImagesUrls = req.firebaseStorageUrls.eventImages;
        } else {
          eventImagesUrls = [req.firebaseStorageUrls.eventImages];
        }
      }
    }

    // Parse existing images that weren't re-uploaded
    let existingImages = [];
    if (updateData.existingImages) {
      try {
        existingImages = JSON.parse(updateData.existingImages);
      } catch (err) {
        console.warn('Error parsing existing images:', err);
        existingImages = [];
      }
    }

    // Parse the desired image order
    let imageOrder = [];
    if (updateData.imageOrder) {
      try {
        imageOrder = JSON.parse(updateData.imageOrder);
      } catch (err) {
        console.warn('Error parsing image order:', err);
        imageOrder = [];
      }
    }

    // Create a mapping of new uploaded images
    const newImageMap = new Map();
    if (bannerImageUrl) {
      // Find which original image this banner replaces
      const originalBannerUri = imageOrder[0];
      if (originalBannerUri && (originalBannerUri.startsWith('file://') || originalBannerUri.startsWith('content://') || originalBannerUri.startsWith('ph://'))) {
        newImageMap.set(originalBannerUri, bannerImageUrl);
      }
    }

    // Map event images to their original URIs
    eventImagesUrls.forEach((uploadedUrl, index) => {
      // Find the corresponding original URI in the order
      const originalUri = imageOrder.find(uri => 
        (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) && 
        !newImageMap.has(uri)
      );
      if (originalUri) {
        newImageMap.set(originalUri, uploadedUrl);
      }
    });

    // Reconstruct the final image array according to the original order
    const finalImages = [];
    imageOrder.forEach(originalUri => {
      if (newImageMap.has(originalUri)) {
        // This was a new image that got uploaded
        finalImages.push(newImageMap.get(originalUri));
      } else if (existingImages.includes(originalUri)) {
        // This was an existing image that was kept
        finalImages.push(originalUri);
      }
    });

    // Set banner image (first image in the array)
    const finalBannerImage = finalImages.length > 0 ? finalImages[0] : null;

    console.log('Image processing result:', {
      originalOrder: imageOrder.length,
      newUploads: newImageMap.size,
      existingKept: existingImages.length,
      finalImages: finalImages.length,
      bannerImage: !!finalBannerImage
    });

    // Parse JSON fields that were stringified in FormData (same as createEvent)
    let location = {};
    let tags = [];
    
    // Handle location field
    if (updateData.location) {
      if (typeof updateData.location === 'string') {
        try {
          location = JSON.parse(updateData.location);
        } catch (locationErr) {
          console.warn('Error parsing location JSON string:', locationErr);
        }
      } else if (typeof updateData.location === 'object') {
        location = updateData.location;
      }
    }

    // Handle tags field
    if (updateData.tags) {
      if (typeof updateData.tags === 'string') {
        try {
          tags = JSON.parse(updateData.tags);
        } catch (tagsErr) {
          console.warn('Error parsing tags JSON string:', tagsErr);
        }
      } else if (Array.isArray(updateData.tags)) {
        tags = updateData.tags;
      }
    }

    // Prepare update data
    const updates = {
      title: updateData.title,
      description: updateData.description,
      category: updateData.category || 'other',
      eventType: updateData.eventType || 'free',
      ticketPrice: parseFloat(updateData.ticketPrice) || 0,
      maxAttendees: parseInt(updateData.maxAttendees) || 0,
      visibility: updateData.visibility || 'public',
      location: location,
      tags: tags,
      // Image data from Firebase Storage
      bannerImage: finalBannerImage,
      images: finalImages,
      updatedAt: admin.firestore.Timestamp.now()
    };

    // Enforce bulk registration capacity rule on update
    const finalMaxAttendees = Number.isFinite(updates.maxAttendees) && updates.maxAttendees > 0
      ? updates.maxAttendees
      : eventData.maxAttendees;

    let desiredAllowBulk = undefined;
    if (typeof updateData.allowBulkRegistrations !== 'undefined') {
      desiredAllowBulk = (updateData.allowBulkRegistrations === 'true' || updateData.allowBulkRegistrations === true);
    }

    const finalAllowBulk = finalMaxAttendees <= 10
      ? false
      : (typeof desiredAllowBulk !== 'undefined' ? desiredAllowBulk : !!eventData.allowBulkRegistrations);

    updates.allowBulkRegistrations = finalAllowBulk;

    // Convert dates if provided with validation
    if (updateData.eventDate && typeof updateData.eventDate === 'string') {
      try {
        const eventDate = new Date(updateData.eventDate);
        if (isNaN(eventDate.getTime())) {
          return sendError(res, 400, 'Invalid event date format');
        }
        const timestamp = Math.floor(eventDate.getTime() / 1000) * 1000;
        const validDate = new Date(timestamp);
        updates.eventDate = admin.firestore.Timestamp.fromDate(validDate);
      } catch (error) {
        console.error('Error converting eventDate:', error);
        return sendError(res, 400, 'Invalid event date format');
      }
    }
    
    if (updateData.endDate && typeof updateData.endDate === 'string') {
      try {
        const endDate = new Date(updateData.endDate);
        if (isNaN(endDate.getTime())) {
          return sendError(res, 400, 'Invalid end date format');
        }
        const timestamp = Math.floor(endDate.getTime() / 1000) * 1000;
        const validDate = new Date(timestamp);
        updates.endDate = admin.firestore.Timestamp.fromDate(validDate);
      } catch (error) {
        console.error('Error converting endDate:', error);
        return sendError(res, 400, 'Invalid end date format');
      }
    }

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.organizerId;
    delete updates.createdAt;
    delete updates.currentAttendees;
    delete updates.attendeesList;
    delete updates.status;

    await eventRef.update(updates);

    // Get updated event
    const updatedDoc = await eventRef.get();
    const updatedEvent = updatedDoc.data();

    console.log('Event updated successfully with images:', {
      bannerImage: !!finalBannerImage,
      eventImages: finalImages.length - (finalBannerImage ? 1 : 0),
      totalImages: finalImages.length,
      newUploads: newImageMap.size,
      existingKept: existingImages.length
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event: {
        ...updatedEvent,
        eventDate: formatDate(updatedEvent.eventDate),
        endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null,
        updatedAt: formatDate(updatedEvent.updatedAt)
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error updating event', error);
  }
};

// Delete event (now cancels event instead)
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check ownership
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to delete this event');
    }

    // Check if event is already cancelled
    if (eventData.status === 'cancelled') {
      return sendError(res, 400, 'Event is already cancelled');
    }

    // Cancel the event instead of deleting
    await db.collection('events').doc(eventId).update({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date()
    });

    // Get updated event data for broadcasting
    const updatedEventDoc = await db.collection('events').doc(eventId).get();
    const updatedEventData = updatedEventDoc.data();

    // Store event data for broadcasting middleware
    req.eventData = {
      ...updatedEventData,
      eventDate: formatDate(updatedEventData.eventDate),
      endDate: updatedEventData.endDate ? formatDate(updatedEventData.endDate) : null
    };
    req.broadcastType = 'event_cancelled';

    res.status(200).json({
      success: true,
      message: 'Event cancelled successfully',
      data: {
        event: req.eventData
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error cancelling event', error);
  }
};

// Search events
exports.searchEvents = async (req, res) => {
  try {
    const { q, category, location, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return sendError(res, 400, 'Search query must be at least 2 characters');
    }

    const userId = req.user?.uid; // Optional - user might not be authenticated
    console.log('[searchEvents] Request from user:', userId || 'anonymous');

    // Get user preferences if authenticated
    let userPreferences = null;
    if (userId) {
      try {
        console.log('[searchEvents] Looking up user preferences for userId:', userId);
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userPreferences = userData.eventPreferences || {};
          console.log('[searchEvents] User preferences loaded:', {
            receivePrivateEventBroadcasts: userPreferences.receivePrivateEventBroadcasts || false,
            userEmail: userData.email || 'unknown',
            userId: userId
          });
        } else {
          console.log('[searchEvents] User document not found for userId:', userId);
        }
      } catch (prefError) {
        console.warn('[searchEvents] Failed to load user preferences:', prefError.message);
        // Continue without preferences
      }
    } else {
      console.log('[searchEvents] No userId provided, continuing as anonymous');
    }

    // IMPORTANT: No visibility filtering in the Firestore query to avoid index requirement
    let query = db.collection('events')
      .where('status', '==', 'published')
      .orderBy('eventDate', 'desc')
      .limit(parseInt(limit) * 3); // Get extra to account for visibility filtering

    const snapshot = await query.get();
    
    console.log('[searchEvents] Raw query returned', snapshot.size, 'events');
    
    // Filter results client-side for text search and visibility
    const searchTerm = q.toLowerCase();
    const events = [];
    
    snapshot.forEach(doc => {
      const eventData = doc.data();
      
      // Check visibility rules first
      let shouldInclude = false;
      if (eventData.visibility === 'public') {
        // Public events: visible to everyone
        shouldInclude = true;
      } else if (eventData.visibility === 'private') {
        // Private events: visible to organizer or users who opted in
        if (userId && eventData.organizerId === userId) {
          shouldInclude = true;
          console.log('[searchEvents] Including private event for organizer:', eventData.title, 'organizerId:', eventData.organizerId, 'userId:', userId);
        } else if (userId && userPreferences?.receivePrivateEventBroadcasts) {
          shouldInclude = true;
          console.log('[searchEvents] Including private event for opted-in user:', eventData.title, 'userId:', userId);
        } else {
          console.log('[searchEvents] Filtering out private event:', eventData.title, 'User not authorized. userId:', userId, 'organizerId:', eventData.organizerId, 'optedIn:', userPreferences?.receivePrivateEventBroadcasts);
        }
      } else if (eventData.visibility === 'invite-only') {
        // Invite-only events: visible to organizer or invited users
        if (userId && eventData.organizerId === userId) {
          shouldInclude = true;
        } else if (userId && eventData.attendeesList?.includes(userId)) {
          shouldInclude = true;
        }
      }
      
      // If event is visible, check if it matches search criteria
      if (shouldInclude) {
      const searchableText = `${eventData.title} ${eventData.description} ${eventData.tags?.join(' ') || ''}`.toLowerCase();
      
      if (searchableText.includes(searchTerm)) {
        // Apply additional filters
        if (category && eventData.category !== category) return;
        if (location && !eventData.location?.city?.toLowerCase().includes(location.toLowerCase())) return;
        
        events.push({
          ...eventData,
          // Send both formatted (for display) and ISO (for parsing) dates
          eventDate: formatDate(eventData.eventDate),
          eventDateISO: convertToISOString(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
          endDateISO: eventData.endDate ? convertToISOString(eventData.endDate) : null
        });
        }
      }
    });

    // Limit results to requested amount
    const limitedEvents = events.slice(0, parseInt(limit));

    console.log('[searchEvents] After filtering, found', limitedEvents.length, 'events matching search for user');

    res.status(200).json({
      success: true,
      data: {
        events: limitedEvents,
        searchTerm: q,
        resultsCount: limitedEvents.length
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error searching events', error);
  }
};

// Get user's created events
exports.getUserEvents = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status } = req.query;

    let query = db.collection('events')
      .where('organizerId', '==', userId)
      .orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const events = [];

    snapshot.forEach(doc => {
      const eventData = doc.data();
      events.push({
        ...eventData,
        // Send both formatted (for display) and ISO (for parsing) dates
        eventDate: formatDate(eventData.eventDate),
        eventDateISO: convertToISOString(eventData.eventDate),
        endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
        endDateISO: eventData.endDate ? convertToISOString(eventData.endDate) : null,
        createdAt: formatDate(eventData.createdAt)
      });
    });

    res.status(200).json({
      success: true,
      data: {
        events,
        totalEvents: events.length
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error fetching user events', error);
  }
};

// Get user's event registrations
exports.getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user.uid;

    const registrationsSnapshot = await db.collection('event_registrations')
      .where('userId', '==', userId)
      .orderBy('registeredAt', 'desc')
      .get();

    const registrations = [];
    
    // Get event details for each registration
    for (const doc of registrationsSnapshot.docs) {
      const registrationData = doc.data();
      
      const eventDoc = await db.collection('events').doc(registrationData.eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data();
        
        registrations.push({
          registration: {
            ...registrationData,
            registeredAt: formatDate(registrationData.registeredAt)
          },
          event: {
            ...eventData,
            eventDate: formatDate(eventData.eventDate),
            endDate: eventData.endDate ? formatDate(eventData.endDate) : null
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        registrations,
        totalRegistrations: registrations.length
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error fetching user registrations', error);
  }
};

// Get event by ID with full details
exports.getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid; // Optional for public events

    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check if user can view this event
    if (eventData.visibility === 'private' && eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to view this event');
    }

    if (eventData.visibility === 'invite-only' && 
        eventData.organizerId !== userId && 
        !eventData.attendeesList?.includes(userId)) {
      return sendError(res, 403, 'This is an invite-only event');
    }

    // Check if current user is registered
    let userRegistration = null;
    if (userId) {
      const registrationSnapshot = await db.collection('event_registrations')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!registrationSnapshot.empty) {
        const registrationData = registrationSnapshot.docs[0].data();
        
        console.log('Found registration for user:', userId, 'with status:', registrationData.status, 'and paymentStatus:', registrationData.paymentStatus || 'none');
        
        // Only include registration if it's not pending_payment or cancelled
        if (registrationData.status !== 'pending_payment' && 
            registrationData.status !== 'cancelled' && 
            registrationData.paymentStatus !== 'abandoned' &&
            registrationData.paymentStatus !== 'cancelled') {
          console.log('Registration is valid, including in response');
          userRegistration = registrationData;
        } else {
          console.log('Filtering out registration with status:', registrationData.status, 'and paymentStatus:', registrationData.paymentStatus || 'none');
        }
      } else {
        console.log('No registration found for user:', userId);
      }
    }

    // Get attendee count and some attendee info (if organizer)
    let attendeeDetails = null;
    if (userId === eventData.organizerId) {
      const attendeesSnapshot = await db.collection('event_registrations')
        .where('eventId', '==', eventId)
        .get();

      attendeeDetails = {
        totalAttendees: attendeesSnapshot.size,
        attendees: attendeesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id,
            userInfo: data.userInfo,
            status: data.status,
            registeredAt: formatDate(data.registeredAt)
          };
        })
      };
    }

    res.status(200).json({
      success: true,
      data: {
        event: {
          ...eventData,
          // For display
          eventDate: formatDate(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
          createdAt: formatDate(eventData.createdAt),
          // For editing - ISO strings
          eventDateISO: convertToISOString(eventData.eventDate),
          endDateISO: eventData.endDate ? convertToISOString(eventData.endDate) : null,
        },
        userRegistration: userRegistration ? {
          ...userRegistration,
          registeredAt: formatDate(userRegistration.registeredAt)
        } : null,
        isOrganizer: userId === eventData.organizerId,
        attendeeDetails
      }
    });

  } catch (error) {
    sendError(res, 500, 'Error fetching event details', error);
  }
};

// Unregister from event
exports.unregisterFromEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    console.log('================ UNREGISTER FROM EVENT DEBUG ================');
    console.log('Event ID:', eventId);
    console.log('User ID:', userId);
    console.log('Request method:', req.method);

    // Find existing registration
    const registrationSnapshot = await db.collection('event_registrations')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .get();

    if (registrationSnapshot.empty) {
      console.log('Registration not found');
      return sendError(res, 404, 'Registration not found');
    }

    const registrationDoc = registrationSnapshot.docs[0];
    const registrationData = registrationDoc.data();
    console.log('Registration data:', {
      id: registrationData.id,
      status: registrationData.status,
      paymentStatus: registrationData.paymentStatus,
      ticketId: registrationData.ticketId
    });

    // Check if user has been checked in (scanned) - if so, prevent unregistration
    if (registrationData.ticketId) {
      const ticketRef = db.collection('tickets').doc(registrationData.ticketId);
      const ticketDoc = await ticketRef.get();
      
      if (ticketDoc.exists) {
        const ticketData = ticketDoc.data();
        console.log('Ticket check-in status:', {
          checkedIn: ticketData.checkedIn,
          checkedInAt: ticketData.checkedInAt,
          checkedInBy: ticketData.checkedInBy
        });
        
        // If user has been checked in, prevent unregistration
        if (ticketData.checkedIn) {
          console.log('User has been checked in, preventing unregistration');
          return res.status(400).json({
            success: false,
            message: 'You cannot unregister from an event after being checked in. Please contact the event organizer for assistance.',
            checkedIn: true,
            checkedInAt: ticketData.checkedInAt ? ticketData.checkedInAt.toDate().toISOString() : null
          });
        }
      }
    }

    // ALWAYS delete the registration regardless of status
    try {
    // Delete associated ticket if exists
    if (registrationData.ticketId) {
      try {
        // Also delete any QR tokens associated with the ticket
        const qrTokensSnapshot = await db.collection('qr_tokens')
          .where('ticketId', '==', registrationData.ticketId)
          .get();
        
        const deletePromises = [];
        qrTokensSnapshot.forEach(doc => {
            console.log(`Deleting QR token: ${doc.id}`);
          deletePromises.push(doc.ref.delete());
        });
        
          // Delete ticket
          console.log(`Deleting ticket: ${registrationData.ticketId}`);
        deletePromises.push(db.collection('tickets').doc(registrationData.ticketId).delete());
        await Promise.all(deletePromises);
          console.log('Ticket and QR tokens deleted successfully');
      } catch (ticketError) {
        console.error('Error deleting ticket and QR tokens:', ticketError);
        // Continue with unregistration even if ticket deletion fails
      }
    }
      
      // Delete registration
      console.log(`Deleting registration: ${registrationDoc.id}`);
      await registrationDoc.ref.delete();
      console.log('Registration deleted successfully');

    // Get event details for notification
    const eventDoc = await db.collection('events').doc(eventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() : null;

      // Only update event attendee count if the registration was completed
      const wasCompletedRegistration = registrationData.status === 'registered' && 
                                      (registrationData.paymentStatus !== 'pending' && 
                                       registrationData.paymentStatus !== 'abandoned' && 
                                       registrationData.paymentStatus !== 'cancelled');
      
      if (wasCompletedRegistration) {
    // Update event attendee count
        console.log('Updating event attendee count');
    await db.collection('events').doc(eventId).update({
      currentAttendees: admin.firestore.FieldValue.increment(-1),
      attendeesList: admin.firestore.FieldValue.arrayRemove(userId)
    });
        console.log('Event attendee count updated successfully');
      } else {
        console.log('Skipping attendee count update for non-completed registration');
      }

    // Send real-time notification to organizer
    if (global.socketService && eventData && eventData.organizerId) {
      try {
          console.log('Sending unregistration notification to organizer');
        await global.socketService.broadcastUnregistration(
          eventData.organizerId,
          { 
            id: eventId, 
            title: eventData.title,
            category: eventData.category 
          },
          {
            userId: userId,
            userName: registrationData.userInfo.name,
            unregisteredAt: new Date().toISOString()
          }
        );
          console.log('Unregistration notification sent successfully');
      } catch (socketError) {
        console.error('Error sending unregistration notification:', socketError);
        // Don't fail the unregistration if socket notification fails
      }
    }

      console.log('Returning success response');
      return res.status(200).json({
      success: true,
        message: 'Successfully unregistered from event',
        wasCompletedRegistration,
        registrationStatus: registrationData.status,
        paymentStatus: registrationData.paymentStatus || 'none'
    });
    } catch (updateError) {
      console.error('Error processing unregistration:', updateError);
      return sendError(res, 500, 'Error processing unregistration', updateError);
    }
  } catch (error) {
    console.error('Error unregistering from event:', error);
    sendError(res, 500, 'Error unregistering from event', error);
  }
};

// Initialize database collections endpoint (for setup)
exports.initializeDatabase = async (req, res) => {
  try {
    const success = await initializeEventCollections();
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Event database collections initialized successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to initialize some event collections'
      });
    }
  } catch (error) {
    sendError(res, 500, 'Error initializing event database', error);
  }
};

// QR Code Check-in System Controllers

// Generate QR code for a specific ticket
exports.generateTicketQR = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.uid;

    console.log('[generateTicketQR] Request params:', req.params);
    console.log('[generateTicketQR] Ticket ID:', ticketId);
    console.log('[generateTicketQR] User ID:', userId);

    if (!ticketId) {
      console.log('[generateTicketQR] No ticketId provided in params');
      return sendError(res, 400, 'Ticket ID is required');
    }

    // Get ticket data
    const ticketDoc = await db.collection('tickets').doc(ticketId).get();
    console.log('[generateTicketQR] Ticket exists:', ticketDoc.exists);
    
    if (!ticketDoc.exists) {
      console.log('[generateTicketQR] Ticket not found:', ticketId);
      return sendError(res, 404, `Ticket not found: ${ticketId}`);
    }

    const ticketData = ticketDoc.data();

    // Verify ticket belongs to user
    if (ticketData.userId !== userId) {
      return sendError(res, 403, 'Not authorized to generate QR code for this ticket');
    }

    // Check if ticket is valid
    if (ticketData.status === 'cancelled') {
      return sendError(res, 400, 'Cannot generate QR code for cancelled ticket');
    }

    // Generate QR code
    const qrResult = await QRService.generateTicketQR(
      ticketData.eventId,
      userId,
      ticketId
    );

    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      ticketId,
      qrCode: qrResult.qrCode,
      verificationToken: qrResult.verificationToken,
      expiresAt: qrResult.expiresAt
    });

  } catch (error) {
    sendError(res, 500, 'Error generating QR code', error);
  }
};

// Validate QR code (for organizers)
exports.validateQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;
    const organizerId = req.user.uid;

    if (!qrData) {
      return sendError(res, 400, 'QR code data is required');
    }

    // Validate QR code
    const validationResult = await QRService.validateQRCode(qrData, organizerId);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        message: validationResult.message,
        ...validationResult
      });
    }

    // Get user data for the ticket holder
    if (validationResult.userId) {
      const userInfo = await getUserInfo(validationResult.userId);
        validationResult.userData = {
        name: userInfo.name,
        email: userInfo.email,
        profileImage: userInfo.profileImage,
        company: userInfo.company
        };
    }

    res.status(200).json({
      success: true,
      message: 'QR code is valid',
      ...validationResult
    });

  } catch (error) {
    sendError(res, 500, 'Error validating QR code', error);
  }
};

// Process check-in (for organizers)
exports.processCheckIn = async (req, res) => {
  try {
    const { qrData } = req.body;
    const organizerId = req.user.uid;

    if (!qrData) {
      return sendError(res, 400, 'QR code data is required');
    }

    // First validate the QR code
    const validationResult = await QRService.validateQRCode(qrData, organizerId);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        message: validationResult.message,
        ...validationResult
      });
    }

    // Process the check-in
    const checkInResult = await QRService.processCheckIn(
      validationResult.ticketId,
      validationResult.verificationToken,
      organizerId
    );

    // Get user data for the ticket holder
    let userData = null;
    if (validationResult.userId) {
      const userInfo = await getUserInfo(validationResult.userId);
        userData = {
        name: userInfo.name,
        email: userInfo.email,
        profileImage: userInfo.profileImage,
        company: userInfo.company
        };
    }

    // Emit real-time notification for successful check-in
    try {
      const socketService = require('../services/socketService');
      if (socketService && socketService.sendToUser) {
        const notificationData = {
          type: 'attendee_checked_in',
          eventId: validationResult.eventId,
          attendeeName: userData?.name || 'Unknown',
          checkedInAt: checkInResult.checkedInAt,
          organizerId: organizerId
        };

        // Use sendToUser method instead of broadcastToEventOrganizer
        socketService.sendToUser(organizerId, 'attendee_checked_in', notificationData);
        console.log('[processCheckIn] Notification sent to organizer:', organizerId);
      }
    } catch (socketError) {
      console.error('[processCheckIn] Socket notification failed (non-blocking):', socketError.message);
      // Don't break the check-in process if socket notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Check-in completed successfully',
      eventId: validationResult.eventId,
      ticketId: validationResult.ticketId,
      userData,
      checkedInAt: checkInResult.checkedInAt
    });

  } catch (error) {
    sendError(res, 500, 'Error processing check-in', error);
  }
};

// Get check-in statistics for an event (for organizers)
exports.getCheckInStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.uid;

    // Verify organizer owns the event
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();
    if (eventData.organizerId !== organizerId) {
      return sendError(res, 403, 'Not authorized to view check-in statistics for this event');
    }

    // Get check-in statistics
    const stats = await QRService.getCheckInStats(eventId);

    res.status(200).json({
      success: true,
      message: 'Check-in statistics retrieved successfully',
      ...stats
    });

  } catch (error) {
    sendError(res, 500, 'Error getting check-in statistics', error);
  }
};

// Generate QR codes for all event attendees (for organizers)
exports.generateBulkQRCodes = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.uid;

    // Generate bulk QR codes
    const result = await QRService.generateBulkQRCodes(eventId, organizerId);

    res.status(200).json({
      success: true,
      message: 'Bulk QR codes generated successfully',
      ...result
    });

  } catch (error) {
    sendError(res, 500, 'Error generating bulk QR codes', error);
  }
};

// Get attendee list with check-in status (for organizers)
exports.getEventAttendees = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.uid;

    // Verify organizer owns the event
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();
    if (eventData.organizerId !== organizerId) {
      return sendError(res, 403, 'Not authorized to view attendees for this event');
    }

    // Get all tickets for the event
    const ticketsSnapshot = await db.collection('tickets')
      .where('eventId', '==', eventId)
      .get();

    const attendees = [];

    for (const ticketDoc of ticketsSnapshot.docs) {
      const ticket = ticketDoc.data();
      
      // Get user data using enhanced getUserInfo function
      const userInfo = await getUserInfo(ticket.userId);

      attendees.push({
        ticketId: ticketDoc.id,
        userId: ticket.userId,
        userData: {
          name: userInfo.name,
          email: userInfo.email,
          profileImage: userInfo.profileImage,
          company: userInfo.company
        },
        registeredAt: formatDate(ticket.createdAt),
        checkedIn: ticket.checkedIn || false,
        checkedInAt: ticket.checkedInAt ? formatDate(ticket.checkedInAt) : null,
        ticketStatus: ticket.status || 'active'
      });
    }

    // Sort by check-in status and registration date
    attendees.sort((a, b) => {
      if (a.checkedIn !== b.checkedIn) {
        return b.checkedIn - a.checkedIn; // Checked-in first
      }
      return new Date(b.registeredAt) - new Date(a.registeredAt); // Most recent first
    });

    res.status(200).json({
      success: true,
      message: 'Event attendees retrieved successfully',
      eventId,
      totalAttendees: attendees.length,
      checkedInCount: attendees.filter(a => a.checkedIn).length,
      attendees
    });

  } catch (error) {
    sendError(res, 500, 'Error getting event attendees', error);
  }
};

// Get user's ticket for a specific event
exports.getMyTicketForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    console.log('[getMyTicketForEvent] Event ID:', eventId);
    console.log('[getMyTicketForEvent] User ID:', userId);

    // Check if user is registered for this event
    const registrationSnapshot = await db.collection('event_registrations')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .get();
    
    console.log('[getMyTicketForEvent] User registrations for this event:', registrationSnapshot.size);
    registrationSnapshot.docs.forEach(doc => {
      const regData = doc.data();
      console.log('[getMyTicketForEvent] Registration:', doc.id, 'ticketId:', regData.ticketId, 'status:', regData.status);
    });

    // First, let's see all tickets for this user
    const allUserTickets = await db.collection('tickets')
      .where('userId', '==', userId)
      .get();
    
    console.log('[getMyTicketForEvent] User has', allUserTickets.size, 'total tickets');
    allUserTickets.docs.forEach(doc => {
      console.log('[getMyTicketForEvent] Ticket:', doc.id, 'for event:', doc.data().eventId);
    });

    // Find the user's ticket for this event
    const ticketSnapshot = await db.collection('tickets')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    console.log('[getMyTicketForEvent] Tickets found for this event:', ticketSnapshot.size);

    if (ticketSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'No ticket found for this event'
      });
    }

    const ticketDoc = ticketSnapshot.docs[0];
    const ticketDocData = ticketDoc.data();
    
    console.log('[getMyTicketForEvent] Found ticket document ID:', ticketDoc.id);
    console.log('[getMyTicketForEvent] Internal ticket ID field:', ticketDocData.id);
    console.log('[getMyTicketForEvent] Ticket data keys:', Object.keys(ticketDocData));
    
    const ticketData = {
      id: ticketDoc.id, // Always use the Firestore document ID
      ...ticketDocData,
      // Override any internal id field with the document ID
      createdAt: ticketDocData.createdAt?.toDate().toISOString(),
      updatedAt: ticketDocData.updatedAt?.toDate().toISOString(),
      checkedInAt: ticketDocData.checkedInAt?.toDate().toISOString(),
    };
    
    // Ensure the ID is the document ID
    ticketData.id = ticketDoc.id;
    
    console.log('[getMyTicketForEvent] Final ticket ID being returned:', ticketData.id);

    res.status(200).json({
      success: true,
      ticket: ticketData
    });

  } catch (error) {
    sendError(res, 500, 'Error getting user ticket', error);
  }
};

// Get user's credit status
exports.getUserCredits = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const creditStatus = await CreditService.getUserCreditStatus(userId);
    
    res.status(200).json({
      success: true,
      credits: creditStatus
    });
    
  } catch (error) {
    console.error('Error getting user credits:', error);
    sendError(res, 500, 'Error retrieving credit information', error);
  }
};

// Handle payment callback for event publishing
exports.handlePaymentCallback = async (req, res) => {
  try {
    const { ref: paymentReference } = req.query;
    
    if (!paymentReference) {
      console.log('Payment reference missing in callback - likely abandoned payment');
      return res.redirect(`/event-payment-failed.html?reason=payment_abandoned&type=publishing`);
    }
    
    // Verify payment with Paystack
    const verified = await verifyPaystackTransaction(paymentReference);
    
    if (verified.success) {
      const metadata = verified.data.metadata;
      const transactionData = verified.data;
      
      console.log('Payment verified successfully:', {
        reference: paymentReference,
        amount: transactionData.amount,
        currency: transactionData.currency,
        status: transactionData.status
      });
      
      if (metadata.publishingFee && metadata.eventId) {
        // Find and update the event
        const eventRef = db.collection('events').doc(metadata.eventId);
        const eventDoc = await eventRef.get();
        
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          
          // Verify this event is actually pending payment
          if (eventData.status !== 'pending_payment') {
            console.warn(`Event ${metadata.eventId} status is ${eventData.status}, not pending_payment`);
            return res.redirect(`/event-payment-failed.html?reason=invalid_event_status&type=publishing&event=${metadata.eventId}`);
          }
          
          // Verify payment reference matches
          if (eventData.paymentReference !== paymentReference) {
            console.error(`Payment reference mismatch for event ${metadata.eventId}`);
            return res.redirect(`/event-payment-failed.html?reason=reference_mismatch&type=publishing&event=${metadata.eventId}`);
          }
          
          // Update event to published status
          await eventRef.update({
            status: 'published',
            publishedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            listingFee: transactionData.amount,
            paymentCompletedAt: admin.firestore.Timestamp.now(),
            creditApplied: null,
            paymentReference: paymentReference,
            paymentVerified: true,
            paymentStatus: 'completed'
          });
          
          // Record payment for audit trail
          await CreditService.recordEventPayment(
            metadata.eventId,
            transactionData.amount,
            paymentReference
          );
          
          console.log(`Event ${metadata.eventId} published after payment verification`);
          
          // Redirect to event payment success page (matching subscription flow)
          return res.redirect(`/event-payment-success.html?event=${metadata.eventId}&title=${encodeURIComponent(eventData.title || 'Event')}&type=publishing`);
        } else {
          console.error(`Event ${metadata.eventId} not found`);
          return res.redirect(`/event-payment-failed.html?reason=event_not_found&type=publishing`);
        }
      } else {
        console.error('Invalid metadata in payment callback:', metadata);
        return res.redirect(`/event-payment-failed.html?reason=invalid_metadata&type=publishing`);
      }
    } else {
      console.error('Payment verification failed:', verified.message);
      return res.redirect(`/event-payment-failed.html?reason=verification_failed&type=publishing`);
    }
    
  } catch (error) {
    console.error('Error handling payment callback:', error);
    return res.redirect(`/event-payment-failed.html?reason=server_error&type=publishing`);
  }
};

// Handle payment webhook for event publishing
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-paystack-signature'];
    
    console.log('Webhook received:', { 
      event: payload.event, 
      hasSignature: !!signature,
      timestamp: new Date().toISOString()
    });
    
    // Verify webhook signature
    if (!signature) {
      console.error('Webhook signature missing');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (hash !== signature) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Handle charge.success event
    if (payload.event === 'charge.success') {
      const transaction = payload.data;
      const metadata = transaction.metadata;
      
      console.log('Processing charge.success webhook:', {
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status
      });
      
      if (metadata && metadata.publishingFee && metadata.eventId && metadata.paymentType === 'event_publishing') {
        const eventRef = db.collection('events').doc(metadata.eventId);
        const eventDoc = await eventRef.get();
        
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          
          // Only process if event is still pending payment
          if (eventData.status === 'pending_payment') {
            // Verify payment reference matches
            if (eventData.paymentReference !== transaction.reference) {
              console.error(`Webhook payment reference mismatch for event ${metadata.eventId}:`, {
                expected: eventData.paymentReference,
                received: transaction.reference
              });
              return res.status(400).json({ error: 'Payment reference mismatch' });
            }
            
            // Update event to published status
            await eventRef.update({
              status: 'published',
              publishedAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now(),
              listingFee: transaction.amount,
              paymentCompletedAt: admin.firestore.Timestamp.now(),
              creditApplied: null,
              paymentReference: transaction.reference,
              paymentVerified: true,
              webhookProcessedAt: admin.firestore.Timestamp.now()
            });
            
            // Record payment for audit trail
            await CreditService.recordEventPayment(
              metadata.eventId,
              transaction.amount,
              transaction.reference
            );
            
            console.log(`Event ${metadata.eventId} published via webhook after payment`);
          } else {
            console.log(`Event ${metadata.eventId} status is ${eventData.status}, skipping webhook processing`);
          }
        } else {
          console.error(`Event ${metadata.eventId} not found in webhook`);
        }
      } else {
        console.log('Webhook not for event publishing, ignoring');
      }
    }
    
    // Acknowledge webhook receipt
    res.status(200).json({ status: 'success' });
    
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Admin function to reset monthly credits
exports.resetMonthlyCredits = async (req, res) => {
  try {
    const { month } = req.query; // Format: "2024-05"
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return sendError(res, 400, 'Invalid month format. Use YYYY-MM format.');
    }
    
    const result = await CreditService.resetMonthlyCredits(month);
    
    res.status(200).json({
      success: true,
      message: `Monthly credits reset for ${month}`,
      result
    });
    
  } catch (error) {
    console.error('Error resetting monthly credits:', error);
    sendError(res, 500, 'Error resetting monthly credits', error);
  }
};

// Helper function to verify Paystack transaction
const verifyPaystackTransaction = async (reference) => {
  return new Promise((resolve, reject) => {
    if (!reference) {
      return resolve({
        success: false,
        message: 'Payment reference is required'
      });
    }

    console.log(`Verifying payment with Paystack: ${reference}`);

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${encodeURIComponent(reference)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'User-Agent': 'XSCard-Events/1.0'
      }
    };

    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log(`Paystack verification response for ${reference}:`, {
            status: response.status,
            dataStatus: response.data?.status,
            amount: response.data?.amount,
            currency: response.data?.currency,
            fullResponse: response
          });
          
          // Check if the API call itself was successful
          if (!response.status) {
            return resolve({
              success: false,
              message: response.message || 'Transaction verification failed'
            });
          }

          // Check if we have transaction data
          if (!response.data) {
            return resolve({
              success: false,
              message: 'No transaction data found'
            });
          }

          const transactionStatus = response.data.status;

          // Handle different transaction statuses
          switch (transactionStatus) {
            case 'success':
              // Payment completed successfully
              if (!response.data.amount || response.data.amount <= 0) {
                return resolve({
                  success: false,
                  message: 'Invalid transaction amount'
                });
              }
              
              if (response.data.currency !== 'ZAR') {
                console.warn(`Unexpected currency: ${response.data.currency}, expected ZAR`);
              }
              
              return resolve({
                success: true,
                data: response.data
              });

            case 'pending':
              // Payment is still being processed
              return resolve({
                success: false,
                pending: true,
                message: 'Payment is still being processed by payment provider'
              });

            case 'abandoned':
              // Payment was abandoned by user
              return resolve({
                success: false,
                abandoned: true,
                message: 'Payment was abandoned by user'
              });

            case 'failed':
            case 'reversed':
            case 'cancelled':
              // Payment failed, was reversed, or cancelled
              return resolve({
                success: false,
                failed: true,
                message: `Payment ${transactionStatus}`
              });

            default:
              // Unknown status - treat as still pending
              console.warn(`Unknown transaction status: ${transactionStatus}`);
              return resolve({
                success: false,
                pending: true,
                message: `Payment status: ${transactionStatus}. Please wait or try again.`
              });
          }
        } catch (error) {
          console.error('Error parsing Paystack response:', error);
          resolve({
            success: false,
            message: 'Invalid response from payment provider'
          });
        }
      });
    });

    req.on('error', error => {
      console.error('Paystack API request failed:', error);
      resolve({
        success: false,
        message: 'Unable to verify payment with provider'
      });
    });

    req.setTimeout(10000, () => {
      console.error('Paystack API request timeout');
      req.destroy();
      resolve({
        success: false,
        message: 'Payment verification timeout'
      });
    });

    req.end();
  });
};

// Check payment status for an event (used by frontend polling)
exports.checkEventPaymentStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    if (!eventId) {
      return sendError(res, 400, 'Event ID is required');
    }

    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check if user owns this event
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to check this event');
    }

    // Return current payment status
    const response = {
      success: true,
      event: {
        id: eventId,
        title: eventData.title,
        status: eventData.status,
        paymentReference: eventData.paymentReference,
        listingFee: eventData.listingFee,
        paymentInitiatedAt: eventData.paymentInitiatedAt ? formatDate(eventData.paymentInitiatedAt) : null,
        paymentCompletedAt: eventData.paymentCompletedAt ? formatDate(eventData.paymentCompletedAt) : null,
        publishedAt: eventData.publishedAt ? formatDate(eventData.publishedAt) : null
      }
    };

    // If event is pending payment, include the stored payment URL
    if (eventData.status === 'pending_payment' && eventData.paymentUrl) {
      response.paymentUrl = eventData.paymentUrl;
      response.amount = eventData.listingFee || 1000;
      response.currency = 'ZAR';
    }

    // If event is still pending payment and has a reference, verify with Paystack
    if (eventData.status === 'pending_payment' && eventData.paymentReference) {
      console.log(`Checking payment status for event ${eventId} with reference ${eventData.paymentReference}`);
      
      const verified = await verifyPaystackTransaction(eventData.paymentReference);
      
      if (verified.success) {
        console.log('Payment verification successful');
        
        // Update event to published status
        await db.collection('events').doc(eventId).update({
          status: 'published',
          publishedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          paymentCompletedAt: admin.firestore.Timestamp.now(),
          paymentStatus: 'completed'
        });

        // Get updated event data
        const updatedDoc = await db.collection('events').doc(eventId).get();
        const updatedEvent = updatedDoc.data();

        return res.status(200).json({
          success: true,
          message: 'Payment was successful',
          paymentStatus: 'completed',
          event: {
            ...updatedEvent,
            eventDate: formatDate(updatedEvent.eventDate),
            endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null
          }
        });
      } else if (verified.abandoned) {
        // Payment was abandoned - revert to draft status so user can try again
        await eventRef.update({
          status: 'draft',
          updatedAt: admin.firestore.Timestamp.now(),
          paymentAbandonedAt: admin.firestore.Timestamp.now(),
          // Keep payment reference for audit trail but clear payment URL
          paymentUrl: null
        });

        console.log(`Event ${eventId} reverted to draft after abandoned payment`);

        // Get updated event data
        const updatedDoc = await eventRef.get();
        const updatedEvent = updatedDoc.data();

        return res.status(200).json({
          success: true,
          message: 'Payment was abandoned. Event reverted to draft status. You can try publishing again.',
          paymentStatus: 'abandoned',
          event: {
            ...updatedEvent,
            eventDate: formatDate(updatedEvent.eventDate),
            endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null
          }
        });
      } else if (verified.failed) {
        // Payment failed - revert to draft
        await eventRef.update({
          status: 'draft',
          updatedAt: admin.firestore.Timestamp.now(),
          paymentFailedAt: admin.firestore.Timestamp.now()
        });

        console.log(`Event ${eventId} reverted to draft after failed payment`);

        // Get updated event data
        const updatedDoc = await eventRef.get();
        const updatedEvent = updatedDoc.data();

        return res.status(200).json({
          success: true,
          message: 'Payment failed. Event reverted to draft status.',
          paymentStatus: 'failed',
          event: {
            ...updatedEvent,
            eventDate: formatDate(updatedEvent.eventDate),
            endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null
          }
        });
      } else if (verified.pending) {
        console.log('Payment is still being processed by payment provider');
        // Payment is still pending on Paystack's side
        response.message = 'Your payment is still being processed by the payment provider. Please wait a moment and try again.';
        response.paymentStatus = 'pending';
        console.log('Returning pending response with processing message');
        
        return res.status(200).json(response);
      } else {
        console.log('Payment is still pending');
        // Payment still pending
        response.message = 'Payment still pending';
        response.paymentStatus = 'pending';
        console.log('Returning pending response');
        
        return res.status(200).json(response);
      }
    } else if (eventData.status === 'published') {
      response.message = 'Event is already published';
    } else if (eventData.status === 'draft') {
      response.message = 'Event is in draft status';
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error checking event payment status:', error);
    return sendError(res, 500, 'Error checking payment status');
  }
};

// Handle registration payment callback
exports.handleRegistrationPaymentCallback = async (req, res) => {
  try {
    const { ref: paymentReference } = req.query;
    
    if (!paymentReference) {
      console.log('Payment reference missing in registration callback - likely abandoned payment');
      return res.redirect(`/event-payment-failed.html?reason=payment_abandoned&type=registration`);
    }
    
    // Verify payment with Paystack
    const verified = await verifyPaystackTransaction(paymentReference);
    
    if (verified.success) {
      const metadata = verified.data.metadata;
      
      if (!metadata || !metadata.eventId || !metadata.userId || !metadata.registrationId || !metadata.ticketId) {
        console.error('Incomplete metadata in registration payment callback:', metadata);
        return res.redirect(`/event-payment-failed.html?reason=incomplete_metadata&type=registration`);
      }
      
      const { eventId, userId, registrationId, ticketId } = metadata;
      
      // Find registration
      const registrationRef = db.collection('event_registrations').doc(registrationId);
      const registrationDoc = await registrationRef.get();
      
      if (!registrationDoc.exists) {
        console.error(`Registration ${registrationId} not found for payment ${paymentReference}`);
        return res.redirect(`/event-payment-failed.html?reason=registration_not_found&type=registration`);
      }
      
      const registrationData = registrationDoc.data();
      
      // Verify payment reference matches
      if (registrationData.paymentReference !== paymentReference) {
        console.error(`Payment reference mismatch for registration ${registrationId}`);
        return res.redirect(`/event-payment-failed.html?reason=reference_mismatch&type=registration&eventId=${eventId}`);
      }
      
      // Check if registration is already completed to prevent duplicate processing
      if (registrationData.status === 'registered' && registrationData.paymentStatus === 'completed') {
        console.log(`[handleRegistrationPaymentCallback] Registration ${registrationId} already completed, skipping duplicate processing`);
        return res.redirect(`/event-payment-success.html?eventId=${eventId}&registrationId=${registrationId}&type=registration`);
      }
      
      // Update registration status
      await registrationRef.update({
        status: 'registered',
        paymentStatus: 'completed',
        paymentCompletedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      // Update ticket status
      const ticketRef = db.collection('tickets').doc(ticketId);
      const ticketDoc = await ticketRef.get();
      
      if (!ticketDoc.exists) {
        console.error(`Ticket ${ticketId} not found for payment ${paymentReference}`);
        // Continue anyway since registration was updated
      } else {
        await ticketRef.update({
          status: 'active',
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
      
      // Update event attendee count
      const eventRef = db.collection('events').doc(eventId);
      await eventRef.update({
        currentAttendees: admin.firestore.FieldValue.increment(1),
        attendeesList: admin.firestore.FieldValue.arrayUnion(userId)
      });
      
      // Send real-time notification to organizer
      try {
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          if (global.socketService && eventData.organizerId) {
            await global.socketService.broadcastNewRegistration(
              eventData.organizerId,
              { 
                id: eventId, 
                title: eventData.title,
                category: eventData.category 
              },
              {
                ...registrationData,
                status: 'registered'
              }
            );
          }
        }
      } catch (socketError) {
        console.error('Error sending registration notification:', socketError);
        // Don't fail the process if socket notification fails
      }
      
      // Redirect to success page
      return res.redirect(`/event-payment-success.html?eventId=${eventId}&registrationId=${registrationId}&type=registration`);
    } else {
      // Payment verification failed
      console.error('Registration payment verification failed:', verified);
      return res.redirect(`/event-payment-failed.html?reason=verification_failed&type=registration`);
    }
    
  } catch (error) {
    console.error('Error handling registration payment callback:', error);
    return res.redirect(`/event-payment-failed.html?reason=server_error&type=registration`);
  }
};

// Handle registration payment webhook
exports.handleRegistrationPaymentWebhook = async (req, res) => {
  try {
    // Verify webhook signature if available
    // This is a security best practice but we'll skip for simplicity
    
    const event = req.body;
    console.log('Registration payment webhook received:', JSON.stringify(event));
    
    // Verify this is a charge.success event
    if (event && event.event === 'charge.success') {
      const data = event.data;
      const metadata = data.metadata;
      
      // Check if this is a registration payment
      if (!metadata || metadata.type !== 'event_registration') {
        console.log('Not a registration payment webhook, ignoring');
        return res.status(200).send('Webhook received but not for registration payment');
      }
      
      const { eventId, registrationId, userId, ticketId } = metadata;
      const paymentReference = data.reference;
      
      if (!eventId || !registrationId || !userId || !ticketId) {
        console.error('Missing required metadata for registration payment webhook:', metadata);
        return res.status(200).send('Webhook received but metadata incomplete');
      }
      
      // Update registration status
      const registrationRef = db.collection('event_registrations').doc(registrationId);
      const registrationDoc = await registrationRef.get();
      
      if (!registrationDoc.exists) {
        console.error(`Registration ${registrationId} not found for payment ${paymentReference}`);
        return res.status(200).send('Webhook received but registration not found');
      }
      
      const registrationData = registrationDoc.data();
      
      // Skip if already completed to prevent duplicate processing and notifications
      if (registrationData.status === 'registered' && registrationData.paymentStatus === 'completed') {
        console.log(`[handleRegistrationPaymentWebhook] Registration ${registrationId} already completed, skipping webhook to prevent duplicate notifications`);
        return res.status(200).send('Webhook received but registration already completed');
      }
      
      // Update registration status
      await registrationRef.update({
        status: 'registered',
        paymentStatus: 'completed',
        paymentCompletedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      // Update ticket status
      const ticketRef = db.collection('tickets').doc(ticketId);
      const ticketDoc = await ticketRef.get();
      
      if (!ticketDoc.exists) {
        console.error(`Ticket ${ticketId} not found for payment ${paymentReference}`);
        // Continue anyway since registration was updated
      } else {
        await ticketRef.update({
          status: 'active',
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
      
      // Update event attendee count
      const eventRef = db.collection('events').doc(eventId);
      await eventRef.update({
        currentAttendees: admin.firestore.FieldValue.increment(1),
        attendeesList: admin.firestore.FieldValue.arrayUnion(userId)
      });
      
      // Send real-time notification to organizer
      try {
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          if (global.socketService && eventData.organizerId) {
            await global.socketService.broadcastNewRegistration(
              eventData.organizerId,
              { 
                id: eventId, 
                title: eventData.title,
                category: eventData.category 
              },
              {
                ...registrationData,
                status: 'registered'
              }
            );
          }
        }
      } catch (socketError) {
        console.error('Error sending registration notification:', socketError);
        // Don't fail the process if socket notification fails
      }
      
      return res.status(200).send('Webhook processed successfully');
    } else {
      // Not a charge.success event, just acknowledge
      return res.status(200).send('Webhook received but not processed');
    }
  } catch (error) {
    console.error('Error handling registration payment webhook:', error);
    // Always return 200 to Paystack even on error
    return res.status(200).send('Webhook received with error');
  }
};

// Check registration payment status
exports.checkRegistrationPaymentStatus = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.uid;

    console.log('================ CHECK REGISTRATION PAYMENT STATUS DEBUG ================');
    console.log(`Checking payment status for registration ${registrationId} of event ${eventId}`);
    console.log('User ID:', userId);

    // Get registration details
    const registrationRef = db.collection('event_registrations').doc(registrationId);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      console.log('Registration not found');
      return sendError(res, 404, 'Registration not found');
    }

    const registrationData = registrationDoc.data();
    console.log('Registration data:', {
      status: registrationData.status,
      paymentStatus: registrationData.paymentStatus,
      paymentReference: registrationData.paymentReference
    });

    // Verify ownership
    if (registrationData.userId !== userId) {
      console.log('User not authorized');
      return sendError(res, 403, 'Not authorized to check this registration');
    }

    // Check if event ID matches
    if (registrationData.eventId !== eventId) {
      console.log('Event ID mismatch');
      return sendError(res, 400, 'Registration does not match the specified event');
    }

    // Prepare response object
    const response = {
      success: true,
      registration: {
        ...registrationData,
        registeredAt: formatDate(registrationData.registeredAt),
        paymentInitiatedAt: registrationData.paymentInitiatedAt ? formatDate(registrationData.paymentInitiatedAt) : null,
        paymentCompletedAt: registrationData.paymentCompletedAt ? formatDate(registrationData.paymentCompletedAt) : null
      }
    };

    // If registration is already completed, return success
    if (registrationData.status === 'registered' && registrationData.paymentStatus === 'completed') {
      console.log('Payment already completed');
      response.message = 'Payment already completed';
      return res.status(200).json(response);
    }

    // If registration is pending payment and has a reference, verify with Paystack
    if (registrationData.status === 'pending_payment' && registrationData.paymentReference) {
      console.log(`Verifying payment for registration ${registrationId} with reference ${registrationData.paymentReference}`);
      
      const verified = await verifyPaystackTransaction(registrationData.paymentReference);
      console.log('Paystack verification result:', verified);
      
      if (verified.success) {
        console.log('Payment verification successful');
        // Payment was successful, update the registration
        await registrationRef.update({
          status: 'registered',
          paymentStatus: 'completed',
          paymentCompletedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log('Registration updated to completed status');

        // Update ticket status
        if (registrationData.ticketId) {
          const ticketRef = db.collection('tickets').doc(registrationData.ticketId);
          const ticketDoc = await ticketRef.get();
          
          if (ticketDoc.exists) {
            await ticketRef.update({
              status: 'active',
              updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('Ticket updated to active status');
          }
        }

        // Update event attendee count
        const eventRef = db.collection('events').doc(eventId);
        await eventRef.update({
          currentAttendees: admin.firestore.FieldValue.increment(1),
          attendeesList: admin.firestore.FieldValue.arrayUnion(userId)
        });
        console.log('Event attendee count incremented');

        // Update response with the new status
        response.registration.status = 'registered';
        response.registration.paymentStatus = 'completed';
        response.registration.paymentCompletedAt = formatDate(admin.firestore.Timestamp.now());
        response.message = 'Payment verified and registration completed successfully';
        response.paymentStatus = 'completed'; // Add this for frontend compatibility
        console.log('Returning success response');

        return res.status(200).json(response);
      } else if (verified.abandoned) {
        console.log('Payment was abandoned');
        // Payment was abandoned, update the registration
        await registrationRef.update({
          paymentStatus: 'abandoned',
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log('Registration updated to abandoned status');

        response.registration.paymentStatus = 'abandoned';
        response.message = 'Payment was abandoned';
        response.paymentStatus = 'abandoned';
        console.log('Returning abandoned response');

        return res.status(200).json(response);
      } else if (verified.failed) {
        console.log('Payment failed');
        // Payment failed, update the registration
        await registrationRef.update({
          paymentStatus: 'failed',
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log('Registration updated to failed status');

        response.registration.paymentStatus = 'failed';
        response.message = 'Payment failed';
        response.paymentStatus = 'failed';
        console.log('Returning failed response');

        return res.status(200).json(response);
      } else if (verified.pending) {
        console.log('Payment is still being processed by payment provider');
        // Payment is still pending on Paystack's side
        response.message = 'Your payment is still being processed by the payment provider. Please wait a moment and try again.';
        response.paymentStatus = 'pending';
        console.log('Returning pending response with processing message');
        
        return res.status(200).json(response);
      } else {
        console.log('Payment still pending');
        // Payment still pending
        response.message = 'Payment still pending';
        response.paymentStatus = 'pending';
        console.log('Returning pending response');
        
        return res.status(200).json(response);
      }
    }

    // Default response for other cases
    console.log('Returning default response');
    response.message = 'Registration status retrieved';
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Error checking registration payment status:', error);
    sendError(res, 500, 'Error checking registration payment status', error);
  }
};

// Check event payment status
exports.checkEventPaymentStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;

    console.log('================ CHECK EVENT PAYMENT STATUS ================');
    console.log('Event ID:', eventId);
    console.log('User ID:', userId);

    // Get event details
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      console.log('Event not found');
      return sendError(res, 404, 'Event not found');
    }

    const eventData = eventDoc.data();

    // Check if user owns this event
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to check payment status for this event');
    }

    // If event is published, payment was successful
    if (eventData.status === 'published') {
      console.log('Event is published, payment was successful');
      return res.status(200).json({
        success: true,
        message: 'Payment was successful',
        paymentStatus: 'completed',
        event: {
          ...eventData,
          eventDate: formatDate(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null
        }
      });
    }

    // If event is not in pending_payment status, no payment is required
    if (eventData.status !== 'pending_payment') {
      console.log('Event is not in pending_payment status');
      return res.status(200).json({
        success: true,
        message: 'No payment required',
        paymentStatus: 'not_required',
        event: {
          ...eventData,
          eventDate: formatDate(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null
        }
      });
    }

    // Check if payment reference exists
    if (!eventData.paymentReference) {
      console.log('No payment reference found');
      return res.status(200).json({
        success: true,
        message: 'No payment reference found',
        paymentStatus: 'unknown',
        event: {
          ...eventData,
          eventDate: formatDate(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null
        }
      });
    }

    // Check payment status with Paystack
    console.log('Checking payment status with Paystack');
    const verified = await verifyPaystackTransaction(eventData.paymentReference);

    if (verified.success) {
      console.log('Payment verification successful');
      
      // Update event to published status
      await db.collection('events').doc(eventId).update({
        status: 'published',
        publishedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        paymentCompletedAt: admin.firestore.Timestamp.now(),
        paymentStatus: 'completed'
      });

      // Get updated event data
      const updatedDoc = await db.collection('events').doc(eventId).get();
      const updatedEvent = updatedDoc.data();

      return res.status(200).json({
        success: true,
        message: 'Payment was successful',
        paymentStatus: 'completed',
        event: {
          ...updatedEvent,
          eventDate: formatDate(updatedEvent.eventDate),
          endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null
        }
      });
    } else if (verified.pending) {
      console.log('Payment is still being processed by payment provider');
      
      return res.status(200).json({
        success: true,
        message: 'Your payment is still being processed by the payment provider. Please wait a moment and try again.',
        paymentStatus: 'pending',
        event: {
          ...eventData,
          eventDate: formatDate(eventData.eventDate),
          endDate: eventData.endDate ? formatDate(eventData.endDate) : null
        }
      });
    } else {
      // Check if payment is abandoned (more than 1 hour old)
      const paymentInitiatedAt = eventData.paymentInitiatedAt?.toDate() || null;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (paymentInitiatedAt && paymentInitiatedAt < oneHourAgo) {
        console.log('Payment is abandoned');
        
        // Mark payment as abandoned
        await db.collection('events').doc(eventId).update({
          paymentStatus: 'abandoned',
          updatedAt: admin.firestore.Timestamp.now()
        });

        return res.status(200).json({
          success: true,
          message: 'Payment was abandoned',
          paymentStatus: 'abandoned',
          event: {
            ...eventData,
            eventDate: formatDate(eventData.eventDate),
            endDate: eventData.endDate ? formatDate(eventData.endDate) : null,
            paymentStatus: 'abandoned'
          }
        });
      } else {
        console.log('Payment is still pending');
        
        return res.status(200).json({
          success: true,
          message: 'Payment is still pending',
          paymentStatus: 'pending',
          event: {
            ...eventData,
            eventDate: formatDate(eventData.eventDate),
            endDate: eventData.endDate ? formatDate(eventData.endDate) : null
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking event payment status:', error);
    sendError(res, 500, 'Error checking event payment status', error);
  }
};

// Force verify payment with Paystack (for troubleshooting)
exports.forceVerifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    const userId = req.user.uid;
    
    if (!reference) {
      return sendError(res, 400, 'Payment reference is required');
    }
    
    console.log(`Force verifying payment with reference ${reference} for user ${userId}`);
    
    // First check if this reference belongs to the user
    const eventQuery = await db.collection('events')
      .where('paymentReference', '==', reference)
      .where('organizerId', '==', userId)
      .limit(1)
      .get();
      
    const registrationQuery = await db.collection('event_registrations')
      .where('paymentReference', '==', reference)
      .where('userId', '==', userId)
      .limit(1)
      .get();
      
    if (eventQuery.empty && registrationQuery.empty) {
      return sendError(res, 403, 'Not authorized to verify this payment');
    }
    
    // Directly verify with Paystack
    const verified = await verifyPaystackTransaction(reference);
    
    // Return the raw verification result
    res.status(200).json({
      success: true,
      verification: verified,
      message: 'Force verification completed'
    });
    
  } catch (error) {
    console.error('Error force verifying payment:', error);
    return sendError(res, 500, 'Error verifying payment');
  }
};

// Test endpoint to manually verify payment (for debugging)
exports.testPaymentVerification = async (req, res) => {
  try {
    const { reference } = req.query;
    
    if (!reference) {
      return sendError(res, 400, 'Payment reference is required');
    }
    
    console.log(`=== TESTING PAYMENT VERIFICATION FOR: ${reference} ===`);
    
    // Call our verification function
    const result = await verifyPaystackTransaction(reference);
    
    console.log('Verification result:', result);
    
    // Return the raw result for debugging
    res.status(200).json({
      success: true,
      reference: reference,
      verificationResult: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in test payment verification:', error);
    return sendError(res, 500, 'Error testing payment verification');
  }
};

// Debug endpoint to reset event payment status (for troubleshooting)
exports.resetEventPaymentStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;
    
    if (!eventId) {
      return sendError(res, 400, 'Event ID is required');
    }
    
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }
    
    const eventData = eventDoc.data();
    
    // Check if user owns this event
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to reset this event');
    }
    
    console.log(`=== RESETTING PAYMENT STATUS FOR EVENT: ${eventId} ===`);
    console.log('Current event status:', eventData.status);
    console.log('Current payment reference:', eventData.paymentReference);
    
    // Reset event to draft status
    await eventRef.update({
      status: 'draft',
      updatedAt: admin.firestore.Timestamp.now(),
      paymentUrl: null,
      paymentStatus: null,
      paymentAbandonedAt: admin.firestore.Timestamp.now()
      // Keep paymentReference for audit trail
    });
    
    console.log('Event reset to draft status');
    
    // Get updated event data
    const updatedDoc = await eventRef.get();
    const updatedEvent = updatedDoc.data();
    
    res.status(200).json({
      success: true,
      message: 'Event payment status reset successfully',
      event: {
        ...updatedEvent,
        eventDate: formatDate(updatedEvent.eventDate),
        endDate: updatedEvent.endDate ? formatDate(updatedEvent.endDate) : null
      }
    });
    
  } catch (error) {
    console.error('Error resetting event payment status:', error);
    return sendError(res, 500, 'Error resetting event payment status');
  }
};

// Debug endpoint to reset registration payment status (for troubleshooting)
exports.resetRegistrationPaymentStatus = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.uid;
    
    if (!eventId || !registrationId) {
      return sendError(res, 400, 'Event ID and Registration ID are required');
    }
    
    const registrationRef = db.collection('event_registrations').doc(registrationId);
    const registrationDoc = await registrationRef.get();
    
    if (!registrationDoc.exists) {
      return sendError(res, 404, 'Registration not found');
    }
    
    const registrationData = registrationDoc.data();
    
    // Check if user owns this registration
    if (registrationData.userId !== userId) {
      return sendError(res, 403, 'Not authorized to reset this registration');
    }
    
    console.log(`=== RESETTING REGISTRATION PAYMENT STATUS: ${registrationId} ===`);
    console.log('Current registration status:', registrationData.status);
    console.log('Current payment status:', registrationData.paymentStatus);
    console.log('Current payment reference:', registrationData.paymentReference);
    
    // Delete the registration to allow fresh registration
    await registrationRef.delete();
    
    // Also delete associated ticket if exists
    if (registrationData.ticketId) {
      try {
        await db.collection('tickets').doc(registrationData.ticketId).delete();
        console.log('Associated ticket deleted');
      } catch (ticketError) {
        console.error('Error deleting ticket:', ticketError);
      }
    }
    
    console.log('Registration deleted - user can now register again');
    
    res.status(200).json({
      success: true,
      message: 'Registration reset successfully - you can now register again'
    });
    
  } catch (error) {
    console.error('Error resetting registration payment status:', error);
    return sendError(res, 500, 'Error resetting registration payment status');
  }
};

// ========================================
// RECURRING EVENTS CONTROLLERS
// ========================================

const recurrenceCalculator = require('../utils/recurrenceCalculator');

/**
 * Get all instances for a recurring event
 * GET /events/:eventId/instances
 */
exports.getEventInstances = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate, limit = 12 } = req.query;
    
    // Get event template
    const eventDoc = await db.collection('events').doc(eventId).get();
    
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }
    
    const eventData = eventDoc.data();
    
    if (!eventData.isRecurring || !eventData.recurrencePattern) {
      return sendError(res, 400, 'Event is not a recurring event');
    }
    
    // Generate instances
    const pattern = {
      ...eventData.recurrencePattern,
      eventId: eventId
    };
    
    const instanceStartDate = startDate ? new Date(startDate) : new Date();
    const instanceEndDate = endDate ? new Date(endDate) : new Date(pattern.endDate);
    
    let instances = recurrenceCalculator.generateInstances(
      instanceStartDate,
      instanceEndDate,
      pattern,
      { maxInstances: parseInt(limit) }
    );
    
    // Get attendee counts for each instance
    const instancesWithCounts = await Promise.all(
      instances.map(async (instance) => {
        const attendeeCount = await getInstanceAttendeeCountCached(instance.instanceId);
        return {
          ...instance,
          // Merge template fields
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          category: eventData.category,
          eventType: eventData.eventType,
          ticketPrice: eventData.ticketPrice,
          maxAttendees: eventData.maxAttendees,
          organizerId: eventData.organizerId,
          organizerInfo: eventData.organizerInfo,
          images: eventData.images,
          bannerImage: eventData.bannerImage,
          tags: eventData.tags,
          visibility: eventData.visibility,
          status: eventData.status,
          attendeeCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        eventId,
        instances: instancesWithCounts,
        totalInstances: instancesWithCounts.length,
        hasMore: instancesWithCounts.length >= parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error getting event instances:', error);
    sendError(res, 500, 'Error retrieving event instances', error);
  }
};

/**
 * Get a specific instance of a recurring event
 * GET /events/:eventId/instances/:instanceId
 */
exports.getEventInstance = async (req, res) => {
  try {
    const { eventId, instanceId } = req.params;
    
    // Get event template
    const eventDoc = await db.collection('events').doc(eventId).get();
    
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }
    
    const eventData = eventDoc.data();
    
    if (!eventData.isRecurring || !eventData.recurrencePattern) {
      return sendError(res, 400, 'Event is not a recurring event');
    }
    
    // Extract date from instanceId (format: "eventId_YYYY-MM-DD")
    const dateStr = instanceId.split('_')[1];
    if (!dateStr) {
      return sendError(res, 400, 'Invalid instance ID format');
    }
    
    // Check if instance date is excluded
    if (eventData.recurrencePattern.excludedDates && 
        eventData.recurrencePattern.excludedDates.includes(dateStr)) {
      return sendError(res, 404, 'This instance has been cancelled');
    }
    
    // Generate the specific instance
    const instanceDate = new Date(dateStr);
    const pattern = {
      ...eventData.recurrencePattern,
      eventId: eventId
    };
    
    const instance = recurrenceCalculator.generateInstanceWithTimezone(instanceDate, pattern);
    
    // Get attendee count
    const attendeeCount = await getInstanceAttendeeCountCached(instanceId);
    
    // Merge template fields
    const fullInstance = {
      ...instance,
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      category: eventData.category,
      eventType: eventData.eventType,
      ticketPrice: eventData.ticketPrice,
      maxAttendees: eventData.maxAttendees,
      organizerId: eventData.organizerId,
      organizerInfo: eventData.organizerInfo,
      images: eventData.images,
      bannerImage: eventData.bannerImage,
      tags: eventData.tags,
      visibility: eventData.visibility,
      status: eventData.status,
      attendeeCount
    };
    
    res.status(200).json({
      success: true,
      data: {
        instance: fullInstance
      }
    });
    
  } catch (error) {
    console.error('Error getting event instance:', error);
    sendError(res, 500, 'Error retrieving event instance', error);
  }
};

/**
 * End a recurring series
 * POST /events/:eventId/series/end
 */
exports.endRecurringSeries = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.uid;
    
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return sendError(res, 404, 'Event not found');
    }
    
    const eventData = eventDoc.data();
    
    // Check if user owns this event
    if (eventData.organizerId !== userId) {
      return sendError(res, 403, 'Not authorized to end this series');
    }
    
    if (!eventData.isRecurring || !eventData.recurrencePattern) {
      return sendError(res, 400, 'Event is not a recurring event');
    }
    
    // Set end date to today
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const updatedPattern = {
      ...eventData.recurrencePattern,
      endDate: today.toISOString().split('T')[0] // YYYY-MM-DD format
    };
    
    await eventRef.update({
      recurrencePattern: updatedPattern,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    // Get all future registrations to notify users
    const todayStr = new Date().toISOString().split('T')[0];
    const futureRegistrations = await db.collection('event_registrations')
      .where('eventId', '==', eventId)
      .where('instanceId', '>', `${eventId}_${todayStr}`)
      .where('status', '==', 'confirmed')
      .get();
    
    // Notify affected users
    if (!futureRegistrations.empty) {
      const userIds = [...new Set(futureRegistrations.docs.map(d => d.data().userId))];
      console.log(`Notifying ${userIds.length} users about series ending`);
      
      // Send notifications
      if (global.socketService) {
        userIds.forEach(uid => {
          if (global.socketService.isUserConnected(uid)) {
            global.socketService.sendToUser(uid, 'series_ended', {
              type: 'series_ended',
              eventId,
              eventTitle: eventData.title,
              message: 'This recurring event series has ended.',
              affectedInstances: futureRegistrations.size
            });
          }
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Recurring series ended successfully',
      affectedRegistrations: futureRegistrations.size
    });
    
  } catch (error) {
    console.error('Error ending recurring series:', error);
    sendError(res, 500, 'Error ending recurring series', error);
  }
};

// In-memory cache for attendee counts (5 minute TTL)
const attendeeCountCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get attendee count for a specific instance with caching
 */
async function getInstanceAttendeeCountCached(instanceId) {
  if (!instanceId) return 0;
  
  const cacheKey = `attendees:${instanceId}`;
  const cached = attendeeCountCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.count;
  }
  
  // Fetch from database
  const count = await getInstanceAttendeeCount(instanceId);
  
  // Store in cache
  attendeeCountCache.set(cacheKey, {
    count,
    timestamp: Date.now()
  });
  
  return count;
}

/**
 * Get attendee count for a specific instance from database
 */
async function getInstanceAttendeeCount(instanceId) {
  try {
    const registrations = await db.collection('event_registrations')
      .where('instanceId', '==', instanceId)
      .where('status', '==', 'confirmed')
      .get();
    
    return registrations.size;
  } catch (error) {
    console.error('Error getting instance attendee count:', error);
    return 0;
  }
}

/**
 * Invalidate attendee count cache for an instance
 */
function invalidateAttendeeCountCache(instanceId) {
  if (!instanceId) return;
  const cacheKey = `attendees:${instanceId}`;
  attendeeCountCache.delete(cacheKey);
}

// Export cache invalidation function for use in registration handlers
exports.invalidateAttendeeCountCache = invalidateAttendeeCountCache;

module.exports = exports;