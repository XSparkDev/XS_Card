/// <reference path="../types/env.d.ts" />
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration for XSCard App
// This should match your Firebase project (same as backend)
// MIGRATED: Now using xscard-dev project (previously xscard-addd4)
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
  };

// Validate that all required Firebase config values are present
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error('❌ Missing required Firebase configuration:', missingFields);
  console.error('Please set the following environment variables:');
  const envVarMap: Record<string, string> = {
    apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'EXPO_PUBLIC_FIREBASE_APP_ID'
  };
  missingFields.forEach(field => {
    console.error(`  - ${envVarMap[field] || `EXPO_PUBLIC_FIREBASE_${field.toUpperCase()}`}`);
  });
  throw new Error(`Missing Firebase configuration: ${missingFields.join(', ')}`);
}

// Validate project ID matches expected value
if (firebaseConfig.projectId && firebaseConfig.projectId !== 'xscard-dev') {
  console.warn(`⚠️  Warning: Firebase project ID is "${firebaseConfig.projectId}", expected "xscard-dev"`);
  console.warn('   Make sure you have migrated to the correct Firebase project.');
}

// Initialize Firebase with error handling
let app: FirebaseApp;
let auth: Auth;

try {
  // Log the actual config being used (without sensitive data)
  console.log('🔥 [Firebase Config] Initializing with:');
  console.log('   Project ID:', firebaseConfig.projectId);
  console.log('   Auth Domain:', firebaseConfig.authDomain);
  console.log('   Storage Bucket:', firebaseConfig.storageBucket);
  console.log('   API Key:', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 20)}...` : 'MISSING');
  console.log('   App ID:', firebaseConfig.appId);
  
  // Check if Firebase is already initialized and delete it to force reinit
  try {
    // @ts-ignore - getApp and deleteApp might not be in types
    const { getApp, deleteApp } = require('firebase/app');
    try {
      const existingApp = getApp();
      console.log('⚠️  [Firebase Config] Existing Firebase app detected, deleting to force reinit...');
      deleteApp(existingApp).catch(() => {
        // Ignore errors during deletion
      });
      console.log('✅ [Firebase Config] Old Firebase app deletion initiated');
    } catch (e: any) {
      // No existing app, that's fine
      if (!e.message?.includes('No Firebase App')) {
        console.log('ℹ️  [Firebase Config] No existing app to delete');
      }
    }
  } catch (e) {
    // getApp/deleteApp not available, try direct initialization
    console.log('ℹ️  [Firebase Config] Initializing Firebase (no existing app check)');
  }
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  console.log('✅ [Firebase Config] Firebase client initialized successfully');
  console.log('   Project:', firebaseConfig.projectId);
  console.log('   Auth instance created');
  
  // Verify the project ID matches
  if (firebaseConfig.projectId !== 'xscard-dev') {
    console.error('❌ [Firebase Config] CRITICAL: Project ID mismatch!');
    console.error('   Expected: xscard-dev');
    console.error('   Got:', firebaseConfig.projectId);
    console.error('   This will cause authentication failures!');
  }
  
  // Note: Firebase will show a warning about memory persistence
  // However, we handle session persistence via AsyncStorage in AuthContext and authStorage
  // The token and user data are stored in AsyncStorage, which persists across app restarts
} catch (error: any) {
  console.error('❌ [Firebase Config] Firebase initialization failed:', error);
  console.error('   Config used:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 20)}...` : 'MISSING'
  });
  throw error;
}

export { app, auth }; 