/**
 * OAuth Routes
 * 
 * NEW FILE (POOP) - OAuth endpoints for Google, LinkedIn, Microsoft
 * Does NOT modify existing routes (CEMENT)
 */

const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');

// Google OAuth routes
router.get('/google/start', oauthController.startGoogleOAuth);
router.get('/google/callback', oauthController.handleGoogleCallback);

// Phase 4: LinkedIn OAuth routes (POOP)
router.get('/linkedin/start', oauthController.startLinkedInOAuth);
router.get('/linkedin/callback', oauthController.handleLinkedInCallback);

// TODO: Add Microsoft OAuth routes here when implementing
// router.get('/microsoft/start', oauthController.startMicrosoftOAuth);
// router.get('/microsoft/callback', oauthController.handleMicrosoftCallback);

module.exports = router;

