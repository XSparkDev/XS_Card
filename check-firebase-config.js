#!/usr/bin/env node

/**
 * Firebase Configuration Checker
 * Verifies that all Firebase environment variables are set correctly.
 */

require('dotenv').config();

const requiredVars = {
  'EXPO_PUBLIC_FIREBASE_API_KEY': 'API Key',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': 'Auth Domain',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID': 'Project ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': 'Storage Bucket',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': 'Messaging Sender ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID': 'App ID'
};

console.log('🔍 Checking Firebase Configuration...\n');

let allValid = true;
const issues = [];
const expectedProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'xscard-addd4';
const expectedAuthDomain = `${expectedProjectId}.firebaseapp.com`;

// Check each required variable
for (const [varName, displayName] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${displayName}: MISSING`);
    issues.push(`${varName} is not set`);
    allValid = false;
  } else {
    // Validate project ID
    if (varName === 'EXPO_PUBLIC_FIREBASE_PROJECT_ID') {
      if (value !== expectedProjectId) {
        console.log(`⚠️  ${displayName}: "${value}" (Expected: "${expectedProjectId}")`);
        issues.push(`Project ID should be "${expectedProjectId}" but got "${value}"`);
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    // Validate auth domain
    else if (varName === 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN') {
      if (value !== expectedAuthDomain) {
        console.log(`⚠️  ${displayName}: "${value}" (Expected: "${expectedAuthDomain}")`);
        issues.push(`Auth domain should be "${expectedAuthDomain}"`);
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    else {
      const safeValue = varName === 'EXPO_PUBLIC_FIREBASE_API_KEY'
        ? `${value.substring(0, 20)}...`
        : value;
      console.log(`✅ ${displayName}: ${safeValue}`);
    }
  }
}

console.log('\n' + '='.repeat(60));

if (allValid) {
  console.log('\n✅ All Firebase configuration looks correct!');
  console.log('\n📝 Next steps:');
  console.log('   1. Clear Expo cache: npx expo start --clear');
  console.log('   2. Rebuild the app if using native builds');
  console.log('   3. Test authentication');
} else {
  console.log('\n❌ Configuration issues found:\n');
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  console.log('\n📝 To fix:');
  console.log(`   1. Go to Firebase Console → ${expectedProjectId} project`);
  console.log('   2. Project Settings → Your apps → Web app');
  console.log('   3. Copy the config values and update your .env file');
  console.log(`   4. Make sure all values are for "${expectedProjectId}" project`);
  console.log('   5. Rebuild: npx expo start --clear');
}

console.log('\n');

