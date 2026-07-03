/// <reference path="../types/env.d.ts" />
import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration for XSCard App.
// This must match the backend Firebase project to avoid auth mismatches.
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

  // Use AsyncStorage-backed persistence so Firebase itself remembers the
  // signed-in user (and its refresh token) across app restarts. Without this,
  // getAuth() defaults to in-memory persistence and the SDK forgets the
  // session on every cold start, which is why "keep me logged in" previously
  // relied on fragile custom recovery/retry logic.
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (persistenceError: any) {
    // initializeAuth throws if auth was already initialized for this app
    // (e.g. Fast Refresh in dev). Fall back to the existing instance.
    auth = getAuth(app);
  }

  console.log('✅ [Firebase Config] Firebase client initialized successfully');
  console.log('   Project:', firebaseConfig.projectId);
  console.log('   Auth instance created with AsyncStorage persistence');

  if (firebaseConfig.projectId) {
    console.log('   Firebase Project ID:', firebaseConfig.projectId);
  }
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