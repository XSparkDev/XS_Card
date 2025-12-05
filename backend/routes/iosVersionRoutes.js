const express = require('express');
const router = express.Router();
const iosVersionController = require('../controllers/iosVersionController');

// Public routes (no authentication required for version checking)
router.get('/ios-version-info', iosVersionController.getIosVersionInfo);
router.post('/ios-version-check', iosVersionController.checkIosVersion);

// Admin routes (for registering new versions - you can add authentication middleware here if needed)
router.post('/register-ios-version', iosVersionController.registerIosVersion);
router.get('/ios-versions', iosVersionController.getAllIosVersions);

module.exports = router;

