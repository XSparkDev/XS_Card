const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateUser, optionalAuthentication } = require('../middleware/auth');
const { handleMultipleUploads } = require('../middleware/fileUpload');
const EventBroadcastMiddleware = require('../middleware/eventBroadcastMiddleware');

// Initialize database endpoint (can be called once to set up collections)
router.post('/events/initialize-db', eventController.initializeDatabase);

// Public routes (with optional authentication for private event visibility)
router.get('/events/public', optionalAuthentication, eventController.getAllEvents);
router.get('/events/search', optionalAuthentication, eventController.searchEvents);

// WebSocket status endpoint for monitoring (optional)
router.get('/events/websocket/status', (req, res) => {
  try {
    const status = EventBroadcastMiddleware.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting WebSocket status',
      error: error.message
    });
  }
});

// Credit system routes (PROTECTED ROUTES)
router.get('/user/credits', authenticateUser, eventController.getUserCredits);

// Payment handling routes for event publishing
router.get('/events/payment/callback', eventController.handlePaymentCallback);
router.post('/events/payment/webhook', eventController.handlePaymentWebhook);
router.get('/events/:eventId/payment/status', authenticateUser, eventController.checkEventPaymentStatus);
router.get('/events/payment/force-verify', authenticateUser, eventController.forceVerifyPayment);
router.get('/events/payment/test-verify', authenticateUser, eventController.testPaymentVerification);
router.post('/events/:eventId/payment/reset', authenticateUser, eventController.resetEventPaymentStatus);

// Payment handling routes for event registration
router.get('/events/registration/payment/callback', eventController.handleRegistrationPaymentCallback);
router.post('/events/registration/payment/webhook', eventController.handleRegistrationPaymentWebhook);
router.get('/events/:eventId/registration/:registrationId/payment/status', authenticateUser, eventController.checkRegistrationPaymentStatus);
router.post('/events/:eventId/registration/:registrationId/payment/reset', authenticateUser, eventController.resetRegistrationPaymentStatus);

// Admin routes for credit management
router.post('/admin/credits/reset', eventController.resetMonthlyCredits);

// Event CRUD operations with WebSocket broadcasting (PROTECTED ROUTES)
router.post('/events', 
  authenticateUser,
  handleMultipleUploads([
    { name: 'bannerImage', maxCount: 1 },
    { name: 'eventImages', maxCount: 5 }
  ]), 
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterEventCreation),
  eventController.createEvent
);

router.get('/events/:eventId', authenticateUser, eventController.getEventById);

router.patch('/events/:eventId', 
  authenticateUser,
  handleMultipleUploads([
    { name: 'bannerImage', maxCount: 1 },
    { name: 'eventImages', maxCount: 5 }
  ]),
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterSuccess('event_update')),
  eventController.updateEvent
);

router.delete('/events/:eventId', 
  authenticateUser,
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterSuccess('event_cancelled')),
  eventController.deleteEvent
);

router.post('/events/:eventId/publish', 
  authenticateUser,
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterEventPublishing),
  eventController.publishEvent
);

// Event registration with broadcasting (PROTECTED ROUTES)
router.post('/events/:eventId/register', 
  authenticateUser,
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterRegistration),
  eventController.registerForEvent
);

router.post('/events/:eventId/unregister', 
  authenticateUser,
  EventBroadcastMiddleware.conditionally(EventBroadcastMiddleware.broadcastAfterUnregistration),
  eventController.unregisterFromEvent
);

// User-specific routes (PROTECTED ROUTES)
router.get('/user/events', authenticateUser, eventController.getUserEvents);
router.get('/user/registrations', authenticateUser, eventController.getUserRegistrations);

// Get user's ticket for a specific event
router.get('/events/:eventId/my-ticket', authenticateUser, eventController.getMyTicketForEvent);

// QR Code Check-in System Routes (PROTECTED ROUTES)

// Attendee routes - Generate QR codes for their tickets
router.post('/tickets/:ticketId/qr', authenticateUser, eventController.generateTicketQR);

// Organizer routes - QR code validation and check-in management
router.post('/events/qr/validate', authenticateUser, eventController.validateQRCode);
router.post('/events/qr/checkin', authenticateUser, eventController.processCheckIn);

// Event check-in management for organizers
router.get('/events/:eventId/checkin/stats', authenticateUser, eventController.getCheckInStats);
router.get('/events/:eventId/attendees', authenticateUser, eventController.getEventAttendees);
router.post('/events/:eventId/qr/bulk', authenticateUser, eventController.generateBulkQRCodes);

module.exports = router;