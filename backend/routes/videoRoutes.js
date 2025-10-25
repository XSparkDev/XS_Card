/**
 * Video Routes - CRUD operations for feature demo videos
 * 
 * HTTP routes for video management following Golden Rules:
 * - ALL video endpoints MUST be authenticated (except GET which is handled in server.js)
 * - ALL video operations MUST be logged for audit trail
 * - ALL video data MUST be properly validated
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const { handleSingleUpload } = require('../middleware/fileUpload');

// Import video controller
const videoController = require('../controllers/videoController');

// Apply authentication middleware to all routes (GET is handled in server.js as public)
router.use(authenticateUser);

/**
 * POST /upload
 * Upload a feature demo video
 * 
 * Body: FormData with:
 *   - video: Video file (MP4, MOV, AVI, max 150MB)
 *   - description: Optional description
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   video: {
 *     id: string,
 *     filename: string,
 *     url: string,
 *     size: number,
 *     mimeType: string,
 *     uploadDate: string,
 *     uploadedBy: string,
 *     description: string,
 *     isDemo: boolean
 *   }
 * }
 */
router.post('/upload', handleSingleUpload('video'), videoController.uploadVideo);

/**
 * PATCH /:videoId
 * Update video metadata
 * 
 * Body: {
 *   filename?: string,
 *   description?: string,
 *   isDemo?: boolean
 * }
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   video: {
 *     id: string,
 *     filename: string,
 *     url: string,
 *     size: number,
 *     mimeType: string,
 *     uploadDate: string,
 *     uploadedBy: string,
 *     description: string,
 *     isDemo: boolean
 *   }
 * }
 */
router.patch('/:videoId', videoController.updateVideoMetadata);

/**
 * DELETE /:videoId
 * Delete a feature demo video
 * 
 * Response: {
 *   success: boolean,
 *   message: string
 * }
 */
router.delete('/:videoId', videoController.deleteVideo);

module.exports = router;
