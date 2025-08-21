const express = require('express');
const router = express.Router();
const { 
  getSupportedBanks,
  registerOrganiserStep1,
  registerOrganiserStep2,
  registerOrganiserStep3,
  getOrganiserStatus,
  getOrganiserProfile,
  updateOrganiserProfile
} = require('../controllers/eventOrganiserController');
const { authenticateUser } = require('../middleware/auth');

// Protected routes - require authentication
router.get('/event-organisers/banks', authenticateUser, getSupportedBanks);

// Protected routes - require authentication
router.post('/event-organisers/register/step1', authenticateUser, registerOrganiserStep1);
router.post('/event-organisers/register/step2', authenticateUser, registerOrganiserStep2);
router.post('/event-organisers/register/step3', authenticateUser, registerOrganiserStep3);
router.get('/event-organisers/status', authenticateUser, getOrganiserStatus);
router.get('/event-organisers/profile', authenticateUser, getOrganiserProfile);
router.put('/event-organisers/profile', authenticateUser, updateOrganiserProfile);

module.exports = router; 