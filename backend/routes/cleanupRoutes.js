/**
 * CLEANUP ROUTES
 * 
 * API endpoints for managing unverified account cleanup
 * 
 * IMPORTS NEEDED:
 * - const express = require('express');
 * - const cleanupController = require('../controllers/cleanupController');
 * - const { authenticateUser } = require('../middleware/auth');
 * 
 * TO ADD TO MAIN SERVER:
 * - const cleanupRoutes = require('./routes/cleanupRoutes');
 * - app.use('/admin', cleanupRoutes);
 */

// ===== IMPORTS (COMMENT OUT WHEN NOT USING) =====
// const express = require('express');
// const cleanupController = require('../controllers/cleanupController');
// const { authenticateUser } = require('../middleware/auth');

// const router = express.Router();

// ===== MIDDLEWARE =====
// All cleanup routes require authentication
// router.use(authenticateUser);

// ===== ROUTES =====

// GET /admin/cleanup/status - Get cleanup status and statistics
// router.get('/cleanup/status', cleanupController.getCleanupStatus);

// POST /admin/cleanup/run - Run the cleanup process
// router.post('/cleanup/run', cleanupController.runCleanup);

// GET /admin/cleanup/test - Test cleanup (dry run)
// router.get('/cleanup/test', cleanupController.testCleanup);

// ===== EXPORT =====
// module.exports = router;

// ===== FEATURE DISABLED =====
// To re-enable this feature:
// 1. Uncomment all the imports above
// 2. Uncomment all the routes above
// 3. Add the routes to your main server file
// 4. Test with the API endpoints
