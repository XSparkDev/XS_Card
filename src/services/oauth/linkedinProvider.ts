/**
 * LinkedIn OAuth Provider
 * Phase 2: POOP - LinkedIn provider implementation
 * 
 * Implements IOAuthProvider interface for LinkedIn authentication.
 * Follows the same backend-mediated flow as Google OAuth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { OAuthError, OAuthProviderType, OAuthResult, IOAuthProvider } from './types';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_STATE_KEY = 'oauth_pending_state_linkedin';
const OAUTH_STATE_EXPIRY = 10 * 60 * 1000;

/**
 * Keep a copy of the pending state in memory.
 * Some flows (e.g. AuthManager auto-logout) clear AsyncStorage while the browser is open.
 * Holding the state in memory lets us recover even if AsyncStorage was wiped.
 */
let inMemoryState: { state: string; timestamp: number } | null = null;

const generateState = (): string => {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const storeOAuthState = async (state: string): Promise<void> => {
  const timestamp = Date.now();
  inMemoryState = { state, timestamp };
  const stateData = { state, timestamp };
  try {
    await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(stateData));
  } catch (error) {
    // AsyncStorage write failures should not break the flow
    console.warn('[LinkedIn OAuth] Failed to persist OAuth state:', error);
  }
};

const retrieveOAuthState = async (): Promise<string | null> => {
  try {
    if (inMemoryState) {
      if (Date.now() - inMemoryState.timestamp <= OAUTH_STATE_EXPIRY) {
        return inMemoryState.state;
      }
      inMemoryState = null;
    }

    const raw = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.state || !parsed?.timestamp) {
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
      return null;
    }

    if (Date.now() - parsed.timestamp > OAUTH_STATE_EXPIRY) {
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
      return null;
    }

    return parsed.state as string;
  } catch (error) {
    console.error('[LinkedIn OAuth] Failed to retrieve state:', error);
    return null;
  }
};

const clearOAuthState = async (): Promise<void> => {
  inMemoryState = null;
  try {
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
  } catch (error) {
    console.warn('[LinkedIn OAuth] Failed to clear OAuth state:', error);
  }
};

const getBackendUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL not configured');
  }
  return url;
};

class LinkedInProvider implements IOAuthProvider {
  getProviderId(): OAuthProviderType {
    return 'linkedin.com';
  }

  async signIn(): Promise<OAuthResult> {
    try {
      const backendUrl = getBackendUrl();
      const state = generateState();

      console.log('[LinkedIn OAuth] Starting backend-mediated OAuth flow');
      console.log('[LinkedIn OAuth] Generated state:', state);

      await storeOAuthState(state);

      const oauthStartUrl = `${backendUrl}/oauth/linkedin/start?state=${state}`;

      console.log('[LinkedIn OAuth] Opening browser:', oauthStartUrl);

      const result = await WebBrowser.openBrowserAsync(oauthStartUrl, {
        dismissButtonStyle: 'cancel',
        showTitle: false,
        enableBarCollapsing: false,
      });

      console.log('[LinkedIn OAuth] Browser result:', result.type);

      // In backend-mediated flow, browser closes after redirecting to deep link
      // Check if callback already processed (state cleared) = success
      // If state still exists = user cancelled before redirect
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // Small delay to allow deep link handler to process if it's happening
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const remainingState = await retrieveOAuthState();
        if (!remainingState) {
          // State was cleared = callback already processed successfully
          // Don't throw error, deep link handler completed sign-in
          console.log('[LinkedIn OAuth] Browser closed but state cleared - callback already processed');
          throw this.createError(
            'pending_callback',
            'OAuth callback already processed. Sign-in should be complete.'
          );
        }
        
        // State still exists = user cancelled before redirect
        await clearOAuthState();
        throw this.createError('user_cancelled', 'LinkedIn sign-in was cancelled');
      }

      throw this.createError(
        'pending_callback',
        'Waiting for OAuth callback. Deep link listener will complete sign-in.'
      );
    } catch (error: any) {
      // Don't log pending_callback as an error - it's expected in backend-mediated flow
      if (error.providerId && error.code === 'pending_callback') {
        throw error; // Re-throw without logging
      }
      
      if (error.providerId) {
        // Other OAuth errors (user_cancelled, etc.) - log and re-throw
        console.error('[LinkedIn OAuth] Error starting flow:', error);
        await clearOAuthState();
        throw error;
      }

      // Non-OAuth errors
      console.error('[LinkedIn OAuth] Error starting flow:', error);
      await clearOAuthState();
      throw this.createError(error.code || 'unknown_error', error.message || 'Failed to start LinkedIn sign-in');
    }
  }

  async handleCallback(url: string): Promise<OAuthResult> {
    try {
      console.log('[LinkedIn OAuth] Handling callback URL:', url);

      const { queryParams } = Linking.parse(url);

      if (!queryParams) {
        throw this.createError('invalid_callback', 'No query parameters in callback URL');
      }

      if (queryParams.error) {
        throw this.createError(queryParams.error as string, 'OAuth failed: ' + queryParams.error);
      }

      const receivedState = queryParams.state as string;
      const storedState = await retrieveOAuthState();

      if (!receivedState || !storedState || receivedState !== storedState) {
        // This is a stale callback from a previous OAuth attempt
        // Log it but don't throw error - just ignore it silently
        console.log('[LinkedIn OAuth] Ignoring stale callback. Received state:', receivedState, 'Current state:', storedState);
        throw this.createError('stale_callback', 'Stale callback from previous OAuth attempt - ignored');
      }

      await clearOAuthState();

      const firebaseToken = queryParams.token as string;
      if (!firebaseToken) {
        throw this.createError('no_token', 'No Firebase token in callback');
      }

      console.log('[LinkedIn OAuth] Firebase custom token received, signing in...');

      const userCredential = await signInWithCustomToken(auth, firebaseToken);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken();

      console.log('[LinkedIn OAuth] Firebase sign-in successful');

      return {
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        },
        token: idToken,
        providerId: 'linkedin.com',
      };
    } catch (error: any) {
      // Don't clear state or log error for stale callbacks
      if (error.code === 'stale_callback') {
        console.log('[LinkedIn OAuth] Stale callback ignored, preserving current OAuth state');
        throw error; // Re-throw but don't clear state
      }
      
      console.error('[LinkedIn OAuth] Callback error:', error);
      await clearOAuthState();

      if (error.providerId) {
        throw error;
      }

      throw this.createError(error.code || 'callback_failed', error.message || 'Failed to complete OAuth callback');
    }
  }

  private createError(code: string, message: string): OAuthError {
    return {
      code,
      message,
      providerId: 'linkedin.com',
    };
  }
}

export const linkedinProvider = new LinkedInProvider();

export const signInWithLinkedIn = async (): Promise<OAuthResult> => {
  return linkedinProvider.signIn();
};

export const handleLinkedInCallback = async (url: string): Promise<OAuthResult> => {
  return linkedinProvider.handleCallback(url);
};

