const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateUser } = require('../middleware/auth');

// NOTE: Public save contact routes moved to server.js top (lines 235-237) for route priority
// Only keep saveContactInfo if still used elsewhere, otherwise remove
router.post('/saveContactInfo', contactController.saveContactInfo);

// Note: Profile image endpoint moved to server.js

// Protected routes - apply authentication middleware individually
router.get('/Contacts', authenticateUser, contactController.getAllContacts);
router.get('/Contacts/:id', authenticateUser, contactController.getContactById);
router.patch('/Contacts/:id', authenticateUser, contactController.updateContact);
router.delete('/Contacts/:id', authenticateUser, contactController.deleteContact);
router.delete('/Contacts/:id/bulk', authenticateUser, contactController.deleteMultipleContacts);
router.delete('/Contacts/:id/contact/:index', authenticateUser, contactController.deleteContactFromList);

module.exports = router;
