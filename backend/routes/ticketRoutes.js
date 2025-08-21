const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateUser } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateUser);

// Generate and email PDF ticket
router.post('/generate-pdf-email', ticketController.generateAndEmailTicketPDF);

module.exports = router; 