/**
 * OAuth Providers Helper
 * 
 * Provider-agnostic OAuth utilities for Firebase authentication.
 * Supports Google (Phase 2) and LinkedIn (Future Phase).
 * 
 * Design: Each provider returns a Firebase credential that can be used
 * with signInWithCredential, keeping the rest of the auth flow unchanged.
 */

import { Platform } from 'react-native';
import { GoogleAuthProvider, OAuthCredential, signInWithCredential } from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebaseConfig';

// ============= TYPES =============

export interface OAuthSignInResult {
  success: boolean;
  firebaseUser?: any;
  error?: string;
  provider: 'google' | 'linkedin' | 'apple';
}

export interface OAuthProviderConfig {
  // Google OAuth config
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  
  // LinkedIn OAuth config (future)
  linkedInClientId?: string;
  linkedInRedirectUri?: string;
  
  // Apple OAuth config (future)
  appleServiceId?: string;
}

// ============= GOOGLE OAUTH =============

/**
 * Sign in with Google using native SDK
 * 
 * Flow:
 * 1. Initialize Google Sign-In with web client ID
 * 2. Trigger native Google sign-in flow
 * 3. Get ID token from Google
 * 4. Create Firebase credential
 * 5. Sign in to Firebase with credential
 * 6. Return Firebase user
 * 
 * @returns OAuthSignInResult with Firebase user or error
 */
export async function signInWithGoogle(): Promise<OAuthSignInResult> {
  try {
    console.log('[OAuth] Starting Google sign-in...');
    
    // Configure Google Sign-In
    // The webClientId comes from Firebase Console -> Project Settings -> General
    // It's the Web SDK configuration's Client ID
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '628567737496-YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      offlineAccess: false,
    });

    console.log('[OAuth] Google Sign-In configured');

    // Check if Google Play Services are available (Android only)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('[OAuth] Google Play Services available');
    }

    // Trigger native Google sign-in
    const userInfo = await GoogleSignin.signIn();
    console.log('[OAuth] Google sign-in successful, user:', userInfo.user.email);

    // Get the ID token from Google
    const idToken = userInfo.idToken;
    if (!idToken) {
      throw new Error('No ID token returned from Google sign-in');
    }

    console.log('[OAuth] Google ID token obtained');

    // Create Firebase credential from Google token
    const googleCredential = GoogleAuthProvider.credential(idToken);
    console.log('[OAuth] Firebase credential created from Google token');

    // Sign in to Firebase with the Google credential
    const userCredential = await signInWithCredential(auth, googleCredential);
    console.log('[OAuth] Firebase sign-in successful, UID:', userCredential.user.uid);

    return {
      success: true,
      firebaseUser: userCredential.user,
      provider: 'google',
    };

  } catch (error: any) {
    console.error('[OAuth] Google sign-in error:', error);

    let errorMessage = 'Google sign-in failed';
    
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      errorMessage = 'Sign-in cancelled';
    } else if (error.code === statusCodes.IN_PROGRESS) {
      errorMessage = 'Sign-in already in progress';
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      errorMessage = 'Google Play Services not available';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      provider: 'google',
    };
  }
}

/**
 * Sign out from Google
 * Call this during app logout to also sign out of Google account
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    
    if (isSignedIn) {
      await GoogleSignin.signOut();
      console.log('[OAuth] Signed out from Google');
    }
  } catch (error) {
    console.error('[OAuth] Error signing out from Google:', error);
    // Don't throw - logout should continue even if Google sign-out fails
  }
}

// ============= LINKEDIN OAUTH (Future Implementation) =============

/**
 * Sign in with LinkedIn (placeholder for future implementation)
 * 
 * Future flow:
 * 1. Use expo-auth-session to get LinkedIn authorization code
 * 2. Exchange code for access token via backend
 * 3. Get LinkedIn user profile
 * 4. Create Firebase custom token on backend
 * 5. Sign in to Firebase with custom token
 * 6. Return Firebase user
 */
export async function signInWithLinkedIn(): Promise<OAuthSignInResult> {
  // Placeholder for Phase 3 implementation
  return {
    success: false,
    error: 'LinkedIn sign-in not yet implemented',
    provider: 'linkedin',
  };
}

// ============= PROVIDER-AGNOSTIC UTILITIES =============

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    'password': 'Email',
    'google.com': 'Google',
    'linkedin.com': 'LinkedIn',
    'apple.com': 'Apple',
  };
  
  return names[provider] || provider;
}

/**
 * Check if user signed in with specific provider
 */
export function isProvider(user: any, provider: string): boolean {
  if (!user || !user.providerData) return false;
  
  return user.providerData.some((p: any) => p.providerId === provider);
}

/**
 * Get all providers for a user
 */
export function getUserProviders(user: any): string[] {
  if (!user || !user.providerData) return [];
  
  return user.providerData.map((p: any) => p.providerId);
}

