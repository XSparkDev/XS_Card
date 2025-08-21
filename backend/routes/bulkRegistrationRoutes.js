const express = require('express');
const router = express.Router();
const bulkRegistrationController = require('../controllers/bulkRegistrationController');
const { authenticateUser } = require('../middleware/auth');

// Bulk registration routes (PROTECTED ROUTES)
router.post('/events/:eventId/bulk-register', 
  authenticateUser,
  bulkRegistrationController.createBulkRegistration
);

router.get('/bulk-registrations/:bulkRegistrationId', 
  authenticateUser,
  bulkRegistrationController.getBulkRegistration
);

router.get('/user/bulk-registrations', 
  authenticateUser,
  bulkRegistrationController.getUserBulkRegistrations
);

router.delete('/bulk-registrations/:bulkRegistrationId', 
  authenticateUser,
  bulkRegistrationController.cancelBulkRegistration
);

module.exports = router; 