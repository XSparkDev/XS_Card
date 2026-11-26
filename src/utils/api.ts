import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorHandler, ERROR_CODES, handleAuthError, handleNetworkError, createAppError } from './errorHandler';
// Firebase integration for enhanced token refresh
import { auth } from '../config/firebaseConfig';
import { getKeepLoggedInPreference, getStoredAuthData } from './authStorage';
// Single source of truth for token refresh/classification/sign-out
import { ensureFreshIdToken, endSession, setAuthNavigationRef, authLog } from '../services/authSessionService';
// Toast service for centralized imports
import { toastService, useToast } from '../hooks/useToast';

// Add these types near the top of the file
export interface PasscreatorResponse {
    message: string;
    passUri: string;
    passFileUrl: string;
    passPageUrl: string;
    identifier: string;
    colorScheme?: string; // Add default color support
}

// New interfaces for authentication
export interface TokenRefreshResponse {
    success: boolean;
    token: string;
    expiresIn: number;
    message?: string;
}

export interface TokenValidationResponse {
    valid: boolean;
    expiresAt?: number;
    message?: string;
}

// Forwards the navigation ref to authSessionService, which is now the single
// place that resets navigation on session end (whether triggered by a live
// 401 response or a session-ending event discovered in the background).
export const setGlobalNavigationRef = (navigationRef: any) => {
  setAuthNavigationRef(navigationRef);
};

// Global AuthContext reference for forced logout notifications
let globalAuthContextRef: any = null;

export const setGlobalAuthContextRef = (ref: any) => {
  globalAuthContextRef = ref;
};

// Helper function to get the appropriate base URL

const getBaseUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (envBaseUrl) {
    return envBaseUrl;
  }

  // Safe fallback to production backend to avoid accidental local defaults.
  return 'https://apistaging.xscard.co.za';
};

export const API_BASE_URL = getBaseUrl();

// API endpoints
export const ENDPOINTS = {
    ADD_USER: '/AddUser',
    UPLOAD_USER_IMAGES: '/Users/:userId/UploadImages',
    GENERATE_QR_CODE: '/generateQR',
    SIGN_IN: '/SignIn',
    GET_USER: '/Users',
    GET_CARD: '/Cards',
    ADD_CARD: '/AddCard',
    GET_CONTACTS: '/Contacts',
    ADD_CONTACT: '/AddContact',
    UPDATE_USER: '/UpdateUser',
    UPDATE_PROFILE_IMAGE: '/Users/:id/profile-image',
    UPDATE_COMPANY_LOGO: '/Users/:id/company-logo', 
    UPDATE_USER_COLOR: '/Users/:id/color', 
    ADD_TO_WALLET: '/Cards/:userId/wallet/:cardIndex',
    DELETE_CONTACT: '/Contacts',
    UPDATE_FOLLOW_UP_STATUS: '/Contacts/:userId/contact/:index/followup',
    UPDATE_CARD: '/Cards/:id',
    RESTART_SPEAKER_WINDOW: '/Cards/:id/restart-speaker-window',
    UPDATE_CARD_COLOR: '/Cards/:id/color',
    CREATE_MEETING: '/meetings',
    MEETING_INVITE: '/meetings/invite',
    DELETE_CARD: '/Cards/:id',
    UPGRADE_USER: '/Users/:id/upgrade',
    INITIALIZE_PAYMENT: '/payment/initialize',
    SUBSCRIPTION_STATUS: '/subscription/status',
    REVENUECAT_SYNC: '/api/revenuecat/sync',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    CHANGE_PASSWORD: '/change-password',
    RESEND_VERIFICATION: '/resend-verification',
    RESEND_VERIFICATION_PUBLIC: '/public/resend-verification',
    // New authentication endpoints for Phase 4
    REFRESH_TOKEN: '/refresh-token',
    VALIDATE_TOKEN: '/validate-token',
    TEST_EXPIRED_TOKEN: '/test-expired-token', // Phase 4A Testing
    TEST_TOKEN_REFRESH_SUCCESS: '/test-token-refresh-success', // Phase 4B Testing
    LOGOUT: '/logout',
    
    // Events API endpoints
    // Discovery
    GET_PUBLIC_EVENTS: '/events/public',
    SEARCH_EVENTS: '/events/search',
    GET_EVENT_DETAILS: '/events/:eventId',
    
    // Event Management
    CREATE_EVENT: '/events',
    UPDATE_EVENT: '/events/:eventId',
    PUBLISH_EVENT: '/events/:eventId/publish',
    DELETE_EVENT: '/events/:eventId',
    CHECK_EVENT_PAYMENT_STATUS: '/events/:eventId/payment/status',
    
    // Event Registration
    REGISTER_EVENT: '/events/:eventId/register',
    UNREGISTER_EVENT: '/events/:eventId/unregister',
    
    // Bulk Registration
    CREATE_BULK_REGISTRATION: '/api/events/:eventId/bulk-register',
    GET_BULK_REGISTRATION: '/api/bulk-registrations/:bulkRegistrationId',
    GET_USER_BULK_REGISTRATIONS: '/api/user/bulk-registrations',
    CANCEL_BULK_REGISTRATION: '/api/bulk-registrations/:bulkRegistrationId',
    
    // User Events
    GET_USER_EVENTS: '/user/events',
    GET_USER_REGISTRATIONS: '/user/registrations',
    
    // Event Preferences
    GET_EVENT_PREFERENCES: '/user/event-preferences',
    UPDATE_EVENT_PREFERENCES: '/user/event-preferences',
    INITIALIZE_EVENT_PREFERENCES: '/user/event-preferences/initialize',
    
    // Event Database Setup
    INITIALIZE_EVENT_DB: '/events/initialize-db',
    
    // WebSocket Status
    WEBSOCKET_STATUS: '/events/websocket/status',
    
    // Event Organiser Registration
    GET_ORGANISER_BANKS: '/api/event-organisers/banks',
    REGISTER_ORGANISER_STEP1: '/api/event-organisers/register/step1',
    REGISTER_ORGANISER_STEP2: '/api/event-organisers/register/step2',
    REGISTER_ORGANISER_STEP3: '/api/event-organisers/register/step3',
    GET_ORGANISER_STATUS: '/api/event-organisers/status',
    GET_ORGANISER_PROFILE: '/api/event-organisers/profile',
    UPDATE_ORGANISER_PROFILE: '/api/event-organisers/profile',
    
    // Recurring Events
    GET_EVENT_INSTANCES: '/events/:eventId/instances',
    GET_EVENT_INSTANCE: '/events/:eventId/instances/:instanceId',
    END_RECURRING_SERIES: '/events/:eventId/series/end',
    
    // User Management
    DEACTIVATE_USER: '/Users',
    DELETE_ACCOUNT: '/Users/delete-account',
    
    // iOS Version Check
    IOS_VERSION_INFO: '/ios-version-info',
    IOS_VERSION_CHECK: '/ios-version-check',
};

export const buildUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// Add this utility function to get headers with authentication
export const getAuthHeaders = async (additionalHeaders = {}) => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Authorization': token || '',
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
};

export const getUserId = async (): Promise<string | null> => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData).id;
    }
    return null;
  } catch (error) {
    if (__DEV__) console.error('Error getting user ID:', error);
    return null;
  }
};

// Helper function to make authenticated requests
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    
    // Build headers - only set Content-Type if not FormData
    const headers: Record<string, string> = {
      'Authorization': `${token}`, // Token from login is used here
    };
    
    // Only add Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Merge with any provided headers
    const finalHeaders = {
      ...headers,
      ...options.headers,
    };

    const response = await fetch(buildUrl(endpoint), {
      ...options, 
      headers: finalHeaders,
    });

    return response;
  } catch (error) {
    if (__DEV__) console.error('Authenticated fetch error:', error);
    throw error;
  }
};

// Token refresh, delegated entirely to authSessionService (which uses
// Firebase's own getIdToken() and retries transient failures with backoff).
// Kept as a thin wrapper since several call sites already import it.
export const refreshAuthToken = async (): Promise<string> => {
  const { token, errorClass } = await ensureFreshIdToken({ forceRefresh: true });
  if (!token) {
    if (errorClass === 'fatal') {
      const error = createAppError(ERROR_CODES.TOKEN_INVALID, new Error('Session cannot be refreshed'));
      await handleAuthError(error, () => forceLogoutExpiredToken());
      throw error;
    }
    const error = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, new Error('Token refresh temporarily unavailable'));
    throw error;
  }
  return `Bearer ${token}`;
};

// Token validation, delegated to authSessionService. A network-classified
// failure returns false for THIS check without ending the session - callers
// that need "is there a live session at all" should prefer checking
// auth.currentUser directly rather than treating a transient false as fatal.
export const validateAuthToken = async (): Promise<boolean> => {
  const { token } = await ensureFreshIdToken();
  return !!token;
};

// Authenticated fetch that keeps the ID token fresh and only ends the
// session for a confirmed, unrecoverable auth failure - never for a network
// blip or a single unlucky request.
export const authenticatedFetchWithRefresh = async (endpoint: string, options: RequestInit = {}) => {
  try {
    // Cheap up-front check: Firebase itself decides whether the cached token
    // is actually stale enough to warrant a network call.
    if (auth.currentUser) {
      await ensureFreshIdToken();
    }

    let response = await authenticatedFetch(endpoint, options);

    if (response.status === 401) {
      // Always attempt a forced token refresh before treating a 401 as fatal.
      // A backend restart, edge deploy, CDN cache miss, or momentary auth-cache
      // inconsistency can all produce transient 401s that have nothing to do
      // with the user's actual auth status. Never end a session on the first 401.
      const { token, errorClass } = await ensureFreshIdToken({ forceRefresh: true });

      if (!token) {
        if (errorClass === 'fatal') {
          await forceLogoutExpiredToken();
          const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Session ended'));
          throw error;
        }
        // Recoverable (network) failure: surface an error for this request only;
        // do not touch the session — it may succeed on the next attempt.
        const error = createAppError(ERROR_CODES.NETWORK_ERROR, new Error('Could not verify your session — check your connection'));
        throw error;
      }

      response = await authenticatedFetch(endpoint, options);

      if (response.status === 401) {
        // A freshly-minted token was still rejected — confirmed auth failure.
        await forceLogoutExpiredToken();
        const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Authentication failed after token refresh'));
        throw error;
      }

      return response;
    }

    // Handle other HTTP errors
    if (!response.ok) {
      if (response.status >= 500) {
        const error = createAppError(ERROR_CODES.SERVER_ERROR, new Error(`Server error: ${response.status}`));
        await ErrorHandler.handleError(error, {
          retryAction: async () => {
            const retryResponse = await authenticatedFetch(endpoint, options);
            if (!retryResponse.ok) {
              throw new Error(`Retry failed: ${retryResponse.status}`);
            }
          },
          maxRetries: 2
        });
      } else if (response.status === 403) {
        const error = createAppError(ERROR_CODES.PERMISSION_DENIED, new Error('Permission denied'));
        await ErrorHandler.handleError(error, { showUserMessage: false }); // No popups
      } else if (response.status === 404) {
        const error = createAppError(ERROR_CODES.RESOURCE_NOT_FOUND, new Error('Resource not found'));
        await ErrorHandler.handleError(error, { showUserMessage: false }); // No popups
      }
    }

    return response;
  } catch (error) {
    // Network errors here are genuinely transient - never end the session
    // for one; just let the caller see the failure for this request.
    if (error instanceof TypeError && error.message.includes('fetch')) {
      await handleNetworkError(error, async () => {
        await authenticatedFetchWithRefresh(endpoint, options);
      });
    }

    throw error;
  }
};

// Notifies the backend of the logout event. Best-effort — failures are
// silently swallowed so local sign-out is never blocked by a server error.
export const performServerLogout = async (): Promise<void> => {
  try {
    const authData = await getStoredAuthData();
    const token = authData?.userToken;

    if (token) {
      await fetch(buildUrl(ENDPOINTS.LOGOUT), {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch {
    // Intentionally silent — local sign-out must not depend on server response.
  }
};

// Ends a confirmed-unrecoverable session. Delegates the actual sign-out +
// storage clearing to endSession() (the single path for that), then updates
// React state and navigation - the two things only this layer can do.
export const forceLogoutExpiredToken = async (navigationCallback?: () => void): Promise<void> => {
  try {
    await endSession('confirmed_auth_failure');

    if (globalAuthContextRef) {
      globalAuthContextRef.dispatch({ type: 'CLEAR_USER' });
      globalAuthContextRef.dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
    }

    // endSession() already resets navigation via the shared ref; a caller-
    // supplied callback is an explicit override some flows still pass in.
    if (navigationCallback) {
      navigationCallback();
    }
  } catch (error) {
    authLog('refresh_failed', { step: 'forceLogoutExpiredToken', error: String(error) });
  }
};

// Test function for token expiration - DEVELOPMENT ONLY
export const testTokenExpiration = async (): Promise<void> => {
  try {
    console.log('[Test] Testing token expiration...');
    
    const response = await fetch(buildUrl(ENDPOINTS.TEST_EXPIRED_TOKEN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': await AsyncStorage.getItem('userToken') || '',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Test] Token expiration test result:', data);
    } else {
      console.log('[Test] Token expiration test failed:', response.status);
    }
  } catch (error) {
    console.error('[Test] Token expiration test error:', error);
  }
};

// Test function to manually expire token - DEVELOPMENT ONLY
export const manuallyExpireToken = async (): Promise<void> => {
  try {
    console.log('[Test] Manually expiring token...');
    
    // Clear the token from storage
    await AsyncStorage.removeItem('userToken');
    console.log('[Test] Token cleared from storage');
    
    // Also clear lastLoginTime to make it appear expired
    await AsyncStorage.removeItem('lastLoginTime');
    console.log('[Test] Last login time cleared');
    
    console.log('[Test] Token manually expired - next API call will trigger logout');
  } catch (error) {
    console.error('[Test] Error manually expiring token:', error);
  }
};

// ============= CALENDAR PREFERENCES API =============

/**
 * Get calendar preferences
 */
export const getCalendarPreferences = async (): Promise<any> => {
  try {
    const response = await authenticatedFetchWithRefresh('/meetings/preferences', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Calendar Preferences] API error:', response.status, errorData);
      throw new Error(errorData.message || `Failed to fetch calendar preferences (${response.status})`);
    }

    return response.json();
  } catch (error: any) {
    console.error('[Calendar Preferences] Error fetching preferences:', error);
    throw error;
  }
};

/**
 * Update calendar preferences
 */
export const updateCalendarPreferences = async (preferences: any): Promise<any> => {
  try {
    const response = await authenticatedFetchWithRefresh('/meetings/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Calendar Preferences] Update error:', response.status, errorData);
      throw new Error(errorData.message || `Failed to update calendar preferences (${response.status})`);
    }

    return response.json();
  } catch (error: any) {
    console.error('[Calendar Preferences] Error updating preferences:', error);
    throw error;
  }
};

// Re-export toast service and hook for centralized imports
export { toastService, useToast };

// ============= RECURRING EVENTS API =============

import { EventInstance } from '../types/events';

/**
 * Get all instances for a recurring event
 */
export const getEventInstances = async (
  eventId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<EventInstance[]> => {
  try {
    let url = ENDPOINTS.GET_EVENT_INSTANCES.replace(':eventId', eventId);
    const params = new URLSearchParams();
    
    if (options?.startDate) {
      params.append('startDate', options.startDate);
    }
    if (options?.endDate) {
      params.append('endDate', options.endDate);
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await authenticatedFetchWithRefresh(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch event instances: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data?.instances) {
      return data.data.instances;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('[getEventInstances] Error:', error);
    throw error;
  }
};

/**
 * Get a specific instance of a recurring event
 */
export const getEventInstance = async (
  eventId: string,
  instanceId: string
): Promise<EventInstance> => {
  try {
    const url = ENDPOINTS.GET_EVENT_INSTANCE
      .replace(':eventId', eventId)
      .replace(':instanceId', instanceId);
    
    const response = await authenticatedFetchWithRefresh(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch event instance: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data?.instance) {
      return data.data.instance;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('[getEventInstance] Error:', error);
    throw error;
  }
};

/**
 * End a recurring event series
 */
export const endRecurringSeries = async (eventId: string): Promise<void> => {
  try {
    const url = ENDPOINTS.END_RECURRING_SERIES.replace(':eventId', eventId);
    
    const response = await authenticatedFetchWithRefresh(url, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to end recurring series: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to end recurring series');
    }
  } catch (error) {
    console.error('[endRecurringSeries] Error:', error);
    throw error;
  }
};