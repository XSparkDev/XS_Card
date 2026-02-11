/**
 * Check which users have enterpriseId
 * 
 * Scans users collection to find users with enterpriseRef or enterpriseId
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db } = require('./firebase');

async function checkEnterpriseUsers() {
  try {
    console.log('\n🔍 Checking users for enterprise associations...\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`📊 Total users: ${usersSnapshot.size}\n`);

    const usersWithEnterprise = [];
    const usersWithoutEnterprise = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const userId = doc.id;
      const email = userData.email || 'no-email';
      const enterpriseRef = userData.enterpriseRef;
      const enterpriseId = userData.enterpriseId || (enterpriseRef?.id || enterpriseRef?.path?.split('/')[1]);
      
      if (enterpriseId || enterpriseRef) {
        usersWithEnterprise.push({
          userId,
          email,
          enterpriseId: enterpriseId || 'unknown',
          plan: userData.plan || 'not set',
          role: userData.role || 'not set'
        });
      } else {
        usersWithoutEnterprise.push({
          userId,
          email,
          plan: userData.plan || 'not set'
        });
      }
    });

    // Display users with enterprise
    if (usersWithEnterprise.length > 0) {
      console.log('✅ Users WITH enterprise:');
      console.log('='.repeat(80));
      usersWithEnterprise.forEach(user => {
        console.log(`   User ID: ${user.userId}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Enterprise ID: ${user.enterpriseId}`);
        console.log(`   Plan: ${user.plan}`);
        console.log(`   Role: ${user.role}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No users found with enterprise association\n');
    }

    // Display users without enterprise
    if (usersWithoutEnterprise.length > 0) {
      console.log('📋 Users WITHOUT enterprise:');
      console.log('='.repeat(80));
      usersWithoutEnterprise.slice(0, 10).forEach(user => {
        console.log(`   User ID: ${user.userId}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Plan: ${user.plan}`);
        console.log('');
      });
      if (usersWithoutEnterprise.length > 10) {
        console.log(`   ... and ${usersWithoutEnterprise.length - 10} more\n`);
      }
    }

    // Check for test user specifically
    const testUserEmail = process.env.TEST_USER_EMAIL || 'pule@xspark.co.za';
    const testUser = usersSnapshot.docs.find(doc => doc.data().email === testUserEmail);
    
    if (testUser) {
      const testUserData = testUser.data();
      const testEnterpriseId = testUserData.enterpriseId || (testUserData.enterpriseRef?.id || testUserData.enterpriseRef?.path?.split('/')[1]);
      
      console.log('🎯 Test User Status:');
      console.log('='.repeat(80));
      console.log(`   Email: ${testUserEmail}`);
      console.log(`   User ID: ${testUser.id}`);
      console.log(`   Enterprise ID: ${testEnterpriseId || 'NONE'}`);
      console.log(`   Plan: ${testUserData.plan || 'not set'}`);
      console.log(`   Role: ${testUserData.role || 'not set'}`);
      console.log('');

      if (!testEnterpriseId) {
        console.log('⚠️  Test user does NOT have an enterpriseId');
        console.log('💡 Run: node link-user-to-enterprise.js pule@xspark.co.za x-spark-test');
      } else {
        console.log('✅ Test user has enterpriseId');
      }
    } else {
      console.log(`⚠️  Test user not found: ${testUserEmail}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log(`   Total users: ${usersSnapshot.size}`);
    console.log(`   Users with enterprise: ${usersWithEnterprise.length}`);
    console.log(`   Users without enterprise: ${usersWithoutEnterprise.length}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkEnterpriseUsers();
