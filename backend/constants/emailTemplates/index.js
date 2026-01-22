/**
 * Email Templates Index
 * Centralized exports for all email templates
 * Organized by category in separate files for maintainability
 */

const { getContactConfirmationEmail } = require('./contactConfirmation');

module.exports = {
    // Contact-related emails
    getContactConfirmationEmail,
    
    // Future templates will be added here:
    // getContactSavedNotificationEmail,
    // getVerificationEmail,
    // getPasswordResetEmail,
    // getMeetingInvitationEmail,
    // etc.
};

