const { db, admin } = require('../firebase.js');
const { formatDate } = require('../utils/dateFormatter');

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
 * Get iOS app version info
 * Returns the latest version and minimum required version
 */
exports.getIosVersionInfo = async (req, res) => {
    try {
        console.log('iOS version info request received');

        // Get the latest iOS version
        const iosRef = db.collection('ios_versions');
        const latestSnapshot = await iosRef.where('isLatest', '==', true).limit(1).get();

        if (latestSnapshot.empty) {
            // If no versions exist, return a default response
            return res.status(200).json({
                success: true,
                versionInfo: {
                    latestVersion: '0.0.0',
                    latestBuildNumber: '0',
                    minimumRequiredVersion: '0.0.0',
                    minimumRequiredBuildNumber: '0',
                    forceUpdate: false,
                    updateMessage: '',
                    updateUrl: 'https://apps.apple.com/app/id6742452317',
                    releaseNotes: ''
                }
            });
        }

        const latestVersion = latestSnapshot.docs[0];
        const latestData = latestVersion.data();

        // Get minimum required version (if set)
        const minimumSnapshot = await iosRef.where('isMinimumRequired', '==', true).limit(1).get();
        let minimumData = null;
        if (!minimumSnapshot.empty) {
            minimumData = minimumSnapshot.docs[0].data();
        }

        // Determine if update is required
        const forceUpdate = minimumData !== null && 
            compareVersions(minimumData.version, latestData.version) > 0;

        res.status(200).json({
            success: true,
            versionInfo: {
                latestVersion: latestData.version,
                latestBuildNumber: String(latestData.buildNumber || latestData.versionCode || '0'),
                minimumRequiredVersion: minimumData?.version || latestData.version,
                minimumRequiredBuildNumber: String(minimumData?.buildNumber || minimumData?.versionCode || latestData.buildNumber || '0'),
                forceUpdate: forceUpdate,
                updateMessage: latestData.updateMessage || 'A new version of XS Card is available. Please update to continue.',
                updateUrl: latestData.updateUrl || 'https://apps.apple.com/app/id6742452317',
                releaseNotes: latestData.releaseNotes || '',
                publishedAt: latestData.publishedAt ? formatDate(latestData.publishedAt) : formatDate(latestData.uploadDate)
            }
        });

    } catch (error) {
        sendError(res, 500, 'Failed to get iOS version info', error);
    }
};

/**
 * Check if current version needs update
 * Client sends their current version, we check if update is required
 */
exports.checkIosVersion = async (req, res) => {
    try {
        const { currentVersion, currentBuildNumber } = req.body;

        if (!currentVersion) {
            return res.status(400).json({
                success: false,
                message: 'currentVersion is required'
            });
        }

        console.log(`iOS version check request: version=${currentVersion}, build=${currentBuildNumber || 'N/A'}`);

        // Get the latest iOS version
        const iosRef = db.collection('ios_versions');
        const latestSnapshot = await iosRef.where('isLatest', '==', true).limit(1).get();

        if (latestSnapshot.empty) {
            return res.status(200).json({
                success: true,
                needsUpdate: false,
                forceUpdate: false,
                versionInfo: null
            });
        }

        const latestVersion = latestSnapshot.docs[0];
        const latestData = latestVersion.data();

        // Get minimum required version
        const minimumSnapshot = await iosRef.where('isMinimumRequired', '==', true).limit(1).get();
        let minimumData = null;
        if (!minimumSnapshot.empty) {
            minimumData = minimumSnapshot.docs[0].data();
        }

        // Compare versions
        const latestVersionComparison = compareVersions(currentVersion, latestData.version);
        const hasNewVersion = latestVersionComparison < 0; // Current is older than latest

        // Check if force update is required
        const minimumVersion = minimumData?.version || latestData.version;
        const minimumComparison = compareVersions(currentVersion, minimumVersion);
        const forceUpdate = minimumComparison < 0; // Current is older than minimum required

        // Also check build numbers if provided
        let needsUpdate = hasNewVersion;
        if (currentBuildNumber && latestData.buildNumber) {
            const currentBuild = parseInt(currentBuildNumber) || 0;
            const latestBuild = parseInt(latestData.buildNumber) || parseInt(latestData.versionCode) || 0;
            needsUpdate = currentBuild < latestBuild;
        }

        res.status(200).json({
            success: true,
            needsUpdate: needsUpdate || forceUpdate,
            forceUpdate: forceUpdate,
            versionInfo: {
                currentVersion,
                currentBuildNumber: currentBuildNumber || 'N/A',
                latestVersion: latestData.version,
                latestBuildNumber: String(latestData.buildNumber || latestData.versionCode || '0'),
                minimumRequiredVersion: minimumData?.version || latestData.version,
                minimumRequiredBuildNumber: String(minimumData?.buildNumber || minimumData?.versionCode || latestData.buildNumber || '0'),
                updateMessage: latestData.updateMessage || 'A new version of XS Card is available. Please update to continue.',
                updateUrl: latestData.updateUrl || 'https://apps.apple.com/app/id6742452317',
                releaseNotes: latestData.releaseNotes || ''
            }
        });

    } catch (error) {
        sendError(res, 500, 'Failed to check iOS version', error);
    }
};

/**
 * Upload/register a new iOS version (admin only)
 */
exports.registerIosVersion = async (req, res) => {
    try {
        const { version, buildNumber, versionCode, isMinimumRequired, updateMessage, updateUrl, releaseNotes, publishedAt } = req.body;

        // Validate required fields
        if (!version) {
            return res.status(400).json({ 
                success: false,
                message: 'version is required' 
            });
        }

        const buildNum = buildNumber || versionCode || '0';

        console.log(`Registering iOS version: ${version} (build: ${buildNum})`);

        const iosRef = db.collection('ios_versions');

        // Mark all previous versions as not latest
        const existingVersions = await iosRef.where('isLatest', '==', true).get();
        const batch = db.batch();
        existingVersions.docs.forEach(doc => {
            batch.update(doc.ref, { isLatest: false });
        });

        // If this is marked as minimum required, unmark others
        if (isMinimumRequired) {
            const existingMinimum = await iosRef.where('isMinimumRequired', '==', true).get();
            existingMinimum.docs.forEach(doc => {
                batch.update(doc.ref, { isMinimumRequired: false });
            });
        }

        // Add new iOS version
        const newVersionData = {
            version,
            buildNumber: parseInt(buildNum),
            versionCode: parseInt(buildNum), // For compatibility
            isLatest: true,
            isMinimumRequired: isMinimumRequired || false,
            updateMessage: updateMessage || 'A new version of XS Card is available. Please update to continue.',
            updateUrl: updateUrl || 'https://apps.apple.com/app/id6742452317',
            releaseNotes: releaseNotes || '',
            uploadDate: admin.firestore.Timestamp.now(),
            publishedAt: publishedAt ? admin.firestore.Timestamp.fromDate(new Date(publishedAt)) : admin.firestore.Timestamp.now()
        };

        const newVersionRef = iosRef.doc();
        batch.set(newVersionRef, newVersionData);

        await batch.commit();

        console.log('iOS version registered successfully:', newVersionData);

        res.status(201).json({ 
            success: true,
            message: 'iOS version registered successfully',
            versionData: {
                ...newVersionData,
                uploadDate: formatDate(newVersionData.uploadDate),
                publishedAt: formatDate(newVersionData.publishedAt)
            }
        });
    } catch (error) {
        console.error('Error in registerIosVersion:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering iOS version',
            error: error.message
        });
    }
};

/**
 * Get all iOS versions (admin use)
 */
exports.getAllIosVersions = async (req, res) => {
    try {
        const iosRef = db.collection('ios_versions');
        const snapshot = await iosRef.orderBy('uploadDate', 'desc').get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                versions: []
            });
        }

        const versions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            versions.push({
                id: doc.id,
                version: data.version,
                buildNumber: data.buildNumber || data.versionCode,
                isLatest: data.isLatest || false,
                isMinimumRequired: data.isMinimumRequired || false,
                updateMessage: data.updateMessage || '',
                updateUrl: data.updateUrl || '',
                releaseNotes: data.releaseNotes || '',
                uploadDate: formatDate(data.uploadDate),
                publishedAt: data.publishedAt ? formatDate(data.publishedAt) : null
            });
        });

        res.status(200).json({
            success: true,
            versions
        });

    } catch (error) {
        sendError(res, 500, 'Failed to get iOS versions', error);
    }
};

/**
 * Helper function to compare semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 < part2) return -1;
        if (part1 > part2) return 1;
    }
    
    return 0;
}

