const { db, admin } = require('../firebase.js');
const multer = require('multer');
const path = require('path');
const { formatDate } = require('../utils/dateFormatter');

// Configure storage for APK files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'xscard-' + uniqueSuffix + '.apk');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.apk') {
      cb(null, true);
    } else {
      cb(new Error('Only APK files are allowed'));
    }
  }
});

// Shared error response helper
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        message,
        ...(error && { error: error.message })
    });
};

exports.uploadApk = async (req, res) => {
    try {
        console.log('APK upload request received');
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);
        console.log('Firebase Storage URLs:', req.firebaseStorageUrls);

        const { version, versionCode, description } = req.body;

        // Validate required fields
        if (!version || !versionCode) {
            return res.status(400).json({ 
                success: false,
                message: 'Version and versionCode are required' 
            });
        }

        // Check if file was uploaded to Firebase Storage
        // Single upload middleware sets req.firebaseStorageUrl (singular) and req.file.firebaseUrl
        let apkUrl = null;
        if (req.firebaseStorageUrls && req.firebaseStorageUrls.apk) {
            apkUrl = req.firebaseStorageUrls.apk;
        } else if (req.firebaseStorageUrl) {
            apkUrl = req.firebaseStorageUrl;
        } else if (req.file && req.file.firebaseUrl) {
            apkUrl = req.file.firebaseUrl;
        }

        if (!apkUrl) {
            return res.status(400).json({ 
                success: false,
                message: 'APK file upload failed - no Firebase URL found' 
            });
        }

        console.log('APK Firebase URL found:', apkUrl);

        // Mark all previous versions as not latest
        const apkRef = db.collection('apk_versions');
        const existingVersions = await apkRef.where('isLatest', '==', true).get();
        
        const batch = db.batch();
        existingVersions.docs.forEach(doc => {
            batch.update(doc.ref, { isLatest: false });
        });

        // Add new APK version
        const newApkData = {
            version,
            versionCode: parseInt(versionCode),
            description: description || '',
            firebaseUrl: apkUrl,
            uploadDate: admin.firestore.Timestamp.now(),
            downloadCount: 0,
            isLatest: true,
            fileName: `xscard-${version}.apk`
        };

        const newApkRef = apkRef.doc();
        batch.set(newApkRef, newApkData);

        await batch.commit();

        console.log('APK version added successfully:', newApkData);

        res.status(201).json({ 
            success: true,
            message: 'APK uploaded successfully',
            apkData: {
                ...newApkData,
                uploadDate: formatDate(newApkData.uploadDate)
            }
        });
    } catch (error) {
        console.error('Error in uploadApk:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading APK',
            error: error.message
        });
    }
};

exports.downloadApk = async (req, res) => {
    try {
        console.log('APK download request received');

        // Get the latest APK version
        const apkRef = db.collection('apk_versions');
        const latestSnapshot = await apkRef.where('isLatest', '==', true).limit(1).get();

        if (latestSnapshot.empty) {
            return sendError(res, 404, 'No APK version available');
        }

        const latestApk = latestSnapshot.docs[0];
        const apkData = latestApk.data();

        // Increment download count (fire and forget)
        latestApk.ref.update({
            downloadCount: admin.firestore.FieldValue.increment(1)
        }).catch(error => {
            console.warn('Failed to increment download count:', error);
        });

        // Track download analytics
        try {
            const downloadLogRef = db.collection('apk_downloads').doc();
            await downloadLogRef.set({
                version: apkData.version,
                downloadDate: admin.firestore.Timestamp.now(),
                userAgent: req.headers['user-agent'] || '',
                ip: req.ip || req.connection.remoteAddress || '',
                referer: req.headers.referer || ''
            });
        } catch (logError) {
            console.warn('Failed to log download:', logError);
        }

        console.log(`APK download initiated for version ${apkData.version}`);

        // Redirect to Firebase Storage URL for direct download
        res.redirect(302, apkData.firebaseUrl);

    } catch (error) {
        sendError(res, 500, 'Failed to download APK', error);
    }
};

exports.getApkInfo = async (req, res) => {
    try {
        console.log('APK info request received');

        // Get the latest APK version
        const apkRef = db.collection('apk_versions');
        const latestSnapshot = await apkRef.where('isLatest', '==', true).limit(1).get();

        if (latestSnapshot.empty) {
            return res.status(404).json({
                success: false,
                message: 'No APK version available'
            });
        }

        const latestApk = latestSnapshot.docs[0];
        const apkData = latestApk.data();

        // Get total download count across all versions
        const allVersionsSnapshot = await apkRef.get();
        let totalDownloads = 0;
        allVersionsSnapshot.docs.forEach(doc => {
            totalDownloads += doc.data().downloadCount || 0;
        });

        res.status(200).json({
            success: true,
            apkInfo: {
                version: apkData.version,
                versionCode: apkData.versionCode,
                description: apkData.description,
                uploadDate: formatDate(apkData.uploadDate),
                downloadCount: apkData.downloadCount || 0,
                totalDownloads,
                fileName: apkData.fileName,
                downloadUrl: `/download-apk`
            }
        });

    } catch (error) {
        sendError(res, 500, 'Failed to get APK info', error);
    }
};

// Helper function to get all APK versions (for your admin use)
exports.getAllVersions = async (req, res) => {
    try {
        const apkRef = db.collection('apk_versions');
        const snapshot = await apkRef.orderBy('uploadDate', 'desc').get();

        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: 'No APK versions found'
            });
        }

        const versions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            versions.push({
                id: doc.id,
                version: data.version,
                versionCode: data.versionCode,
                description: data.description,
                uploadDate: formatDate(data.uploadDate),
                downloadCount: data.downloadCount || 0,
                isLatest: data.isLatest || false,
                fileName: data.fileName
            });
        });

        res.status(200).json({
            success: true,
            versions
        });

    } catch (error) {
        sendError(res, 500, 'Failed to get APK versions', error);
    }
}; 