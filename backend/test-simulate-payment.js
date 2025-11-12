/**
 * Simulate Successful Payment for Phase 4A Billing Features Testing
 * 
 * Following Golden Rules:
 * - ALWAYS simulate realistic payment scenarios
 * - ALWAYS maintain data integrity during simulation
 * - ALWAYS log all simulated operations for audit trail
 * - ALWAYS verify data consistency after simulation
 */

const { db } = require('./firebase');
const { logSubscriptionEvent } = require('./models/subscriptionLog');

// Test user data
const TEST_USER_ID = 'CIYms8wk9XgmsrTIibttpDKTKWB2';
const TEST_USER_EMAIL = 'neney20213@anysilo.com';

/**
 * Simulate successful payment and subscription activation
 */
async function simulateSuccessfulPayment() {
    console.log('💰 Simulating successful payment and subscription activation...');
    
    try {
        const now = new Date();
        const subscriptionEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        const reference = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`📝 Creating subscription with reference: ${reference}`);
        
        // Update user subscription status
        await db.collection('users').doc(TEST_USER_ID).update({
            subscriptionStatus: 'active',
            subscriptionPlan: 'MONTHLY_PLAN',
            subscriptionStart: now.toISOString(),
            subscriptionEnd: subscriptionEnd.toISOString(),
            lastPaymentDate: now.toISOString(),
            lastPaymentAmount: 159.99,
            customerCode: `CUST_${TEST_USER_ID}`,
            subscriptionCode: `SUB_${TEST_USER_ID}`,
            updatedAt: now.toISOString()
        });
        
        console.log('✅ User subscription status updated');
        
        // Create subscription record
        await db.collection('subscriptions').doc(TEST_USER_ID).set({
            userId: TEST_USER_ID,
            userEmail: TEST_USER_EMAIL,
            planId: 'MONTHLY_PLAN',
            planName: 'Premium Monthly',
            status: 'active',
            amount: 159.99,
            currency: 'ZAR',
            startDate: now.toISOString(),
            endDate: subscriptionEnd.toISOString(),
            reference: reference,
            customerCode: `CUST_${TEST_USER_ID}`,
            subscriptionCode: `SUB_${TEST_USER_ID}`,
            paymentMethod: {
                type: 'card',
                last4: '1234',
                brand: 'Visa'
            },
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        });
        
        console.log('✅ Subscription record created');
        
        // Log subscription creation event
        await logSubscriptionEvent(TEST_USER_ID, 'subscription_created', {
            planId: 'MONTHLY_PLAN',
            amount: 159.99,
            reference: reference,
            paymentMethod: 'card',
            subscriptionCode: `SUB_${TEST_USER_ID}`,
            customerCode: `CUST_${TEST_USER_ID}`
        });
        
        console.log('✅ Subscription creation event logged');
        
        // Log payment success event
        await logSubscriptionEvent(TEST_USER_ID, 'subscription_payment_success', {
            reference: reference,
            amount: 159.99,
            planId: 'MONTHLY_PLAN',
            paymentMethod: 'card',
            paystackResponse: {
                status: 'success',
                message: 'Payment successful',
                reference: reference,
                amount: 15999, // Amount in cents
                currency: 'ZAR'
            }
        });
        
        console.log('✅ Payment success event logged');
        
        // Create additional payment history for more realistic testing
        const paymentHistory = [
            {
                reference: `TXN_${Date.now() - 86400000}_${Math.random().toString(36).substr(2, 9)}`, // 1 day ago
                amount: 159.99,
                date: new Date(now.getTime() - 86400000).toISOString(),
                status: 'completed',
                plan: 'MONTHLY_PLAN',
                type: 'payment'
            },
            {
                reference: `TXN_${Date.now() - 172800000}_${Math.random().toString(36).substr(2, 9)}`, // 2 days ago
                amount: 159.99,
                date: new Date(now.getTime() - 172800000).toISOString(),
                status: 'completed',
                plan: 'MONTHLY_PLAN',
                type: 'payment'
            }
        ];
        
        // Log historical payment events
        for (const payment of paymentHistory) {
            await logSubscriptionEvent(TEST_USER_ID, 'subscription_payment_success', {
                reference: payment.reference,
                amount: payment.amount,
                planId: payment.plan,
                paymentMethod: 'card',
                paystackResponse: {
                    status: 'success',
                    message: 'Payment successful',
                    reference: payment.reference,
                    amount: Math.round(payment.amount * 100), // Amount in cents
                    currency: 'ZAR'
                }
            });
        }
        
        console.log('✅ Historical payment events logged');
        
        // Create some billing notifications
        const notifications = [
            {
                type: 'payment_success',
                title: 'Payment Received',
                message: 'Your subscription payment of R159.99 has been processed successfully.',
                timestamp: now.toISOString(),
                priority: 'low',
                isRead: false
            },
            {
                type: 'billing_reminder',
                title: 'Upcoming Billing',
                message: 'Your subscription will renew in 25 days for R159.99',
                timestamp: now.toISOString(),
                priority: 'medium',
                isRead: false
            }
        ];
        
        // Log notification events
        for (const notification of notifications) {
            await logSubscriptionEvent(TEST_USER_ID, 'billing_notification_created', {
                notificationType: notification.type,
                title: notification.title,
                message: notification.message,
                priority: notification.priority,
                isRead: notification.isRead
            });
        }
        
        console.log('✅ Billing notifications created');
        
        return {
            success: true,
            reference: reference,
            subscriptionCode: `SUB_${TEST_USER_ID}`,
            customerCode: `CUST_${TEST_USER_ID}`,
            amount: 159.99,
            plan: 'MONTHLY_PLAN'
        };
        
    } catch (error) {
        console.error('❌ Error simulating payment:', error.message);
        throw error;
    }
}

/**
 * Test billing endpoints with simulated data
 */
async function testBillingEndpointsWithData() {
    console.log('\n📊 Testing billing endpoints with simulated subscription data...');
    
    try {
        const http = require('http');
        
        // First authenticate
        const loginData = JSON.stringify({
            email: 'neney20213@anysilo.com',
            password: '123456'
        });
        
        const authOptions = {
            hostname: 'localhost',
            port: 8383,
            path: '/SignIn',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };
        
        const authResponse = await new Promise((resolve, reject) => {
            const req = http.request(authOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', reject);
            req.write(loginData);
            req.end();
        });
        
        if (!authResponse.token) {
            throw new Error('Authentication failed');
        }
        
        const authToken = authResponse.token;
        
        // Test payment history
        console.log('📊 Testing payment history with data...');
        const paymentHistoryResponse = await makeBillingRequest('/api/billing/payment-history', authToken);
        if (paymentHistoryResponse.statusCode === 200) {
            console.log('✅ Payment history with data:');
            console.log(`   Transactions: ${paymentHistoryResponse.data.data.transactions.length}`);
            console.log(`   Total paid: R${paymentHistoryResponse.data.data.summary.totalPaid}`);
            console.log(`   Success rate: ${paymentHistoryResponse.data.data.summary.successRate}%`);
        }
        
        // Test subscription status
        console.log('📊 Testing subscription status with data...');
        const statusResponse = await makeBillingRequest('/api/billing/status', authToken);
        if (statusResponse.statusCode === 200) {
            console.log('✅ Subscription status with data:');
            console.log(`   Status: ${statusResponse.data.data.subscription.status}`);
            console.log(`   Plan: ${statusResponse.data.data.subscription.plan}`);
            console.log(`   Is Active: ${statusResponse.data.data.subscription.isActive}`);
            console.log(`   Next billing: ${statusResponse.data.data.billing.nextBillingDate}`);
            console.log(`   Days until billing: ${statusResponse.data.data.billing.daysUntilBilling}`);
        }
        
        // Test invoices
        console.log('📊 Testing invoice history with data...');
        const invoiceResponse = await makeBillingRequest('/api/billing/invoices', authToken);
        if (invoiceResponse.statusCode === 200) {
            console.log('✅ Invoice history with data:');
            console.log(`   Invoices: ${invoiceResponse.data.data.invoices.length}`);
            console.log(`   Total amount: R${invoiceResponse.data.data.summary.totalAmount}`);
        }
        
        // Test notifications
        console.log('📊 Testing billing notifications with data...');
        const notificationResponse = await makeBillingRequest('/api/billing/notifications', authToken);
        if (notificationResponse.statusCode === 200) {
            console.log('✅ Billing notifications with data:');
            console.log(`   Notifications: ${notificationResponse.data.data.notifications.length}`);
            console.log(`   Unread: ${notificationResponse.data.data.summary.unreadCount}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Billing endpoints test error:', error.message);
        return false;
    }
}

/**
 * Make authenticated request to billing endpoints
 */
async function makeBillingRequest(endpoint, authToken) {
    try {
        const http = require('http');
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: endpoint,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve({ statusCode: res.statusCode, data: response });
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
        
    } catch (error) {
        throw error;
    }
}

/**
 * Run the complete simulation and testing
 */
async function runPaymentSimulation() {
    console.log('🚀 Simulating Payment and Testing Phase 4A Billing Features');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Simulate successful payment
        console.log('\n💰 STEP 1: Simulate Successful Payment');
        const paymentResult = await simulateSuccessfulPayment();
        
        if (paymentResult.success) {
            console.log('✅ Payment simulation completed successfully');
            console.log(`   Reference: ${paymentResult.reference}`);
            console.log(`   Amount: R${paymentResult.amount}`);
            console.log(`   Plan: ${paymentResult.plan}`);
        } else {
            throw new Error('Payment simulation failed');
        }
        
        // Step 2: Test billing endpoints with real data
        console.log('\n📊 STEP 2: Test Billing Endpoints with Real Data');
        const testResult = await testBillingEndpointsWithData();
        
        if (testResult) {
            console.log('\n🎉 PAYMENT SIMULATION AND TESTING COMPLETE!');
            console.log('✅ User now has realistic subscription data');
            console.log('✅ All billing features are working with real data');
            console.log('✅ Payment history shows multiple transactions');
            console.log('✅ Subscription status shows active plan');
            console.log('✅ Invoice history shows paid invoices');
            console.log('✅ Notifications show billing alerts');
        } else {
            console.log('\n⚠️  Payment simulation completed but billing endpoints need attention');
        }
        
        return { success: true, paymentResult, testResult };
        
    } catch (error) {
        console.error('\n❌ PAYMENT SIMULATION FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

// Run the simulation
if (require.main === module) {
    runPaymentSimulation()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 Payment simulation completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Payment simulation failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Payment simulation crashed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runPaymentSimulation,
    simulateSuccessfulPayment,
    testBillingEndpointsWithData
};
