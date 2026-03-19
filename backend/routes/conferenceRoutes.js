const express = require('express');
const router = express.Router();

const { getUserStatus, getConferenceUsers } = require('../controllers/conferenceController');
const { conferenceAuth } = require('../middleware/conferenceAuth');

router.get('/api/conference/user-status/:id', conferenceAuth, getUserStatus);
router.get('/api/conference/users', conferenceAuth, getConferenceUsers);

module.exports = router;

 