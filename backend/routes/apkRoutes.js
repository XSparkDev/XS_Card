const express = require('express');
const router = express.Router();
const apkController = require('../controllers/apkController');
const { handleSingleUpload } = require('../middleware/fileUpload');

// Public routes (no authentication required)
router.get('/download-apk', apkController.downloadApk);
router.get('/apk-info', apkController.getApkInfo);

// Private routes (for your use only - you can manually call these)
router.post('/upload-apk', 
  handleSingleUpload('apk'), 
  apkController.uploadApk
);
router.get('/apk-versions', apkController.getAllVersions);

module.exports = router; 