const https = require('https');
const { db } = require('../firebase');
const { SUBSCRIPTION_PLANS, SUBSCRIPTION_CONSTANTS, getPlanById } = require('../config/subscriptionPlans');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * Save bank card data to user_bank_cards collection
 * @param {string} userId - User ID
 * @param {object} bankingData - Banking information
 */
const saveBankCardData = async (userId, bankingData) => {
    try {
        const bankCardData = {
            userId,
            accountNumber: bankingData.accountNumber,
            bankCode: bankingData.bankCode,
            bankName: bankingData.bankName,
            accountName: bankingData.accountName,
            isVerified: bankingData.isVerified || false,
            verificationData: bankingData.verificationData || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Use userId as document ID to ensure one bank account per user
        await db.collection('user_bank_cards').doc(userId).set(bankCardData);
        
        console.log(`Bank card data saved for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error saving bank card data:', error);
        throw error;
    }
};

/**
 * Get user's saved bank card data
 * @param {string} userId - User ID
 */
const getUserBankCardData = async (userId) => {
    try {
        const bankCardDoc = await db.collection('user_bank_cards').doc(userId).get();
        
        if (!bankCardDoc.exists) {
            return null;
        }
        
        return bankCardDoc.data();
    } catch (error) {
        console.error('Error getting bank card data:', error);
        return null;
    }
};

/**
 * Initialize a subscription with Paystack
 * Uses the authenticated user's email and the selected plan ID
 */
const initializeSubscription = async (req, res) => {
    try {
        const { planId } = req.body;
        const userEmail = req.user.email;

        // Validate request
        if (!planId) {
            return res.status(400).json({
                status: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details from configuration
        const plan = getPlanById(planId);
        if (!plan) {
            return res.status(400).json({
                status: false,
                message: 'Invalid plan ID'
            });
        }

        const baseUrl = process.env.APP_URL;

        // Prepare Paystack request parameters
        const params = JSON.stringify({
            email: userEmail,
            amount: plan.amount * 100, // Convert to kobo/cents
            plan: plan.planCode,
            callback_url: `${baseUrl}/subscription/callback`,
            metadata: {
                planId: plan.id,
                cancel_action: `${baseUrl}/subscription/cancel`
            }
        });

        // Configure Paystack API request
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Make the request to Paystack
        const subscriptionReq = https.request(options, subscriptionRes => {
            let data = '';

            subscriptionRes.on('data', (chunk) => {
                data += chunk;
            });

            subscriptionRes.on('end', () => {
                const response = JSON.parse(data);
                res.status(200).json(response);
            });
        });

        subscriptionReq.on('error', (error) => {
            console.error('Subscription error:', error);
            res.status(500).json({ 
                status: false,
                message: 'Subscription initialization failed',
                error: error.message 
            });
        });

        subscriptionReq.write(params);
        subscriptionReq.end();

    } catch (error) {
        console.error('Subscription controller error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Initialize a trial subscription with Paystack
 * 1. Collect payment details (R1 charge)
 * 2. On verification, create subscription with 7-day start date
 * 3. Optionally save banking information if provided
 */
const initializeTrialSubscription = async (req, res) => {
    try {
        const { planId, bankingData } = req.body;
        const userEmail = req.user.email;
        const userId = req.user.uid;

        // Validate request
        if (!planId) {
            return res.status(400).json({
                status: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details from configuration
        const plan = getPlanById(planId);
        if (!plan) {
            return res.status(400).json({
                status: false,
                message: 'Invalid plan ID'
            });
        }

        const baseUrl = process.env.APP_URL;

        // Save banking data if provided
        if (bankingData) {
            try {
                await saveBankCardData(userId, {
                    ...bankingData,
                    isVerified: true // Assume it's verified if we're starting subscription
                });
                console.log(`Banking data saved for user ${userId} during subscription trial`);
            } catch (error) {
                console.error('Failed to save banking data:', error);
                // Don't fail the subscription if banking data save fails
            }
        }

        // Prepare Paystack request parameters for initial R1 verification
        const params = JSON.stringify({
            email: userEmail,
            amount: SUBSCRIPTION_CONSTANTS.VERIFICATION_AMOUNT, // R1.00 in cents
            callback_url: `${baseUrl}/subscription/trial/callback`,
            metadata: {
                planId: plan.id,
                isTrialSetup: true,
                userId: userId, // Add userId to metadata
                hasBankingData: !!bankingData, // Flag to indicate if banking data was provided
                cancel_action: `${baseUrl}/subscription/cancel`
            }
        });

        // Configure Paystack API request
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Make the request to Paystack
        const trialReq = https.request(options, trialRes => {
            let data = '';

            trialRes.on('data', (chunk) => {
                data += chunk;
            });

            trialRes.on('end', () => {
                const response = JSON.parse(data);
                res.status(200).json(response);
            });
        });

        trialReq.on('error', (error) => {
            console.error('Trial subscription error:', error);
            res.status(500).json({ 
                status: false,
                message: 'Trial initialization failed',
                error: error.message 
            });
        });

        trialReq.write(params);
        trialReq.end();

    } catch (error) {
        console.error('Trial subscription controller error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Verify a subscription transaction with Paystack
 */
const verifySubscription = async (reference) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Verify a transaction with Paystack
 */
const verifyTransaction = async (reference) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Issue a refund for the verification amount
 */
const issueVerificationRefund = async (reference) => {
    const params = JSON.stringify({
        transaction: reference,
        merchant_note: "Refund for trial period verification"
    });

    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/refund',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                resolve(response);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(params);
        req.end();
    });
};

/**
 * Create a subscription with Paystack
 * This uses the customer code and starts after the trial period
 */
const createDelayedSubscription = async (customerCode, planCode, email, planId) => {
    // Calculate start date (TRIAL_MINUTES minutes from now)
    const startDate = new Date();
    // Use minutes for testing instead of days
    startDate.setMinutes(startDate.getMinutes() + SUBSCRIPTION_CONSTANTS.TRIAL_MINUTES);
    const formattedStartDate = startDate.toISOString();
    
    const params = JSON.stringify({
        customer: customerCode,
        plan: planCode,
        start_date: formattedStartDate
    });

    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/subscription',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                resolve(response);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(params);
        req.end();
    });
};

/**
 * Handle subscription callback from Paystack
 */
const handleSubscriptionCallback = async (req, res) => {
    try {
        const reference = req.method === 'POST' ? req.body.data?.reference : req.query.reference;
        
        if (!reference) {
            console.error('No reference provided');
            return res.status(400).json({ message: 'No reference provided' });
        }

        console.log('Processing subscription reference:', reference);
        
        // Verify transaction with Paystack
        const paymentData = await verifySubscription(reference);
        console.log('Subscription verification response:', paymentData);
        
        if (paymentData.status && paymentData.data.status === 'success') {
            // Get user email from payment data
            const userEmail = paymentData.data.customer.email;
            console.log('Updating user subscription for email:', userEmail);
            
            // Find user by email
            const userSnapshot = await db.collection('users')
                .where('email', '==', userEmail)
                .limit(1)
                .get();

            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const metadata = paymentData.data.metadata || {};
                const planId = metadata.planId;
                const plan = getPlanById(planId);

                // Update user subscription status
                await userDoc.ref.update({
                    subscriptionStatus: 'active',
                    subscriptionPlan: planId || 'unknown',
                    subscriptionReference: reference,
                    subscriptionStart: new Date().toISOString(),
                    // Calculate end date based on plan interval
                    subscriptionEnd: plan && plan.interval === 'annually' 
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() 
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    plan: 'premium' // Set plan to premium for RBAC
                });
                console.log('User subscription updated successfully');

                // Also store the subscription details in a separate collection using userId as document ID
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId || 'unknown',
                    reference: reference,
                    amount: paymentData.data.amount / 100,
                    status: 'active',
                    startDate: new Date().toISOString(),
                    endDate: plan && plan.interval === 'annually' 
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() 
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString(),
                    transactionData: paymentData.data
                });

                // Add log entry for subscription creation
                await logSubscriptionEvent(userId, 'subscription_created', {
                    reference,
                    planId,
                    amount: paymentData.data.amount / 100,
                    interval: plan?.interval || 'unknown'
                });
            } else {
                console.error('User not found for email:', userEmail);
            }

            // Simple redirect to success page
            if (req.method === 'GET') {
                return res.redirect('/subscription-success.html');
            } else {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'Subscription processed successfully'
                });
            }
        } else {
            console.error('Subscription verification failed:', paymentData);
            // Redirect to failure page
            if (req.method === 'GET') {
                return res.redirect('/subscription-failed.html');
            } else {
                return res.status(400).json({ 
                    status: 'failed',
                    message: 'Subscription verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Subscription callback error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Handle trial subscription callback from Paystack
 */
const handleTrialCallback = async (req, res) => {
    try {
        const reference = req.method === 'POST' ? req.body.data?.reference : req.query.reference;
        
        if (!reference) {
            console.error('No reference provided');
            return res.status(400).json({ message: 'No reference provided' });
        }

        console.log('Processing trial subscription reference:', reference);
        
        // Verify transaction with Paystack
        const paymentData = await verifyTransaction(reference);
        console.log('Trial verification response:', paymentData);
        
        if (paymentData.status && paymentData.data.status === 'success') {
            // Get user email and customer code from payment data
            const userEmail = paymentData.data.customer.email;
            const customerCode = paymentData.data.customer.customer_code;
            console.log('Setting up trial for user:', userEmail, 'Customer code:', customerCode);
            
            // Get plan ID from metadata
            const metadata = paymentData.data.metadata || {};
            const planId = metadata.planId;
            const plan = getPlanById(planId);

            if (!plan) {
                console.error('Invalid plan ID in metadata:', planId);
                return res.status(400).json({ message: 'Invalid plan ID' });
            }
            
            // Find user by email
            const userSnapshot = await db.collection('users')
                .where('email', '==', userEmail)
                .limit(1)
                .get();

            if (userSnapshot.empty) {
                console.error('User not found for email:', userEmail);
                return res.status(404).json({ message: 'User not found' });
            }

            const userDoc = userSnapshot.docs[0];
            const userId = userDoc.id;
            
            // Calculate trial end date (TRIAL_MINUTES minutes from now)
            const trialEndDate = new Date();
            trialEndDate.setMinutes(trialEndDate.getMinutes() + SUBSCRIPTION_CONSTANTS.TRIAL_MINUTES);
            
            // Step 1: Issue a refund for the verification amount
            const refundResult = await issueVerificationRefund(reference);
            console.log('Refund result:', refundResult);
            
            // Even if refund fails, continue with subscription setup
            // Just log the issue for administrative follow-up
            if (!refundResult.status) {
                console.error('Failed to issue refund:', refundResult);
            }
            
            // Step 2: Create a subscription with Paystack that starts after trial
            const subscriptionResult = await createDelayedSubscription(
                customerCode, 
                plan.planCode, 
                userEmail,
                planId
            );
            
            console.log('Delayed subscription result:', subscriptionResult);

            // Handle both success case and the case where subscription already exists
            if (subscriptionResult.status || 
                (subscriptionResult.code === 'duplicate_subscription' && 
                 subscriptionResult.message?.includes('already in place'))) {
                
                // Get the subscription code - either from the result or we'll need to fetch it
                let subscriptionCode, subscriptionId;
                
                if (subscriptionResult.status) {
                    // If subscription was created successfully, get details from result
                    subscriptionCode = subscriptionResult.data.subscription_code;
                    subscriptionId = subscriptionResult.data.id;
                } else {
                    // For duplicate subscription, we need to fetch the existing subscription details
                    console.log('Subscription already exists. Using existing subscription.');
                    
                    // Log the duplicate subscription scenario
                    await logSubscriptionEvent(userId, 'duplicate_subscription_detected', {
                        customerCode,
                        planId,
                        reference
                    });
                    
                    // We'll just use placeholders for now and rely on webhooks to update with correct info
                    subscriptionCode = 'existing_subscription';
                    subscriptionId = 'existing_subscription';
                }

                // Update user with trial and subscription info
                await userDoc.ref.update({
                    subscriptionStatus: 'trial',
                    subscriptionPlan: planId,
                    customerCode: customerCode,
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    paymentReference: reference,
                    subscriptionCode: subscriptionCode,
                    subscriptionId: subscriptionId,
                    lastUpdated: new Date().toISOString(),
                    plan: 'premium' // Set plan to premium for RBAC
                });
                
                // Store subscription details using userId as document ID
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId,
                    customerCode: customerCode,
                    subscriptionCode: subscriptionCode,
                    subscriptionId: subscriptionId,
                    reference: reference,
                    status: 'trial',
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    createdAt: new Date().toISOString(),
                    paymentData: paymentData.data,
                    subscriptionData: subscriptionResult.status ? subscriptionResult.data : { 
                        note: 'Using existing subscription',
                        original_error: subscriptionResult
                    }
                });
                
                console.log('User trial subscription setup successfully');
            } else {
                console.error('Failed to create delayed subscription:', subscriptionResult);
                // Still update user with trial info but mark subscription as pending
                await userDoc.ref.update({
                    subscriptionStatus: 'trial_incomplete',
                    subscriptionPlan: planId,
                    customerCode: customerCode,
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    paymentReference: reference,
                    lastUpdated: new Date().toISOString(),
                    errorDetails: subscriptionResult
                });
            }

            // Redirect or respond based on request method
            if (req.method === 'GET') {
                return res.redirect('/subscription-trial-success.html');
            } else {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'Trial subscription setup successfully'
                });
            }
        } else {
            console.error('Trial verification failed:', paymentData);
            if (req.method === 'GET') {
                return res.redirect('/subscription-failed.html');
            } else {
                return res.status(400).json({ 
                    status: 'failed',
                    message: 'Trial verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Trial callback error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Handle Paystack webhook events
 * Used for subscription lifecycle events
 */
const handleSubscriptionWebhook = async (req, res) => {
    try {
        // Log all incoming webhook data for debugging
        console.log('Received webhook payload:', JSON.stringify(req.body));
        
        const event = req.body;
        
        // Quickly acknowledge the webhook
        res.status(200).send('Webhook received');
        
        console.log('Received webhook event:', event.event);
        
        // Handle subscription cancellation or disabling
        if (event.event === 'subscription.disable' || 
            event.event === 'subscription.not_renewing' ||
            event.event === 'subscription.deactivate') {
            
            const data = event.data;
            let customerEmail;
            let subscriptionCode;
            
            // Extract customer email and subscription code
            if (data.customer) {
                customerEmail = data.customer.email;
            } else if (data.subscription && data.subscription.customer) {
                customerEmail = data.subscription.customer.email;
            }
            
            if (data.subscription) {
                subscriptionCode = data.subscription.subscription_code;
            }
            
            console.log(`Processing subscription cancellation for: ${customerEmail}, code: ${subscriptionCode}`);
            
            // Find user by email or subscription code
            let userQuery = db.collection('users');
            if (customerEmail) {
                userQuery = userQuery.where('email', '==', customerEmail);
            } else if (subscriptionCode) {
                userQuery = userQuery.where('subscriptionCode', '==', subscriptionCode);
            } else {
                console.error('No identifiable information in webhook data');
                return;
            }
            
            const userSnapshot = await userQuery.limit(1).get();
            
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                console.log(`Updating subscription status to cancelled for user ${userId}`);
                
                // Update user with cancelled status and change plan to free
                await userDoc.ref.update({
                    subscriptionStatus: 'cancelled',
                    plan: 'free', // Change plan back to free when subscription is cancelled
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                // Also update subscription document
                await db.collection('subscriptions').doc(userId).update({
                    status: 'cancelled',
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                console.log(`Subscription cancelled for user ${userId} and plan changed to free`);
            } else {
                console.error(`No matching user found for cancellation event`);
            }
        }
        
        // Handle more event types
        if (event.event === 'charge.success' || 
            event.event === 'subscription.create' || 
            event.event === 'invoice.payment_succeeded' ||
            event.event === 'subscription.not_renewing') {
            
            const data = event.data;
            let customerEmail;
            
            // Different event types have customer data in different places
            if (data.customer) {
                customerEmail = data.customer.email;
            } else if (data.subscription && data.subscription.customer) {
                customerEmail = data.subscription.customer.email;
            }
            
            if (!customerEmail) {
                console.error('No customer email found in webhook data');
                return;
            }
            
            console.log(`Processing webhook event for customer: ${customerEmail}`);
            
            // Check if this is a subscription payment after trial
            const userSnapshot = await db.collection('users')
                .where('email', '==', customerEmail)
                .limit(1)
                .get();
            
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                if (userData.subscriptionStatus === 'trial') {
                    console.log(`Updating user ${userId} from trial to active subscription`);
                    
                    // Update user status from trial to active
                    await userDoc.ref.update({
                        subscriptionStatus: 'active',
                        trialEndDate: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        firstBillingDate: new Date().toISOString()
                    });
                    
                    // Also update the subscription document
                    await db.collection('subscriptions').doc(userId).update({
                        status: 'active',
                        trialEndDate: new Date().toISOString(),
                        firstBillingDate: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    });
                    
                    console.log(`User ${userId} subscription updated from trial to active`);
                } else {
                    console.log(`User ${userId} already has status: ${userData.subscriptionStatus}`);
                }
            } else {
                console.error(`No user found for email: ${customerEmail}`);
            }
        }
        
        // Handle failed charge events
        if (event.event === 'charge.failed') {
            const data = event.data;
            const customerEmail = data.customer?.email;
            
            if (!customerEmail) {
                console.error('No customer email in webhook data');
                return;
            }
            
            console.log(`Payment failed for customer ${customerEmail}`);
            
            // Find the user with this email
            const userSnapshot = await db.collection('users')
                .where('email', '==', customerEmail)
                .limit(1)
                .get();
                
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                
                // Update payment failure info but don't immediately change status
                // This allows for retry attempts before subscription is fully cancelled
                await userDoc.ref.update({
                    lastPaymentFailure: new Date().toISOString(),
                    paymentFailureCount: admin.firestore.FieldValue.increment(1)
                });
                
                console.log(`Updated payment failure info for user ${userId}`);
            }
        }
        
    } catch (error) {
        console.error('Error processing subscription webhook:', error);
    }
};

/**
 * Cancel a user's subscription with Paystack
 */
const cancelSubscription = async (req, res) => {
    try {        
        // Check if this is a GET request - serve the subscription cancel HTML page
        if (req.method === 'GET') {
            return res.sendFile('payment-cancelled.html', { root: './public' });
        }
        
        // For POST requests, continue with cancellation logic
        // Check if user is authenticated
        if (!req.user || !req.user.uid) {
            console.log('Unauthenticated cancellation request received');
            return res.status(401).json({
                status: false,
                message: 'Authentication required'
            });
        }
        
        const userId = req.user.uid;
        
        console.log(`Starting cancellation process for user ${userId}`);
        
        // Get user document to fetch subscription info
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            console.log(`User ${userId} not found`);
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        
        // Check if user has an active subscription
        const userData = userDoc.data();
        if (!['trial', 'active'].includes(userData.subscriptionStatus)) {
            console.log(`User ${userId} has no active subscription: ${userData.subscriptionStatus}`);
            return res.status(400).json({
                status: false,
                message: 'No active subscription found'
            });
        }
        
        // Get subscription details from subscriptions collection
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!subscriptionDoc.exists) {
            console.log(`Subscription document for user ${userId} not found`);
            return res.status(404).json({
                status: false,
                message: 'Subscription details not found'
            });
        }
        
        const subscriptionData = subscriptionDoc.data();
        
        console.log('Subscription document data:', JSON.stringify(subscriptionData, null, 2));
        
        // Get subscription code from the main document
        const subscriptionCode = subscriptionData.subscriptionCode;
        
        // IMPORTANT: Get email token from the NESTED subscriptionData map
        // This is the key correction - access the nested subscriptionData object
        const emailToken = subscriptionData.subscriptionData?.email_token;
        
        console.log('Extracted values from subscription document:');
        console.log(`- Subscription Code: ${subscriptionCode}`);
        console.log(`- Email Token: ${emailToken || 'Not provided'}`);
        
        // Check if subscription code exists
        if (!subscriptionCode) {
            console.log(`Subscription code for user ${userId} not found`);
            return res.status(400).json({
                status: false,
                message: 'Subscription code not found'
            });
        }
        
        // Check if email token exists in the nested data
        if (!emailToken) {
            console.log(`Email token in nested subscriptionData for user ${userId} not found`);
            console.log('Will try cancellation without email token');
        }
        
        // Print the exact parameters we're going to send to Paystack
        console.log('===== PAYSTACK CANCELLATION REQUEST =====');
        console.log(`Subscription Code: ${subscriptionCode}`);
        console.log(`Email Token: ${emailToken || 'Not provided'}`);
        console.log('=========================================');
        
        // APPROACH 1: Try with both code and token (if available)
        if (emailToken) {
            try {
                const disableOptions = {
                    hostname: 'api.paystack.co',
                    port: 443,
                    path: '/subscription/disable',
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                };
                
                const disableParams = JSON.stringify({
                    code: subscriptionCode,
                    token: emailToken
                });
                
                console.log(`Sending request to Paystack with token:`, {
                    url: 'https://api.paystack.co/subscription/disable',
                    method: 'POST',
                    payload: JSON.parse(disableParams)
                });
                
                const disableResponse = await new Promise((resolve, reject) => {
                    const req = https.request(disableOptions, res => {
                        let data = '';
                        res.on('data', chunk => { data += chunk; });
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    
                    req.on('error', reject);
                    req.write(disableParams);
                    req.end();
                });
                
                console.log('Disable response (with token):', disableResponse);
                
                if (disableResponse.status) {
                    await updateCancellationInDatabase(userDoc, userId);
                    
                    // Log successful cancellation
                    await logSubscriptionEvent(userId, 'subscription_cancelled', {
                        subscriptionCode,
                        method: 'api_disable',
                        response: disableResponse
                    });
                    
                    return res.status(200).json({
                        status: true,
                        message: 'Subscription cancelled successfully'
                    });
                }
            } catch (error) {
                console.error('Error with token approach:', error);
            }
        }
        
        // APPROACH 2: Try cancelling without the token
        try {
            const disableOptions = {
                hostname: 'api.paystack.co',
                port: 443,
                path: '/subscription/disable',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const disableParams = JSON.stringify({
                code: subscriptionCode
                // Omit token entirely
            });
            
            console.log(`Sending request to Paystack (without token):`, {
                url: 'https://api.paystack.co/subscription/disable',
                method: 'POST',
                payload: JSON.parse(disableParams)
            });
            
            const disableResponse = await new Promise((resolve, reject) => {
                const req = https.request(disableOptions, res => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.on('error', reject);
                req.write(disableParams);
                req.end();
            });
            
            console.log('Disable response (without token):', disableResponse);
            
            if (disableResponse.status) {
                await updateCancellationInDatabase(userDoc, userId);
                
                // Log successful cancellation
                await logSubscriptionEvent(userId, 'subscription_cancelled', {
                    subscriptionCode,
                    method: 'api_disable',
                    response: disableResponse
                });
                
                return res.status(200).json({
                    status: true,
                    message: 'Subscription cancelled successfully'
                });
            }
        } catch (error) {
            console.error('Error with first approach:', error);
        }
        
        // APPROACH 3: Use server-side API with just the code in the URL
        try {
            const directOptions = {
                hostname: 'api.paystack.co',
                port: 443,
                path: `/subscription/${subscriptionCode}/disable`,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            };
            
            console.log(`Sending direct API request to Paystack:`, {
                url: `https://api.paystack.co/subscription/${subscriptionCode}/disable`,
                method: 'POST'
            });
            
            const directResponse = await new Promise((resolve, reject) => {
                const req = https.request(directOptions, res => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.on('error', reject);
                req.end();
            });
            
            console.log('Direct API response:', directResponse);
            
            if (directResponse.status) {
                await updateCancellationInDatabase(userDoc, userId);
                
                // Log successful cancellation
                await logSubscriptionEvent(userId, 'subscription_cancelled', {
                    subscriptionCode,
                    method: 'direct_api',
                    response: directResponse
                });
                
                return res.status(200).json({
                    status: true,
                    message: 'Subscription cancelled successfully'
                });
            }
        } catch (error) {
            console.error('Error with direct API approach:', error);
        }
        
        // APPROACH 4: As a last resort, update status in our database
        try {
            console.log('Previous approaches failed. Updating local database only.');
            await updateCancellationInDatabase(userDoc, userId);
            
            return res.status(200).json({
                status: true,
                message: 'Subscription marked as cancelled in our system',
                note: 'Please contact support if you continue to be charged'
            });
        } catch (error) {
            console.error('Error updating database:', error);
            return res.status(500).json({
                status: false,
                message: 'Failed to cancel subscription',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error', 
            error: error.message
        });
    }
};

/**
 * Helper function to update cancellation status in the database
 */
const updateCancellationInDatabase = async (userDoc, userId) => {
    try {
        // Update user document
        await userDoc.ref.update({
            subscriptionStatus: 'cancelled',
            plan: 'free', // Change plan back to free when subscription is cancelled
            cancellationDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });
        
        // Update subscription document
        await db.collection('subscriptions').doc(userId).update({
            status: 'cancelled',
            cancellationDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });

        // Log database update
        await logSubscriptionEvent(userId, 'subscription_status_updated', {
            oldStatus: userDoc.data().subscriptionStatus || 'unknown',
            newStatus: 'cancelled',
            oldPlan: userDoc.data().plan || 'unknown',
            newPlan: 'free'
        });
        
        console.log(`Database updated for user ${userId} - subscription marked as cancelled`);
        return true;
    } catch (error) {
        console.error('Error updating cancellation in database:', error);
        throw error;
    }
};

/**
 * Get available subscription plans
 */
const getSubscriptionPlans = (req, res) => {
    try {
        const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
            id: plan.id,
            name: plan.name,
            amount: plan.amount,
            interval: plan.interval,
            description: plan.description,
            trialDays: SUBSCRIPTION_CONSTANTS.TRIAL_DAYS
        }));

        res.status(200).json({
            status: true,
            message: 'Subscription plans retrieved successfully',
            data: plans
        });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription plans',
            error: error.message
        });
    }
};

/**
 * Fetch subscription data from Paystack API (optimized - only essential fields)
 * @param {string} subscriptionCode - The Paystack subscription code
 * @returns {Promise<Object>} - Paystack subscription data (minimal)
 */
const getPaystackSubscription = async (subscriptionCode) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/subscription/${subscriptionCode}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.status) {
                        const fullData = response.data;
                        
                        // Extract only the essential fields we need
                        const essentialData = {
                            subscription_code: fullData.subscription_code,
                            status: fullData.status,
                            next_payment_date: fullData.next_payment_date,
                            amount: fullData.amount,
                            interval: fullData.interval || fullData.plan?.interval || 'monthly', // Fallback to monthly if not specified
                            created_at: fullData.created_at,
                            // Get the most recent invoice for billing info
                            most_recent_invoice: fullData.most_recent_invoice ? {
                                amount: fullData.most_recent_invoice.amount,
                                period_start: fullData.most_recent_invoice.period_start,
                                period_end: fullData.most_recent_invoice.period_end,
                                paid_at: fullData.most_recent_invoice.paid_at
                            } : null
                        };
                        
                        resolve(essentialData);
                    } else {
                        reject(new Error(response.message || 'Failed to fetch subscription from Paystack'));
                    }
                } catch (error) {
                    reject(new Error('Invalid response from Paystack'));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Get user's subscription status
 * Checks both subscriptions collection and users collection for subscription data
 * Also fetches live data from Paystack for accurate billing information
 */
const getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // First, try to get subscription data from subscriptions collection
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (subscriptionDoc.exists) {
            // Found subscription data in subscriptions collection
            const subscriptionData = subscriptionDoc.data();
            
            // Determine subscription status
            let subscriptionStatus = 'none';
            if (subscriptionData.status) {
                subscriptionStatus = subscriptionData.status;
            } else if (subscriptionData.trialStartDate && subscriptionData.trialEndDate) {
                const now = new Date();
                const trialEnd = new Date(subscriptionData.trialEndDate);
                subscriptionStatus = now < trialEnd ? 'trial' : 'expired';
            }
            
            // Try to get live subscription data from Paystack for accurate billing info
            let paystackSubscriptionData = null;
            if (subscriptionData.subscriptionCode) {
                try {
                    // Add timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Paystack API timeout')), 5000)
                    );
                    
                    paystackSubscriptionData = await Promise.race([
                        getPaystackSubscription(subscriptionData.subscriptionCode),
                        timeoutPromise
                    ]);
                    
                } catch (error) {
                    console.log('Could not fetch Paystack subscription data:', error.message);
                }
            }
            
            // Use Paystack data for next billing date if available, otherwise fall back to stored data
            const nextBillingDate = paystackSubscriptionData?.next_payment_date || 
                                  subscriptionData.nextBillingDate || 
                                  subscriptionData.endDate || 
                                  subscriptionData.trialEndDate || null;
            
            // Get billing amount from Paystack or stored data
            const billingAmount = paystackSubscriptionData?.amount || subscriptionData.amount || null;
            
            // Determine interval - try multiple sources
            let billingInterval = paystackSubscriptionData?.interval || subscriptionData.interval || null;
            
            // If interval is still null, try to determine from plan name
            if (!billingInterval && subscriptionData.planId) {
                if (subscriptionData.planId.includes('MONTHLY') || subscriptionData.planId.includes('monthly')) {
                    billingInterval = 'monthly';
                } else if (subscriptionData.planId.includes('ANNUAL') || subscriptionData.planId.includes('annual')) {
                    billingInterval = 'annually';
                }
            }
            
            // Final fallback - if we have a subscription but no interval, assume monthly
            if (!billingInterval && subscriptionData.subscriptionCode) {
                billingInterval = 'monthly';
            }
            
            // Return subscription status info from subscriptions collection
            const responseData = {
                status: true,
                data: {
                    subscriptionStatus: subscriptionStatus,
                    subscriptionPlan: subscriptionData.planId || subscriptionData.plan || null,
                    trialStartDate: subscriptionData.trialStartDate || null,
                    trialEndDate: subscriptionData.trialEndDate || null,
                    nextBillingDate: nextBillingDate,
                    isActive: ['trial', 'active'].includes(subscriptionStatus),
                    // Billing information
                    amount: billingAmount,
                    interval: billingInterval,
                    // Additional useful fields
                    subscriptionCode: subscriptionData.subscriptionCode || null,
                    customerCode: subscriptionData.customerCode || null,
                    createdAt: subscriptionData.createdAt || null,
                    lastUpdated: subscriptionData.lastUpdated || null,
                    dataSource: 'subscriptions_collection',
                    paystackData: paystackSubscriptionData ? {
                        nextPaymentDate: paystackSubscriptionData.next_payment_date,
                        status: paystackSubscriptionData.status,
                        amount: paystackSubscriptionData.amount,
                        interval: paystackSubscriptionData.interval,
                        createdAt: paystackSubscriptionData.created_at,
                        mostRecentInvoice: paystackSubscriptionData.most_recent_invoice
                    } : null
                }
            };
            
            return res.status(200).json(responseData);
        }
        
        // If no subscription found in subscriptions collection, check users collection
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            // No user found - return default values
            return res.status(200).json({
                status: true,
                data: {
                    subscriptionStatus: 'none',
                    subscriptionPlan: null,
                    trialStartDate: null,
                    trialEndDate: null,
                    isActive: false,
                    dataSource: 'no_data'
                }
            });
        }
        
        const userData = userDoc.data();
        
        // Check if user has subscription data
        if (userData.subscriptionStatus || userData.plan || userData.trialStartDate) {
            // Return subscription status info from users collection
            const userResponseData = {
                status: true,
                data: {
                    subscriptionStatus: userData.subscriptionStatus || 'none',
                    subscriptionPlan: userData.subscriptionPlan || userData.plan || null,
                    trialStartDate: userData.trialStartDate || null,
                    trialEndDate: userData.trialEndDate || null,
                    nextBillingDate: userData.nextBillingDate || userData.subscriptionEnd || userData.trialEndDate || userData.firstBillingDate || null,
                    isActive: ['trial', 'active'].includes(userData.subscriptionStatus || 'none'),
                    // Additional fields from user document
                    role: userData.role || null,
                    organiserStatus: userData.organiserStatus || null,
                    firstBillingDate: userData.firstBillingDate || null,
                    dataSource: 'users_collection'
                }
            };
            
            return res.status(200).json(userResponseData);
        }
        
        // No subscription data found in either collection
        return res.status(200).json({
            status: true,
            data: {
                subscriptionStatus: 'none',
                subscriptionPlan: null,
                trialStartDate: null,
                trialEndDate: null,
                isActive: false,
                dataSource: 'no_data'
            }
        });
        
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription status',
            error: error.message
        });
    }
};

/**
 * Get user's subscription logs
 */
const getSubscriptionLogs = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        // Import the function to get logs
        const { getSubscriptionLogs } = require('../models/subscriptionLog');
        const logs = await getSubscriptionLogs(userId, limit);
        
        return res.status(200).json({
            status: true,
            data: logs
        });
    } catch (error) {
        console.error('Error fetching subscription logs:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription logs',
            error: error.message
        });
    }
};

/**
 * Initialize trial subscription with banking information
 * This endpoint is specifically for users who complete banking registration
 * and want to immediately start their premium subscription trial
 */
const initializeTrialWithBanking = async (req, res) => {
    try {
        const { 
            planId = 'ANNUAL_PLAN', // Default to annual plan
            accountNumber,
            bankCode,
            bankName,
            accountName,
            verificationData 
        } = req.body;
        
        const userEmail = req.user.email;
        const userId = req.user.uid;

        // Validate banking information
        if (!accountNumber || !bankCode || !bankName) {
            return res.status(400).json({
                status: false,
                message: 'Banking information is required (accountNumber, bankCode, bankName)'
            });
        }

        // Prepare banking data object
        const bankingData = {
            accountNumber,
            bankCode,
            bankName,
            accountName,
            isVerified: true,
            verificationData: verificationData || null
        };

        // Call the regular trial initialization with banking data
        // We'll modify the request object to include banking data
        req.body = {
            planId,
            bankingData
        };

        // Call the existing trial initialization function
        return await initializeTrialSubscription(req, res);

    } catch (error) {
        console.error('Trial with banking error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Get user's saved banking information
 */
const getUserBankingInfo = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        const bankingData = await getUserBankCardData(userId);
        
        if (!bankingData) {
            return res.status(404).json({
                status: false,
                message: 'No banking information found'
            });
        }

        // Remove sensitive information before sending
        const { accountNumber, ...safeBankingData } = bankingData;
        
        // Only show last 4 digits of account number
        const maskedAccountNumber = accountNumber ? 
            `****${accountNumber.slice(-4)}` : null;

        res.status(200).json({
            status: true,
            data: {
                ...safeBankingData,
                accountNumber: maskedAccountNumber
            }
        });
    } catch (error) {
        console.error('Error getting banking info:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Handle RevenueCat webhook events
 * Following existing patterns - additive changes only
 * Used for iOS subscription lifecycle events
 */
const handleRevenueCatWebhook = async (req, res) => {
    try {
        // Log all incoming webhook data for debugging
        console.log('Received RevenueCat webhook payload:', JSON.stringify(req.body));
        
        const event = req.body;
        
        // Quickly acknowledge the webhook
        res.status(200).send('RevenueCat webhook received');
        
        console.log('Received RevenueCat webhook event:', event.type);
        
        // Handle subscription lifecycle events
        if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
            
            const data = event.event;
            const appUserId = data.app_user_id;
            const productId = data.product_id;
            const purchaseDateMs = data.purchased_at_ms;
            const expirationDateMs = data.expiration_at_ms;
            const originalTransactionId = data.original_transaction_id;
            
            console.log(`Processing RevenueCat purchase for user: ${appUserId}, product: ${productId}`);
            
            // Find user by RevenueCat app_user_id (which should match our user ID)
            const userDoc = await db.collection('users').doc(appUserId).get();
            
            if (userDoc.exists) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                console.log(`Updating subscription status to active for user ${userId}`);
                
                // Determine plan based on product ID
                let planType = 'premium';
                let interval = 'monthly';
                
                if (productId && productId.includes('annual')) {
                    interval = 'annually';
                }
                
                // Update user with active status and premium plan
                await userDoc.ref.update({
                    subscriptionStatus: 'active',
                    subscriptionPlatform: 'ios_revenuecat',
                    plan: planType,
                    subscriptionStart: new Date(purchaseDateMs).toISOString(),
                    subscriptionEnd: new Date(expirationDateMs).toISOString(),
                    revenuecatCustomerId: data.subscriber.subscriber_id || null,
                    revenuecatOriginalAppUserId: appUserId,
                    appleOriginalTransactionId: originalTransactionId,
                    lastUpdated: new Date().toISOString()
                });
                
                // Also update/create subscription document
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userData.email,
                    platform: 'ios_revenuecat',
                    productId: productId,
                    originalTransactionId: originalTransactionId,
                    revenuecatCustomerId: data.subscriber.subscriber_id || null,
                    status: 'active',
                    interval: interval,
                    startDate: new Date(purchaseDateMs).toISOString(),
                    endDate: new Date(expirationDateMs).toISOString(),
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    webhookData: data
                }, { merge: true });
                
                // Add log entry for subscription creation
                await logSubscriptionEvent(userId, 'revenuecat_subscription_created', {
                    productId,
                    originalTransactionId,
                    interval,
                    platform: 'ios_revenuecat'
                });
                
                console.log(`RevenueCat subscription activated for user ${userId}`);
            } else {
                console.error(`No matching user found for RevenueCat app_user_id: ${appUserId}`);
            }
        }
        
        // Handle subscription cancellations and expirations
        if (event.type === 'CANCELLATION' || event.type === 'EXPIRATION') {
            
            const data = event.event;
            const appUserId = data.app_user_id;
            const productId = data.product_id;
            const expirationDateMs = data.expiration_at_ms;
            
            console.log(`Processing RevenueCat cancellation/expiration for user: ${appUserId}`);
            
            // Find user by RevenueCat app_user_id
            const userDoc = await db.collection('users').doc(appUserId).get();
            
            if (userDoc.exists) {
                const userId = userDoc.id;
                
                console.log(`Updating subscription status to cancelled/expired for user ${userId}`);
                
                // Update user with cancelled status and change plan to free
                await userDoc.ref.update({
                    subscriptionStatus: event.type === 'CANCELLATION' ? 'cancelled' : 'expired',
                    plan: 'free', // Change plan back to free when subscription ends
                    subscriptionEnd: new Date(expirationDateMs).toISOString(),
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                // Also update subscription document
                await db.collection('subscriptions').doc(userId).update({
                    status: event.type === 'CANCELLATION' ? 'cancelled' : 'expired',
                    endDate: new Date(expirationDateMs).toISOString(),
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                // Add log entry
                await logSubscriptionEvent(userId, `revenuecat_subscription_${event.type.toLowerCase()}`, {
                    productId,
                    platform: 'ios_revenuecat'
                });
                
                console.log(`RevenueCat subscription ${event.type.toLowerCase()} processed for user ${userId}`);
            } else {
                console.error(`No matching user found for RevenueCat app_user_id: ${appUserId}`);
            }
        }
        
        // Handle other RevenueCat events as needed
        console.log(`RevenueCat webhook event ${event.type} processed successfully`);
        
    } catch (error) {
        console.error('RevenueCat webhook error:', error);
        // Still return 200 to acknowledge receipt, preventing retries
        res.status(200).send('RevenueCat webhook error logged');
    }
};

module.exports = {
    initializeSubscription,
    initializeTrialSubscription,
    initializeTrialWithBanking, // New endpoint
    handleSubscriptionCallback,
    handleTrialCallback,
    handleSubscriptionWebhook,
    handleRevenueCatWebhook, // New RevenueCat webhook handler
    getSubscriptionPlans,
    getSubscriptionStatus,
    cancelSubscription,
    getSubscriptionLogs,
    getUserBankingInfo, // New endpoint
    saveBankCardData, // Export for use in other controllers
    getUserBankCardData // Export for use in other controllers
};
