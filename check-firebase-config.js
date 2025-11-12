#!/usr/bin/env node

/**
 * Firebase Configuration Checker
 * Verifies that all Firebase environment variables are set correctly for xscard-dev
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
      if (value !== 'xscard-dev') {
        console.log(`⚠️  ${displayName}: "${value}" (Expected: "xscard-dev")`);
        issues.push(`Project ID should be "xscard-dev" but got "${value}"`);
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    // Validate auth domain
    else if (varName === 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN') {
      if (!value.includes('xscard-dev')) {
        console.log(`⚠️  ${displayName}: "${value}" (Should contain "xscard-dev")`);
        issues.push(`Auth domain should be for "xscard-dev" project`);
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    // Check for old API key (from xscard-addd4)
    else if (varName === 'EXPO_PUBLIC_FIREBASE_API_KEY') {
      if (value === 'AIzaSyA1cmFJD61yxZ36hEOXF48r145ZdWA3Pjo') {
        console.log(`⚠️  ${displayName}: "${value.substring(0, 20)}..." (This is the OLD API key from xscard-addd4!)`);
        issues.push('API Key is from the old project (xscard-addd4). You need the API key from xscard-dev');
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value.substring(0, 20)}...`);
      }
    }
    // Check for old messaging sender ID
    else if (varName === 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') {
      if (value === '628567737496') {
        console.log(`⚠️  ${displayName}: "${value}" (This is from the OLD project!)`);
        issues.push('Messaging Sender ID is from the old project');
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    // Check for old app ID
    else if (varName === 'EXPO_PUBLIC_FIREBASE_APP_ID') {
      if (value.includes('628567737496')) {
        console.log(`⚠️  ${displayName}: "${value}" (This is from the OLD project!)`);
        issues.push('App ID is from the old project');
        allValid = false;
      } else {
        console.log(`✅ ${displayName}: ${value}`);
      }
    }
    else {
      console.log(`✅ ${displayName}: ${value}`);
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
  console.log('   1. Go to Firebase Console → xscard-dev project');
  console.log('   2. Project Settings → Your apps → Web app');
  console.log('   3. Copy the config values and update your .env file');
  console.log('   4. Make sure all values are for "xscard-dev" project');
  console.log('   5. Rebuild: npx expo start --clear');
}

console.log('\n');

