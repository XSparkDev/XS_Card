const express = require('express');
const router = express.Router();
const {
    getAllContactRequests,
    getContactRequestById,
    updateContactRequest,
    getContactRequestStats,
    deleteContactRequest,
    bulkUpdateContactRequests,
    getFrontendContactRequests,
    addTestContactRequests,
    fixExistingContactRequests
} = require('../controllers/contactRequestController');
const { authenticateUser } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateUser);

// Get all contact requests with filtering and pagination
router.get('/contact-requests', getAllContactRequests);

// Get contact requests in frontend format (exactly as requested)
router.get('/contact-requests/frontend', getFrontendContactRequests);

// Add test contact requests (for development/testing)
router.post('/contact-requests/test-data', addTestContactRequests);

// Fix existing contact requests without status
router.post('/contact-requests/fix-status', fixExistingContactRequests);

// Get contact request statistics
router.get('/contact-requests/stats', getContactRequestStats);

// Get single contact request by ID
router.get('/contact-requests/:id', getContactRequestById);

// Update contact request status and response
router.patch('/contact-requests/:id', updateContactRequest);

// Delete contact request
router.delete('/contact-requests/:id', deleteContactRequest);

// Bulk update contact requests
router.patch('/contact-requests/bulk/update', bulkUpdateContactRequests);

module.exports = router; 