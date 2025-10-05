/**
 * Debug Data Consistency Issue
 * 
 * Following Golden Rules:
 * - ALWAYS investigate data inconsistencies immediately
 * - ALWAYS verify calculations match across all endpoints
 * - ALWAYS log detailed debugging information
 */

const http = require('http');
const { db } = require('./firebase');

// Test configuration
const TEST_USER = {
    email: 'neney20213@anysilo.com',
    password: '123456'
};

let authToken = null;
let userId = null;

/**
 * Authenticate user
 */
async function authenticateUser() {
    console.log('🔐 Authenticating user...');
    
    try {
        const loginData = JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: '/SignIn',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.token && response.user) {
                            authToken = response.token;
                            userId = response.user.uid;
                            console.log('✅ Authentication successful');
                            resolve(response);
                        } else {
                            reject(new Error('Authentication failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(loginData);
            req.end();
        });
        
    } catch (error) {
        console.error('❌ Authentication error:', error.message);
        throw error;
    }
}

/**
 * Make authenticated request
 */
async function makeRequest(endpoint) {
    try {
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
 * Debug data consistency issue
 */
async function debugDataConsistency() {
    console.log('🔍 Debugging Data Consistency Issue');
    console.log('=' .repeat(50));
    
    try {
        // Get payment history
        console.log('\n📊 Payment History Analysis:');
        const paymentResponse = await makeRequest('/api/billing/payment-history');
        const paymentData = paymentResponse.data.data;
        
        console.log(`   Total Transactions: ${paymentData.transactions.length}`);
        console.log(`   Summary Total: R${paymentData.summary.totalPaid}`);
        console.log(`   Summary Transactions: ${paymentData.summary.totalTransactions}`);
        console.log(`   Summary Successful: ${paymentData.summary.successfulPayments}`);
        
        console.log('\n   Individual Transactions:');
        paymentData.transactions.forEach((txn, index) => {
            console.log(`   ${index + 1}. ${txn.reference} - R${txn.amount} (${txn.status})`);
        });
        
        // Get subscription status
        console.log('\n📊 Subscription Status Analysis:');
        const statusResponse = await makeRequest('/api/billing/status');
        const statusData = statusResponse.data.data;
        
        console.log(`   Usage Total Paid: R${statusData.usage.totalAmountPaid}`);
        console.log(`   Usage Total Payments: ${statusData.usage.totalPayments}`);
        console.log(`   Usage Last Payment: R${statusData.usage.lastPaymentAmount}`);
        
        console.log('\n   Recent Payments:');
        statusData.recentPayments.forEach((payment, index) => {
            console.log(`   ${index + 1}. ${payment.reference} - R${payment.amount} (${payment.status})`);
        });
        
        // Calculate differences
        const paymentTotal = paymentData.summary.totalPaid;
        const statusTotal = statusData.usage.totalAmountPaid;
        const difference = Math.abs(paymentTotal - statusTotal);
        
        console.log('\n🔍 Consistency Analysis:');
        console.log(`   Payment History Total: R${paymentTotal}`);
        console.log(`   Status Dashboard Total: R${statusTotal}`);
        console.log(`   Difference: R${difference}`);
        console.log(`   Consistent: ${difference < 0.01 ? '✅ YES' : '❌ NO'}`);
        
        // Check if the issue is in the recent payments limit
        console.log('\n🔍 Recent Payments Analysis:');
        console.log(`   Payment History Transactions: ${paymentData.transactions.length}`);
        console.log(`   Status Recent Payments: ${statusData.recentPayments.length}`);
        
        if (statusData.recentPayments.length < paymentData.transactions.length) {
            console.log('   ⚠️  Status dashboard is using fewer transactions than payment history');
            console.log('   💡 This suggests the recent payments limit is too low');
        }
        
        return {
            paymentTotal,
            statusTotal,
            difference,
            isConsistent: difference < 0.01,
            paymentTransactionCount: paymentData.transactions.length,
            statusPaymentCount: statusData.recentPayments.length
        };
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        throw error;
    }
}

/**
 * Run debug analysis
 */
async function runDebugAnalysis() {
    console.log('🚀 Data Consistency Debug Analysis');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Authenticate
        console.log('\n🔐 STEP 1: Authentication');
        await authenticateUser();
        
        // Step 2: Debug data consistency
        console.log('\n🔍 STEP 2: Data Consistency Debug');
        const debugResult = await debugDataConsistency();
        
        // Step 3: Provide recommendations
        console.log('\n💡 STEP 3: Recommendations');
        if (!debugResult.isConsistent) {
            console.log('❌ Data consistency issue identified:');
            console.log(`   - Payment History: R${debugResult.paymentTotal} (${debugResult.paymentTransactionCount} transactions)`);
            console.log(`   - Status Dashboard: R${debugResult.statusTotal} (${debugResult.statusPaymentCount} transactions)`);
            console.log(`   - Difference: R${debugResult.difference}`);
            
            if (debugResult.statusPaymentCount < debugResult.paymentTransactionCount) {
                console.log('\n💡 SOLUTION: Increase recent payments limit in status dashboard');
                console.log('   - Current limit is too low, causing missing transactions');
                console.log('   - Status dashboard should use all transactions, not just recent ones');
            }
        } else {
            console.log('✅ Data consistency is correct');
        }
        
        return debugResult;
        
    } catch (error) {
        console.error('\n❌ DEBUG ANALYSIS FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        return { error: error.message };
    }
}

// Run the debug analysis
if (require.main === module) {
    runDebugAnalysis()
        .then((result) => {
            if (result.isConsistent) {
                console.log('\n🎉 Data consistency debug completed - no issues found!');
                process.exit(0);
            } else {
                console.log('\n⚠️  Data consistency issues identified - see recommendations above');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Debug analysis crashed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runDebugAnalysis,
    debugDataConsistency
};
