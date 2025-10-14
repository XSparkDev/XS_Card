const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');
const { handleSingleUpload, handleMultipleUploads } = require('../middleware/fileUpload');
const path = require('path');

// Public routes (no authentication required)
router.post('/SignIn', userController.signIn);
router.post('/AddUser', userController.addUser);
router.post('/Users/:userId/UploadImages', 
    handleMultipleUploads([
        { name: 'profileImage', maxCount: 1 },
        { name: 'companyLogo', maxCount: 1 }
    ]), 
    userController.uploadUserImages
);
router.get('/verify-email', userController.verifyEmail);
router.post('/forgot-password', userController.forgotPassword);
router.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/templates/forgotPassword.html'));
});
router.post('/reset-password', userController.resetPassword);
router.get('/reset-password', (req, res) => {
    // Redirect to the proper HTML page
    const { token, uid } = req.query;
    if (!token || !uid) {
        return res.redirect('/templates/passwordReset.html?status=invalid-link');
    }
    res.redirect(`/templates/passwordReset.html?token=${token}&uid=${uid}`);
});
router.get('/reset-user-info', userController.getResetUserInfo);
router.post('/public/resend-verification', userController.resendVerificationPublic);

// All routes below this middleware will require authentication
router.use(authenticateUser);

// Protected routes
router.post('/validate-token', userController.validateToken);
router.post('/refresh-token', userController.refreshToken); // Phase 4B Token Refresh
router.post('/test-expired-token', userController.testExpiredToken); // Phase 4A Testing
router.post('/test-token-refresh-success', userController.testTokenRefreshSuccess); // Phase 4B Testing
router.post('/logout', userController.logout);
router.post('/resend-verification/:uid', userController.resendVerification);
router.get('/Users', userController.getAllUsers);

// Account deletion endpoint (permanent - deletes auth & anonymizes data)
// MUST be before /Users/:id to avoid route conflict
router.delete('/Users/delete-account', authenticateUser, userController.deleteUserAccount);

router.get('/Users/:id', userController.getUserById);
router.patch('/UpdateUser/:id', handleSingleUpload('profileImage'), userController.updateUser);
router.delete('/Users/:id', userController.deleteUser);
router.patch('/Users/:id/profile-image', handleSingleUpload('profileImage'), userController.updateProfileImage);
router.patch('/Users/:id/company-logo', handleSingleUpload('companyLogo'), userController.updateCompanyLogo);
router.patch('/Users/:id/color', userController.updateUserColor);
router.patch('/Users/:id/upgrade', authenticateUser, userController.upgradeToPremium);

// Event preferences routes
router.get('/user/event-preferences', userController.getEventPreferences);
router.patch('/user/event-preferences', userController.updateEventPreferences);
router.post('/user/event-preferences/initialize', userController.initializeEventPreferences);

// Testing endpoint for Phase 2B
router.post('/user/subscription-level', userController.setUserSubscriptionLevel);

// Account deactivation endpoint
router.patch('/Users', userController.deactivateUser);

// Account reactivation endpoint (admin function)
router.patch('/Users/reactivate', authenticateUser, userController.reactivateUser);

// Change password endpoint
router.post('/change-password', userController.changePassword);

module.exports = router;
