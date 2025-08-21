const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateUser } = require('../middleware/auth');

// Keep these public routes
router.post('/saveContactInfo', contactController.saveContactInfo);
router.post('/saveContact', contactController.saveContactInfo);
router.post('/public/saveContact', contactController.saveContactInfo);

// Protected routes - apply authentication middleware individually
router.get('/Contacts', authenticateUser, contactController.getAllContacts);
router.get('/Contacts/:id', authenticateUser, contactController.getContactById);
router.patch('/Contacts/:id', authenticateUser, contactController.updateContact);
router.delete('/Contacts/:id', authenticateUser, contactController.deleteContact);
router.delete('/Contacts/:id/contact/:index', authenticateUser, contactController.deleteContactFromList);

module.exports = router;
