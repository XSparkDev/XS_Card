/**
 * Google OAuth Provider
 * 
 * Implements Google OAuth authentication via backend proxy.
 * Backend handles Google OAuth (requires https:// redirect URIs).
 * App receives Firebase custom token via deep link.
 * 
 * This is POOP (new code) - doesn't modify any existing code.
 * Reuses CEMENT: Firebase auth, storeAuthData (in SignInScreen handler).
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { OAuthResult, OAuthError, OAuthProviderType, IOAuthProvider } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable WebBrowser to close properly after OAuth
WebBrowser.maybeCompleteAuthSession();

// OAuth state storage keys
const OAUTH_STATE_KEY = 'oauth_pending_state';
const OAUTH_STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

const generateState = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const storeOAuthState = async (state: string): Promise<void> => {
  const stateData = { state, timestamp: Date.now() };
  await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(stateData));
};

const retrieveOAuthState = async (): Promise<string | null> => {
  try {
    const stateDataStr = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    if (!stateDataStr) return null;
    const stateData = JSON.parse(stateDataStr);
    const now = Date.now();
    if (now - stateData.timestamp > OAUTH_STATE_EXPIRY) {
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
      return null;
    }
    return stateData.state;
  } catch (error) {
    console.error('[OAuth] Error retrieving state:', error);
    return null;
  }
};

const clearOAuthState = async (): Promise<void> => {
  await AsyncStorage.removeItem(OAUTH_STATE_KEY);
};

const getBackendUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL not configured');
  }
  return url;
};

class GoogleProvider implements IOAuthProvider {
  getProviderId(): OAuthProviderType {
    return 'google.com';
  }

  async signIn(): Promise<OAuthResult> {
    try {
      const backendUrl = getBackendUrl();
      const state = generateState();
      console.log('[Google OAuth] Starting backend-mediated OAuth flow');
      await storeOAuthState(state);
      const oauthStartUrl = `${backendUrl}/oauth/google/start?state=${state}`;
      console.log('[Google OAuth] Opening browser:', oauthStartUrl);
      const result = await WebBrowser.openBrowserAsync(oauthStartUrl, {
        dismissButtonStyle: 'cancel',
        showTitle: false,
        enableBarCollapsing: false,
      });
      if (result.type === 'cancel' || result.type === 'dismiss') {
        await clearOAuthState();
        throw this.createError('user_cancelled', 'Google sign-in was cancelled');
      }
      throw this.createError('pending_callback', 'Waiting for OAuth callback');
    } catch (error: any) {
      await clearOAuthState();
      if (error.providerId) throw error;
      throw this.createError(error.code || 'unknown_error', error.message || 'Unknown error');
    }
  }

  async handleCallback(url: string): Promise<OAuthResult> {
    try {
      console.log('[Google OAuth] Handling callback URL:', url);
      const parsedUrl = Linking.parse(url);
      const { queryParams } = parsedUrl;
      if (!queryParams) {
        throw this.createError('invalid_callback', 'No query parameters in callback URL');
      }
      if (queryParams.error) {
        throw this.createError(queryParams.error as string, 'OAuth failed: ' + queryParams.error);
      }
      const receivedState = queryParams.state as string;
      const storedState = await retrieveOAuthState();
      if (!receivedState || !storedState || receivedState !== storedState) {
        throw this.createError('invalid_state', 'State validation failed');
      }
      await clearOAuthState();
      const firebaseToken = queryParams.token as string;
      if (!firebaseToken) {
        throw this.createError('no_token', 'No Firebase token in callback');
      }
      console.log('[Google OAuth] Firebase custom token received, signing in...');
      const userCredential = await signInWithCustomToken(auth, firebaseToken);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken();
      console.log('[Google OAuth] Firebase sign-in successful');
      return {
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        },
        token: idToken,
        providerId: 'google.com',
      };
    } catch (error: any) {
      await clearOAuthState();
      if (error.providerId) throw error;
      throw this.createError(error.code || 'callback_failed', error.message || 'Failed to complete OAuth callback');
    }
  }

  private createError(code: string, message: string): OAuthError {
    return { code, message, providerId: 'google.com' };
  }
}

export const googleProvider = new GoogleProvider();

export const signInWithGoogle = async (): Promise<OAuthResult> => {
  return googleProvider.signIn();
};

export const handleGoogleCallback = async (url: string): Promise<OAuthResult> => {
  return googleProvider.handleCallback(url);
};
