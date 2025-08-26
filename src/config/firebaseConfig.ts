import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration for XSCard App
// This should match your Firebase project (same as backend)
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyA1cmFJD61yxZ36hEOXF48r145ZdWA3Pjo",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "xscard-addd4.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "xscard-addd4",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "xscard-addd4.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "628567737496",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:628567737496:web:627d89a8a52ab35d4a7ced"
  };

// Initialize Firebase with error handling
let app: FirebaseApp;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log('Firebase client initialized for project:', firebaseConfig.projectId);
} catch (error) {
  console.error('Firebase initialization failed:', error);
  console.error('Firebase config:', firebaseConfig);
  throw error;
}

export { app, auth }; 