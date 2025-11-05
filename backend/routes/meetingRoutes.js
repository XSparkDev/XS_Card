const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

// IMPORTANT: Specific routes MUST come before parameterized routes
// Calendar preferences endpoints (must be before /meetings/:userId)
router.get('/meetings/preferences', meetingController.getCalendarPreferences);
router.put('/meetings/preferences', meetingController.updateCalendarPreferences);

// New endpoint for sending meeting invites
router.post('/meetings/invite', meetingController.sendMeetingInvite);

// Changed PUT to PATCH for partial updates
// Parameterized routes come last
router.get('/meetings/:userId', meetingController.getAllMeetings);
router.post('/meetings', meetingController.createMeeting);
router.patch('/meetings/:userId/:meetingIndex', meetingController.updateMeeting);
router.delete('/meetings/:userId/:meetingIndex', meetingController.deleteMeeting);

module.exports = router;
