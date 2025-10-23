const { db, admin, bucket } = require('../firebase.js');
const { formatDate } = require('../utils/dateFormatter');

/**
 * Video Controller - CRUD operations for feature demo videos
 * Following patterns from apkController.js and userController.js
 */

// Shared error response helper
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).json({ 
        success: false,
        message,
        ...(error && { error: error.message })
    });
};

/**
 * CREATE - Upload a feature demo video
 * POST /api/feature-videos/upload
 */
exports.uploadVideo = async (req, res) => {
    try {
        console.log('Video upload request received');
        console.log('Request file:', req.file);
        console.log('Request body:', req.body);
        console.log('Firebase Storage URL:', req.firebaseStorageUrl);

        // Check if file was uploaded to Firebase Storage
        if (!req.firebaseStorageUrl) {
            return res.status(400).json({ 
                success: false,
                message: 'Video file upload failed - no Firebase URL found' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'No video file provided' 
            });
        }

        const { description } = req.body;
        const { originalname, mimetype, size } = req.file;
        const { uid, email } = req.user;

        console.log('Video Firebase URL found:', req.firebaseStorageUrl);

        // Create video document in Firestore
        const videoData = {
            filename: originalname,
            url: req.firebaseStorageUrl,
            size: size,
            mimeType: mimetype,
            uploadDate: admin.firestore.Timestamp.now(),
            uploadedBy: email || uid,
            description: description || '',
            uploaderUid: uid
        };

        const videoRef = db.collection('feature_videos').doc();
        await videoRef.set(videoData);

        console.log('Video uploaded successfully:', videoData);

        res.status(201).json({ 
            success: true,
            message: 'Video uploaded successfully',
            video: {
                id: videoRef.id,
                ...videoData,
                uploadDate: formatDate(videoData.uploadDate)
            }
        });
    } catch (error) {
        console.error('Error in uploadVideo:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading video',
            error: error.message
        });
    }
};

/**
 * READ - Get all feature demo videos
 * GET /api/feature-videos
 */
exports.getAllVideos = async (req, res) => {
    try {
        console.log('Fetching all feature videos');

        const videosRef = db.collection('feature_videos');
        const snapshot = await videosRef.orderBy('uploadDate', 'desc').get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                message: 'No videos found',
                videos: []
            });
        }

        const videos = [];
        snapshot.forEach(doc => {
            const videoData = doc.data();
            videos.push({
                id: doc.id,
                ...videoData,
                uploadDate: formatDate(videoData.uploadDate)
            });
        });

        console.log(`Found ${videos.length} videos`);

        res.status(200).json({
            success: true,
            videos: videos
        });
    } catch (error) {
        console.error('Error in getAllVideos:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching videos',
            error: error.message
        });
    }
};

/**
 * UPDATE - Update video metadata
 * PATCH /api/feature-videos/:videoId
 */
exports.updateVideoMetadata = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { filename, description } = req.body;

        console.log(`Updating video metadata for ID: ${videoId}`);

        // Validate that video exists
        const videoRef = db.collection('feature_videos').doc(videoId);
        const videoDoc = await videoRef.get();

        if (!videoDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Prepare update data
        const updateData = {};
        if (filename !== undefined) updateData.filename = filename;
        if (description !== undefined) updateData.description = description;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update'
            });
        }

        // Update the document
        await videoRef.update(updateData);

        // Get updated document
        const updatedDoc = await videoRef.get();
        const updatedData = updatedDoc.data();

        console.log('Video metadata updated successfully');

        res.status(200).json({
            success: true,
            message: 'Video updated successfully',
            video: {
                id: videoId,
                ...updatedData,
                uploadDate: formatDate(updatedData.uploadDate)
            }
        });
    } catch (error) {
        console.error('Error in updateVideoMetadata:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating video',
            error: error.message
        });
    }
};

/**
 * DELETE - Delete a feature demo video
 * DELETE /api/feature-videos/:videoId
 */
exports.deleteVideo = async (req, res) => {
    try {
        const { videoId } = req.params;

        console.log(`Deleting video with ID: ${videoId}`);

        // Get video document
        const videoRef = db.collection('feature_videos').doc(videoId);
        const videoDoc = await videoRef.get();

        if (!videoDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        const videoData = videoDoc.data();
        const videoUrl = videoData.url;

        // Extract file path from Firebase Storage URL
        // URL format: https://storage.googleapis.com/bucket-name/path/to/file
        const urlParts = videoUrl.split('/');
        const bucketName = urlParts[3]; // Get bucket name
        const filePath = urlParts.slice(4).join('/'); // Get file path

        console.log(`Deleting file from storage: ${filePath}`);

        // Delete file from Firebase Storage
        try {
            const file = bucket.file(filePath);
            await file.delete();
            console.log('File deleted from Firebase Storage');
        } catch (storageError) {
            console.warn('Failed to delete file from storage (may already be deleted):', storageError.message);
            // Continue with database deletion even if storage deletion fails
        }

        // Delete document from Firestore
        await videoRef.delete();

        console.log('Video deleted successfully');

        res.status(200).json({
            success: true,
            message: 'Video deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteVideo:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting video',
            error: error.message
        });
    }
};
