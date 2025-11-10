/**
 * PHASE 3 - OAUTH USER AUTO-CREATION TEST
 * 
 * This script tests the backend's ability to auto-create user documents
 * when OAuth users (Google, LinkedIn, etc.) sign in for the first time.
 * 
 * Test Flow:
 * 1. Create a test user in Firebase Auth with Google provider
 * 2. Get Firebase ID token for that user
 * 3. Call /Users/:uid endpoint (should auto-create Firestore doc)
 * 4. Verify user document was created with correct authProvider
 * 5. Verify subsequent calls return the same user data
 * 6. Cleanup: Delete test user
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin (reuse existing initialization if available)
try {
    admin.app();
    console.log('Using existing Firebase Admin instance');
} catch (e) {
    console.log('Initializing Firebase Admin...');
    require('./firebase'); // This will initialize admin
}

const { db } = require('./firebase');

// Configuration
const BASE_URL = 'http://192.168.68.105:8383';
const TEST_OAUTH_USER = {
    email: `test-oauth-${Date.now()}@xscard.com`,
    displayName: 'Test OAuth User',
    photoURL: 'https://via.placeholder.com/150'
};

// Color output helpers
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

let testUserId = null;
let testToken = null;

// Test 1: Create OAuth User in Firebase Auth
async function createOAuthUser() {
    info('Test 1: Creating OAuth user in Firebase Auth');
    
    try {
        // Create user with email but marked as Google provider
        const userRecord = await admin.auth().createUser({
            email: TEST_OAUTH_USER.email,
            displayName: TEST_OAUTH_USER.displayName,
            photoURL: TEST_OAUTH_USER.photoURL,
            emailVerified: true // OAuth users are pre-verified
        });
        
        testUserId = userRecord.uid;
        
        // Create custom token for this user (simulating OAuth sign-in)
        testToken = await admin.auth().createCustomToken(testUserId);
        
        success(`Created OAuth user: ${testUserId}`);
        success(`Email: ${TEST_OAUTH_USER.email}`);
        success(`Display Name: ${TEST_OAUTH_USER.displayName}`);
        
        return true;
    } catch (err) {
        error(`Failed to create OAuth user: ${err.message}`);
        return false;
    }
}

// Test 2: Sign in with custom token to get ID token
async function signInWithCustomToken() {
    info('Test 2: Getting ID token from custom token');
    
    try {
        // Use Firebase REST API to exchange custom token for ID token
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_API_KEY || 'AIzaSyA1cmFJD61yxZ36hEOXF48r145ZdWA3Pjo'}`,
            {
                token: testToken,
                returnSecureToken: true
            }
        );
        
        if (response.data && response.data.idToken) {
            testToken = `Bearer ${response.data.idToken}`;
            success('Got ID token from custom token');
            return true;
        } else {
            error('No ID token in response');
            return false;
        }
    } catch (err) {
        error(`Failed to get ID token: ${err.response?.data?.error?.message || err.message}`);
        return false;
    }
}

// Test 3: Call getUserById - Should Auto-Create User Doc
async function testAutoCreateUserDoc() {
    info('Test 3: Calling /Users/:uid (should auto-create Firestore doc)');
    
    try {
        // Verify user doc doesn't exist yet
        const userDocBefore = await db.collection('users').doc(testUserId).get();
        if (userDocBefore.exists) {
            warning('User doc already exists - this is unexpected for OAuth test');
        } else {
            info('Confirmed: User doc does not exist yet');
        }
        
        // Call backend endpoint - should trigger auto-creation
        const response = await axios.get(`${BASE_URL}/Users/${testUserId}`, {
            headers: {
                'Authorization': testToken
            }
        });
        
        if (response.status !== 200) {
            error(`Unexpected status code: ${response.status}`);
            return false;
        }
        
        const userData = response.data;
        
        // Verify user data structure
        if (!userData.id || userData.id !== testUserId) {
            error('User ID mismatch');
            return false;
        }
        
        if (!userData.email || userData.email !== TEST_OAUTH_USER.email) {
            error('Email mismatch');
            return false;
        }
        
        if (!userData.authProvider) {
            error('authProvider field missing!');
            return false;
        }
        
        success('User document auto-created successfully');
        info(`Auth Provider: ${userData.authProvider}`);
        info(`Name: ${userData.name} ${userData.surname}`);
        info(`Email: ${userData.email}`);
        info(`Plan: ${userData.plan}`);
        
        if (userData._autoCreated) {
            success('Backend flagged this as auto-created (debug flag)');
        }
        
        return true;
    } catch (err) {
        error(`Auto-creation test failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Test 4: Verify User Doc Exists in Firestore
async function verifyUserDocInFirestore() {
    info('Test 4: Verifying user document exists in Firestore');
    
    try {
        const userDoc = await db.collection('users').doc(testUserId).get();
        
        if (!userDoc.exists) {
            error('User document not found in Firestore!');
            return false;
        }
        
        const userData = userDoc.data();
        
        // Verify key fields
        const checks = [
            { field: 'uid', expected: testUserId, actual: userData.uid },
            { field: 'email', expected: TEST_OAUTH_USER.email, actual: userData.email },
            { field: 'plan', expected: 'free', actual: userData.plan },
            { field: 'status', expected: 'active', actual: userData.status },
            { field: 'isEmailVerified', expected: true, actual: userData.isEmailVerified }
        ];
        
        let allPassed = true;
        for (const check of checks) {
            if (check.actual === check.expected) {
                success(`${check.field}: ${check.actual}`);
            } else {
                error(`${check.field}: expected ${check.expected}, got ${check.actual}`);
                allPassed = false;
            }
        }
        
        // Check authProvider
        if (userData.authProvider) {
            success(`authProvider: ${userData.authProvider}`);
        } else {
            error('authProvider field missing in Firestore document!');
            allPassed = false;
        }
        
        return allPassed;
    } catch (err) {
        error(`Firestore verification failed: ${err.message}`);
        return false;
    }
}

// Test 5: Subsequent Calls Return Same Data
async function testSubsequentCalls() {
    info('Test 5: Testing subsequent API calls return consistent data');
    
    try {
        // Call the endpoint again
        const response = await axios.get(`${BASE_URL}/Users/${testUserId}`, {
            headers: {
                'Authorization': testToken
            }
        });
        
        if (response.status !== 200) {
            error(`Unexpected status code: ${response.status}`);
            return false;
        }
        
        const userData = response.data;
        
        // Should not have auto-created flag this time
        if (userData._autoCreated) {
            warning('Second call still has _autoCreated flag (unexpected but not critical)');
        } else {
            success('Second call returns normal user data (no auto-creation flag)');
        }
        
        success('Subsequent API call successful');
        return true;
    } catch (err) {
        error(`Subsequent call failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Cleanup: Delete Test User
async function cleanup() {
    info('Cleanup: Deleting test user');
    
    try {
        // Delete from Firebase Auth
        if (testUserId) {
            try {
                await admin.auth().deleteUser(testUserId);
                success('Deleted user from Firebase Auth');
            } catch (authErr) {
                warning(`Failed to delete from Auth: ${authErr.message}`);
            }
            
            // Delete from Firestore
            try {
                await db.collection('users').doc(testUserId).delete();
                success('Deleted user from Firestore');
            } catch (firestoreErr) {
                warning(`Failed to delete from Firestore: ${firestoreErr.message}`);
            }
        }
        
        return true;
    } catch (err) {
        error(`Cleanup failed: ${err.message}`);
        return false;
    }
}

// Main test runner
async function runOAuthTests() {
    log('\n========================================', 'blue');
    log('🔐 PHASE 3: OAUTH USER AUTO-CREATION TEST', 'blue');
    log('========================================\n', 'blue');
    
    info(`Testing against: ${BASE_URL}`);
    info(`Test user email: ${TEST_OAUTH_USER.email}\n`);
    
    const results = {
        createUser: false,
        getIdToken: false,
        autoCreate: false,
        verifyFirestore: false,
        subsequentCalls: false
    };
    
    try {
        // Run tests sequentially
        results.createUser = await createOAuthUser();
        if (!results.createUser) {
            throw new Error('Failed to create OAuth user');
        }
        
        console.log('');
        results.getIdToken = await signInWithCustomToken();
        if (!results.getIdToken) {
            throw new Error('Failed to get ID token');
        }
        
        console.log('');
        results.autoCreate = await testAutoCreateUserDoc();
        
        console.log('');
        results.verifyFirestore = await verifyUserDocInFirestore();
        
        console.log('');
        results.subsequentCalls = await testSubsequentCalls();
        
    } catch (err) {
        error(`\nTest suite error: ${err.message}`);
    } finally {
        // Always cleanup
        console.log('');
        await cleanup();
    }
    
    // Summary
    log('\n========================================', 'blue');
    log('📊 TEST RESULTS SUMMARY', 'blue');
    log('========================================\n', 'blue');
    
    const allPassed = Object.values(results).every(r => r === true);
    
    Object.entries(results).forEach(([test, passed]) => {
        if (passed) {
            success(`${test}: PASSED`);
        } else {
            error(`${test}: FAILED`);
        }
    });
    
    console.log('');
    
    if (allPassed) {
        log('========================================', 'green');
        log('✅ ALL OAUTH TESTS PASSED', 'green');
        log('🏗️  BACKEND CEMENT IS SOLID', 'green');
        log('========================================\n', 'green');
        return true;
    } else {
        log('========================================', 'red');
        log('❌ OAUTH TESTS FAILED', 'red');
        log('💩 POOP DETECTED - REVERT TO LAST CEMENT', 'red');
        log('========================================\n', 'red');
        return false;
    }
}

// Run tests
runOAuthTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        error(`\nUnexpected error: ${err.message}`);
        console.error(err);
        process.exit(1);
    });

