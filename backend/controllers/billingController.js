/**
 * Billing Controller - Phase 4A Critical Billing Features
 * 
 * This controller handles all billing-related API endpoints following Golden Rules:
 * - ALWAYS authenticate users before providing billing information
 * - ALWAYS log access to billing data for audit trail
 * - NEVER expose sensitive financial data without proper authorization
 */

const {
    getPaymentHistory,
    getInvoiceHistory,
    generateInvoice,
    getSubscriptionStatus
} = require('../services/billingService');

const {
    getBillingNotifications,
    markNotificationAsRead
} = require('../services/notificationService');

const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * GET /billing/payment-history
 * Fetch comprehensive payment history for authenticated user
 */
const getPaymentHistoryController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log(`📊 Payment history request from user: ${userEmail}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized payment history request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view payment history'
            });
        }
        
        // Fetch payment history
        const result = await getPaymentHistory(userId);
        
        if (!result.success) {
            console.error(`❌ Payment history fetch failed for ${userEmail}:`, result.error);
            return res.status(500).json(result);
        }
        
        console.log(`✅ Payment history returned for ${userEmail}: ${result.data.transactions.length} transactions`);
        
        // Return payment history data
        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Payment history retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ Payment history controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'payment_history_controller_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to fetch payment history. Please try again later.'
        });
    }
};

/**
 * GET /billing/invoices
 * Fetch invoice history for authenticated user
 */
const getInvoiceHistoryController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log(`🧾 Invoice history request from user: ${userEmail}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized invoice history request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view invoices'
            });
        }
        
        // Fetch invoice history
        const result = await getInvoiceHistory(userId);
        
        if (!result.success) {
            console.error(`❌ Invoice history fetch failed for ${userEmail}:`, result.error);
            return res.status(500).json(result);
        }
        
        console.log(`✅ Invoice history returned for ${userEmail}: ${result.data.invoices.length} invoices`);
        
        // Return invoice history data
        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Invoice history retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ Invoice history controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'invoice_history_controller_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to fetch invoice history. Please try again later.'
        });
    }
};

/**
 * GET /billing/invoice/:invoiceId
 * Generate and fetch specific invoice for authenticated user
 */
const getInvoiceController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const invoiceId = req.params.invoiceId;
        
        console.log(`🧾 Invoice request from user: ${userEmail}, invoice: ${invoiceId}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized invoice request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view invoices'
            });
        }
        
        // Validate invoice ID
        if (!invoiceId || typeof invoiceId !== 'string') {
            console.error('❌ Invalid invoice ID provided');
            return res.status(400).json({
                success: false,
                error: 'Invalid invoice ID',
                message: 'A valid invoice ID is required'
            });
        }
        
        // Generate invoice
        const result = await generateInvoice(userId, invoiceId);
        
        if (!result.success) {
            console.error(`❌ Invoice generation failed for ${userEmail}:`, result.error);
            
            if (result.error === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found',
                    message: 'The requested invoice could not be found'
                });
            }
            
            return res.status(500).json(result);
        }
        
        console.log(`✅ Invoice generated for ${userEmail}: ${result.data.invoiceNumber}`);
        
        // Return invoice data
        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Invoice generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Invoice controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'invoice_controller_error', {
                invoiceId: req.params.invoiceId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to generate invoice. Please try again later.'
        });
    }
};

/**
 * GET /billing/status
 * Fetch comprehensive subscription status dashboard for authenticated user
 */
const getSubscriptionStatusController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log(`📊 Subscription status request from user: ${userEmail}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized subscription status request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view subscription status'
            });
        }
        
        // Fetch subscription status
        const result = await getSubscriptionStatus(userId);
        
        if (!result.success) {
            console.error(`❌ Subscription status fetch failed for ${userEmail}:`, result.error);
            return res.status(500).json(result);
        }
        
        console.log(`✅ Subscription status returned for ${userEmail}: ${result.data.subscription.status}`);
        
        // Return subscription status data
        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Subscription status retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ Subscription status controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'subscription_status_controller_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to fetch subscription status. Please try again later.'
        });
    }
};

/**
 * GET /billing/notifications
 * Fetch billing notifications for authenticated user
 */
const getBillingNotificationsController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const limit = parseInt(req.query.limit) || 20;
        
        console.log(`🔔 Billing notifications request from user: ${userEmail}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized notifications request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view notifications'
            });
        }
        
        // Validate limit parameter
        if (limit < 1 || limit > 100) {
            console.error('❌ Invalid limit parameter');
            return res.status(400).json({
                success: false,
                error: 'Invalid limit parameter',
                message: 'Limit must be between 1 and 100'
            });
        }
        
        // Fetch billing notifications
        const result = await getBillingNotifications(userId, limit);
        
        if (!result.success) {
            console.error(`❌ Notifications fetch failed for ${userEmail}:`, result.error);
            return res.status(500).json(result);
        }
        
        console.log(`✅ Notifications returned for ${userEmail}: ${result.data.notifications.length} notifications`);
        
        // Return notifications data
        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Billing notifications retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ Billing notifications controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'billing_notifications_controller_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to fetch notifications. Please try again later.'
        });
    }
};

/**
 * POST /billing/notifications/:notificationId/read
 * Mark notification as read for authenticated user
 */
const markNotificationReadController = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const notificationId = req.params.notificationId;
        
        console.log(`📖 Mark notification read request from user: ${userEmail}, notification: ${notificationId}`);
        
        // Validate user authentication
        if (!userId || !userEmail) {
            console.error('❌ Unauthorized mark notification request');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to update notifications'
            });
        }
        
        // Validate notification ID
        if (!notificationId || typeof notificationId !== 'string') {
            console.error('❌ Invalid notification ID provided');
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID',
                message: 'A valid notification ID is required'
            });
        }
        
        // Mark notification as read
        const result = await markNotificationAsRead(userId, notificationId);
        
        if (!result.success) {
            console.error(`❌ Mark notification read failed for ${userEmail}:`, result.error);
            return res.status(500).json(result);
        }
        
        console.log(`✅ Notification marked as read for ${userEmail}: ${notificationId}`);
        
        // Return success response
        res.status(200).json({
            success: true,
            message: result.message
        });
        
    } catch (error) {
        console.error('❌ Mark notification read controller error:', error.message);
        
        // Log error for audit trail
        if (req.user?.uid) {
            await logSubscriptionEvent(req.user.uid, 'mark_notification_read_controller_error', {
                notificationId: req.params.notificationId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to update notification. Please try again later.'
        });
    }
};

module.exports = {
    getPaymentHistoryController,
    getInvoiceHistoryController,
    getInvoiceController,
    getSubscriptionStatusController,
    getBillingNotificationsController,
    markNotificationReadController
};
