/**
 * Query Enterprise Data for E2E Testing
 * 
 * This script queries Firestore for real enterprise data to use in E2E tests
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db } = require('./firebase');

async function queryEnterpriseData() {
    try {
        console.log('🔍 Querying enterprise data from Firestore...\n');

        // Query enterprise accounts
        console.log('📊 Enterprise Accounts:');
        const enterpriseAccountsSnapshot = await db.collection('enterprise_accounts').limit(5).get();
        const enterpriseAccounts = [];
        enterpriseAccountsSnapshot.forEach(doc => {
            const data = doc.data();
            enterpriseAccounts.push({
                id: doc.id,
                enterpriseId: data.enterpriseId || doc.id,
                companyName: data.companyName || 'N/A',
                email: data.email || 'N/A',
                employeeCount: data.employeeCount || 0,
                subscriptionStatus: data.subscriptionStatus || 'N/A',
                planCode: data.planCode || 'N/A',
                subscriptionCode: data.subscriptionCode || 'N/A'
            });
        });
        console.log(JSON.stringify(enterpriseAccounts, null, 2));

        // Query enterprise plans
        console.log('\n📋 Enterprise Plans:');
        const plansSnapshot = await db.collection('enterprise_plans').limit(5).get();
        const plans = [];
        plansSnapshot.forEach(doc => {
            const data = doc.data();
            plans.push({
                id: doc.id,
                planCode: data.planCode || doc.id,
                employeeCount: data.employeeCount || 0,
                price: data.price || 0,
                currency: data.currency || 'NGN'
            });
        });
        console.log(JSON.stringify(plans, null, 2));

        // Query quotes
        console.log('\n💼 Enterprise Quotes:');
        const quotesSnapshot = await db.collection('enterprise_quotes').limit(5).get();
        const quotes = [];
        quotesSnapshot.forEach(doc => {
            const data = doc.data();
            quotes.push({
                id: doc.id,
                quoteId: data.quoteId || doc.id,
                employeeCount: data.employeeCount || 0,
                price: data.price || 0,
                currency: data.currency || 'NGN',
                status: data.status || 'N/A',
                expiresAt: data.expiresAt ? data.expiresAt.toDate().toISOString() : 'N/A'
            });
        });
        console.log(JSON.stringify(quotes, null, 2));

        // Query users with enterprise-related data
        console.log('\n👥 Users with Enterprise Data:');
        const usersSnapshot = await db.collection('users')
            .where('plan', '==', 'enterprise')
            .limit(5)
            .get();
        const enterpriseUsers = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            enterpriseUsers.push({
                id: doc.id,
                email: data.email || 'N/A',
                plan: data.plan || 'N/A',
                subscriptionStatus: data.subscriptionStatus || 'N/A'
            });
        });
        console.log(JSON.stringify(enterpriseUsers, null, 2));

        // Query any active user for authentication (fallback)
        console.log('\n👤 Active Users (for authentication):');
        const activeUsersSnapshot = await db.collection('users')
            .limit(5)
            .get();
        const activeUsers = [];
        activeUsersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                activeUsers.push({
                    id: doc.id,
                    email: data.email,
                    plan: data.plan || 'free'
                });
            }
        });
        console.log(JSON.stringify(activeUsers, null, 2));

        // Summary
        console.log('\n📈 Summary:');
        console.log(`Enterprise Accounts: ${enterpriseAccounts.length}`);
        console.log(`Enterprise Plans: ${plans.length}`);
        console.log(`Enterprise Quotes: ${quotes.length}`);
        console.log(`Enterprise Users: ${enterpriseUsers.length}`);
        console.log(`Active Users: ${activeUsers.length}`);

        // Return data for use in tests
        return {
            enterpriseAccounts,
            plans,
            quotes,
            enterpriseUsers,
            activeUsers
        };

    } catch (error) {
        console.error('❌ Error querying enterprise data:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    queryEnterpriseData()
        .then(() => {
            console.log('\n✅ Query complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Query failed:', error);
            process.exit(1);
        });
}

module.exports = { queryEnterpriseData };

