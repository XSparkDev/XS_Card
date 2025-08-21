import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration for XSCard App
// This should match your Firebase project (same as backend)
const firebaseConfig = {
    apiKey: "AIzaSyAHxd3TGf8v9DVUevw6p5F47EBV7ihYTuk", // From your FIREBASE_WEB_API_KEY
    authDomain: "xscard-addd4.firebaseapp.com", // Your project + .firebaseapp.com  
    projectId: "xscard-addd4", // From your FIREBASE_PROJECT_ID
    storageBucket: "xscard-addd4.firebasestorage.app", // From your FIREBASE_STORAGE_BUCKET
    messagingSenderId: "628567737496", // Get this from Firebase Console
    appId: "NEED_FROM_CONSOLE" // Get this from Firebase Console
  };

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

console.log('Firebase client initialized for project:', firebaseConfig.projectId); 