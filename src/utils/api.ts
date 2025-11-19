import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorHandler, ERROR_CODES, handleAuthError, handleNetworkError, createAppError } from './errorHandler';
// Firebase integration for enhanced token refresh
import { auth } from '../config/firebaseConfig';
// Import for keepLoggedIn preference check
import { getKeepLoggedInPreference } from './authStorage';
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

// Global navigation reference for automatic logout
let globalNavigationRef: any = null;

export const setGlobalNavigationRef = (navigationRef: any) => {
  globalNavigationRef = navigationRef;
};

// Global AuthContext reference for forced logout notifications
let globalAuthContextRef: any = null;

export const setGlobalAuthContextRef = (ref: any) => {
  globalAuthContextRef = ref;
};

// Helper function to get the appropriate base URL

const getBaseUrl = () => {
  // For production, use the deployed server
  //return 'https://xscard-app-8ign.onrender.com';
  // return 'https://baseurl.xscard.co.za';

  // For development, try multiple local addresses
  // You can uncomment the appropriate line for your network setup
  
  // Common localhost addresses
  // return 'http://192.168.8.249:8383';
  return 'https://846084eede03.ngrok-free.app';
  
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
    UPDATE_CARD: '/Cards/:id',
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
    console.error('Error getting user ID:', error);
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
    console.error('Authenticated fetch error:', error);
    throw error;
  }
};

// ENHANCED: Token refresh function with Firebase integration
export const refreshAuthToken = async (): Promise<string> => {
  try {
    const currentToken = await AsyncStorage.getItem('userToken');
    
    if (!currentToken) {
      const error = createAppError(ERROR_CODES.TOKEN_INVALID, new Error('No token to refresh'));
      await handleAuthError(error);
      throw error;
    }

    console.log('[Token Refresh] Attempting Firebase-enhanced token refresh...');
    
    // Try Firebase token refresh first (primary method)
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        console.log('[Token Refresh] Using Firebase token refresh (primary method)');
        const newFirebaseToken = await firebaseUser.getIdToken(true); // Force refresh
        const newTokenWithBearer = `Bearer ${newFirebaseToken}`;
        
        // Store the new token
        await AsyncStorage.setItem('userToken', newTokenWithBearer);
        await AsyncStorage.setItem('lastLoginTime', Date.now().toString());
        
        console.log('[Token Refresh] Firebase token refresh successful');
        return newTokenWithBearer;
        
      } catch (firebaseError) {
        console.warn('[Token Refresh] Firebase refresh failed, falling back to backend:', firebaseError);
        // Continue to backend refresh fallback below
      }
    } else {
      console.warn('[Token Refresh] No Firebase user, using backend refresh');
    }
    
    // Fallback: Backend token refresh
    console.log('[Token Refresh] Using backend token refresh (fallback method)');
    const response = await fetch(buildUrl(ENDPOINTS.REFRESH_TOKEN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentToken,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Token Refresh] Backend refresh failed:', response.status, errorData);
      
      // Handle specific error cases with proper error types
      if (response.status === 401) {
        const error = createAppError(ERROR_CODES.TOKEN_INVALID, new Error('Current token is invalid and cannot be refreshed'));
        await handleAuthError(error, () => forceLogoutExpiredToken());
        throw error;
      }
      
      const error = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, new Error(errorData.message || 'Token refresh failed'));
      await handleAuthError(error);
      throw error;
    }

    const data = await response.json();
    
    if (data.success && data.token) {
      // Store the new token with Bearer prefix
      const newTokenWithBearer = `Bearer ${data.token}`;
      await AsyncStorage.setItem('userToken', newTokenWithBearer);
      
      console.log('[Token Refresh] Backend token refresh successful');
      
      // Update last login time to track token age
      await AsyncStorage.setItem('lastLoginTime', Date.now().toString());
      
      return newTokenWithBearer;
    } else {
      const error = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, new Error(data.message || 'Token refresh failed - invalid response'));
      await handleAuthError(error);
      throw error;
    }
  } catch (error) {
    console.error('[Token Refresh] Error refreshing auth token:', error);
    
    // If it's already an AppError, re-throw it
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    // Otherwise, wrap it in a proper error
    const appError = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, error as Error);
    await handleAuthError(appError);
    throw appError;
  }
};

// ENHANCED: Token validation function with Firebase integration
export const validateAuthToken = async (): Promise<boolean> => {
  try {
    const currentToken = await AsyncStorage.getItem('userToken');
    
    if (!currentToken) {
      console.log('[Token Validation] No token found - treating as expired (like manual expiry)');
      return false;
    }
    
    // 🔥 ENHANCED: Also check if lastLoginTime exists (like manual expiry does)
    const lastLoginTime = await AsyncStorage.getItem('lastLoginTime');
    if (!lastLoginTime) {
      console.log('[Token Validation] No lastLoginTime found - treating as expired (like manual expiry)');
      return false;
    }

    console.log('[Token Validation] Validating token with Firebase integration...');
    
    // Try Firebase validation first (primary method)
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        console.log('[Token Validation] Using Firebase validation (primary method)');
        await firebaseUser.getIdToken(false); // Don't force refresh, just validate
        console.log('[Token Validation] Firebase validation successful');
        return true;
      } catch (firebaseError) {
        console.warn('[Token Validation] Firebase validation failed, trying backend:', firebaseError);
        // Continue to backend validation fallback below
      }
    } else {
      console.warn('[Token Validation] No Firebase user, using backend validation');
    }
    
    // Fallback: Backend validation
    console.log('[Token Validation] Using backend validation (fallback method)');
    const response = await fetch(buildUrl(ENDPOINTS.VALIDATE_TOKEN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentToken,
      },
    });

    if (!response.ok) {
      console.log(`[Token Validation] Backend validation failed: ${response.status}`);
      
      // Handle specific validation failures
      if (response.status === 401) {
        const error = createAppError(ERROR_CODES.TOKEN_EXPIRED, new Error('Token validation failed - token expired'));
        await ErrorHandler.handleError(error, { showUserMessage: false, logError: true });
      }
      
      return false;
    }

    const data = await response.json();
    console.log('[Token Validation] Backend validation successful:', data.message);
    return data.valid;
  } catch (error) {
    console.error('[Token Validation] Error validating auth token:', error);
    
    // Handle network errors gracefully
    await handleNetworkError(error, async () => {
      await validateAuthToken();
    });
    
    return false;
  }
};

// ENHANCED: Enhanced authenticated fetch with Firebase integration
export const authenticatedFetchWithRefresh = async (endpoint: string, options: RequestInit = {}) => {
  try {
    // Check if token needs refresh before making the request
    const needsRefresh = await shouldRefreshToken();
    if (needsRefresh) {
      console.log('[Auth Fetch] Token appears old, attempting refresh before request...');
      
      // 🔥 NEW: Check keepLoggedIn preference before refresh
      const keepLoggedIn = await getKeepLoggedInPreference();
      if (!keepLoggedIn) {
        console.log('[Auth Fetch] Token expired and keepLoggedIn is false - forcing logout');
        const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Session expired - please log in again'));
        await handleAuthError(error, () => forceLogoutExpiredToken());
        throw error;
      }
      
      try {
        await refreshAuthToken(); // Now uses Firebase-enhanced refresh
        console.log('[Auth Fetch] Proactive token refresh successful');
      } catch (refreshError) {
        console.error('[Auth Fetch] Proactive token refresh failed:', refreshError);
        // Continue with original request - if it fails, we'll try refresh again
      }
    }
    
    // First attempt with current token
    let response = await authenticatedFetch(endpoint, options);
    
    // If token is expired or invalid (401), handle appropriately
    if (response.status === 401) {
      console.log('[Auth Fetch] Received 401 - token appears expired');
      
      // 🔥 NEW: Check keepLoggedIn preference before attempting refresh
      const keepLoggedIn = await getKeepLoggedInPreference();
      if (!keepLoggedIn) {
        console.log('[Auth Fetch] 401 error and keepLoggedIn is false - forcing logout');
        const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Session expired - please log in again'));
        await handleAuthError(error, () => forceLogoutExpiredToken());
        throw error;
      }
      
      // Attempt Firebase-enhanced token refresh before logout
      try {
        console.log('[Auth Fetch] Attempting Firebase-enhanced token refresh...');
        await refreshAuthToken(); // Now uses Firebase-enhanced refresh
        
        console.log('[Auth Fetch] Token refresh successful, retrying original request...');
        
        // Retry the original request with the new token
        response = await authenticatedFetch(endpoint, options);
        
        if (response.status === 401) {
          // If still getting 401 after refresh, the refresh didn't work
          console.log('[Auth Fetch] Still getting 401 after refresh, forcing logout');
          const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Authentication failed after token refresh'));
          await handleAuthError(error, () => forceLogoutExpiredToken());
          throw error;
        }
        
        console.log('[Auth Fetch] Request successful after token refresh');
        return response;
        
      } catch (refreshError) {
        console.error('[Auth Fetch] Token refresh failed:', refreshError);
        
        // If refresh fails, fall back to logout
        console.log('[Auth Fetch] Falling back to logout due to refresh failure');
        const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, refreshError as Error);
        await handleAuthError(error, () => forceLogoutExpiredToken());
        throw error;
      }
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
    console.error('[Auth Fetch] Error:', error);
    
    // Handle network errors with retry
    if (error instanceof TypeError && error.message.includes('fetch')) {
      await handleNetworkError(error, async () => {
        await authenticatedFetchWithRefresh(endpoint, options);
      });
    }
    
    throw error;
  }
};

// NEW: Check if token needs refresh (based on expiry time)
export const shouldRefreshToken = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    const lastLoginTimeStr = await AsyncStorage.getItem('lastLoginTime');
    
    if (!token || !lastLoginTimeStr) {
      console.log('[Should Refresh] No token or login time found');
      return false;
    }

    const lastLoginTime = parseInt(lastLoginTimeStr, 10);
    const now = Date.now();
    const tokenAge = now - lastLoginTime;
    
    // Firebase tokens expire in 1 hour (3600 seconds)
    // Refresh if token is older than 50 minutes (3000 seconds) to be safe
    const fiftyMinutes = 50 * 60 * 1000; // 50 minutes in milliseconds
    
    const needsRefresh = tokenAge > fiftyMinutes;
    
    if (needsRefresh) {
      console.log(`[Should Refresh] Token is ${Math.round(tokenAge / 60000)} minutes old, needs refresh`);
    } else {
      console.log(`[Should Refresh] Token is ${Math.round(tokenAge / 60000)} minutes old, still valid`);
    }
    
    return needsRefresh;
  } catch (error) {
    console.error('[Should Refresh] Error checking if token needs refresh:', error);
    return false;
  }
};

// NEW: Logout function that calls backend
export const performServerLogout = async (): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    
    if (token) {
      // Call backend logout endpoint
      await fetch(buildUrl(ENDPOINTS.LOGOUT), {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
      console.log('Successfully logged out on server');
    }
  } catch (error) {
    console.error('Error during server logout:', error);
    // Don't throw error - continue with local logout even if server logout fails
  }
};

// NEW: Force logout when token is expired - Phase 4A Implementation
export const forceLogoutExpiredToken = async (navigationCallback?: () => void): Promise<void> => {
  try {
    console.log('[Force Logout] Token expired - forcing logout...');
    
    // 🔥 ENHANCED: Use the same approach as manual expiry for consistency
    // Clear the token and lastLoginTime first (like manual expiry does)
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('lastLoginTime');
    console.log('[Force Logout] Token and lastLoginTime cleared (like manual expiry)');
    
    // Then clear all other auth data
    await AsyncStorage.multiRemove([
      'userData', 
      'authData',
      'keepLoggedIn'
    ]);
    
    console.log('[Force Logout] All auth data cleared successfully');
    
    // 🔥 CRITICAL FIX: Notify AuthContext about forced logout
    // This prevents the infinite loop by ensuring AuthContext state is updated
    if (globalAuthContextRef) {
      console.log('[Force Logout] Notifying AuthContext about forced logout');
      globalAuthContextRef.dispatch({ type: 'CLEAR_USER' });
      globalAuthContextRef.dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
    } else {
      console.warn('[Force Logout] No AuthContext reference available');
    }
    
    // Try to navigate to login screen
    if (navigationCallback) {
      console.log('[Force Logout] Using provided navigation callback');
      navigationCallback();
    } else if (globalNavigationRef) {
      console.log('[Force Logout] Using global navigation reference');
      globalNavigationRef.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } else {
      console.log('[Force Logout] No navigation available - auth data cleared, user will need to restart app');
    }
  } catch (error) {
    console.error('[Force Logout] Error during forced logout:', error);
    // Even if there's an error, we should still try to clear what we can
    try {
      await AsyncStorage.clear();
    } catch (clearError) {
      console.error('[Force Logout] Failed to clear storage:', clearError);
    }
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
