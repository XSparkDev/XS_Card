/**
 * Link User to Enterprise
 * 
 * Links a user to an enterprise for testing Phase 1 features
 * 
 * Usage:
 *   node link-user-to-enterprise.js <userId> <enterpriseId>
 *   OR
 *   node link-user-to-enterprise.js <email> <enterpriseId>
 * 
 * Example:
 *   node link-user-to-enterprise.js pule@xspark.co.za x-spark-test
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db, admin } = require('./firebase');

const userIdOrEmail = process.argv[2];
const enterpriseId = process.argv[3];

if (!userIdOrEmail || !enterpriseId) {
  console.error('Usage: node link-user-to-enterprise.js <userId|email> <enterpriseId>');
  console.error('Example: node link-user-to-enterprise.js pule@xspark.co.za x-spark-test');
  process.exit(1);
}

async function linkUserToEnterprise() {
  try {
    console.log(`\n🔗 Linking user to enterprise...`);
    console.log(`   User: ${userIdOrEmail}`);
    console.log(`   Enterprise: ${enterpriseId}\n`);

    // Find user by email or use as userId
    let userId = userIdOrEmail;
    let userRef = db.collection('users').doc(userIdOrEmail);
    
    // If it looks like an email, search for user by email
    if (userIdOrEmail.includes('@')) {
      console.log('📧 Searching for user by email...');
      const usersSnapshot = await db.collection('users')
        .where('email', '==', userIdOrEmail)
        .limit(1)
        .get();
      
      if (usersSnapshot.empty) {
        console.error(`❌ User not found with email: ${userIdOrEmail}`);
        process.exit(1);
      }
      
      userId = usersSnapshot.docs[0].id;
      userRef = db.collection('users').doc(userId);
      console.log(`✅ Found user: ${userId}`);
    }

    // Check if user exists
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }

    // Check if enterprise exists
    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const enterpriseDoc = await enterpriseRef.get();
    if (!enterpriseDoc.exists) {
      console.error(`❌ Enterprise not found: ${enterpriseId}`);
      console.log(`\n💡 Creating enterprise document...`);
      
      // Create enterprise document
      await enterpriseRef.set({
        name: enterpriseId,
        description: 'Test enterprise',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Enterprise document created`);
    } else {
      console.log(`✅ Enterprise exists: ${enterpriseId}`);
    }

    // Get current user data
    const userData = userDoc.data();
    console.log(`\n📋 Current user data:`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Plan: ${userData.plan || 'not set'}`);
    console.log(`   Role: ${userData.role || 'not set'}`);
    console.log(`   Current enterpriseRef: ${userData.enterpriseRef?.id || 'none'}`);

    // Update user with enterprise reference
    const updates = {
      enterpriseRef: enterpriseRef,
      plan: 'enterprise',
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.update(updates);
    console.log(`\n✅ User linked to enterprise successfully!`);
    console.log(`   Updated fields:`);
    console.log(`   - enterpriseRef: ${enterpriseId}`);
    console.log(`   - plan: enterprise`);
    console.log(`   - role: admin`);

    // Also create user record in enterprise subcollection (other server pattern)
    const enterpriseUserRef = enterpriseRef.collection('users').doc(userId);
    const enterpriseUserData = {
      id: userId,
      firstName: userData.name || '',
      lastName: userData.surname || '',
      email: userData.email || '',
      role: 'admin',
      status: 'active',
      individualPermissions: { removed: [], added: [] },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await enterpriseUserRef.set(enterpriseUserData);
    console.log(`✅ User record created in enterprise subcollection`);

    console.log(`\n🎉 Done! User is now linked to enterprise ${enterpriseId}`);
    console.log(`\n💡 You can now run: node test-phase1-quick.js`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

linkUserToEnterprise();
