import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateAuthToken, shouldRefreshToken, refreshAuthToken } from '../utils/api';
import { getStoredAuthData, updateLastLoginTime } from '../utils/authStorage';
// Firebase integration
import { auth } from '../config/firebaseConfig';

export class TokenValidationService {
  private static refreshTimer: NodeJS.Timeout | null = null;
  private static isServiceActive = false;

  /**
   * Validate the current token - ENHANCED FOR FIREBASE INTEGRATION
   */
  static async validateCurrentToken(): Promise<boolean> {
    try {
      console.log('TokenValidationService: Validating current token with Firebase integration');
      
      // 🔥 ENHANCEMENT: Wait a bit for Firebase to restore auth state during app reload
      let firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.log('TokenValidationService: No Firebase user found, waiting for auth state restoration...');
        // Wait up to 2 seconds for Firebase to restore auth state
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          firebaseUser = auth.currentUser;
          if (firebaseUser) {
            console.log('TokenValidationService: Firebase user found after waiting');
            break;
          }
        }
        
        if (!firebaseUser) {
          console.log('TokenValidationService: No Firebase user found after waiting');
          
          // 🔥 CRITICAL FIX: Try backend validation as fallback when no Firebase user
          console.log('TokenValidationService: Attempting backend validation as fallback');
          try {
            const isValid = await validateAuthToken();
            console.log('TokenValidationService: Backend validation result:', isValid);
            return isValid;
          } catch (backendError) {
            console.error('TokenValidationService: Backend validation failed:', backendError);
            return false;
          }
        }
      }
      
      // Check if we have stored token
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('TokenValidationService: No stored token found');
        return false;
      }

      // With Firebase integration, try to get a fresh token to validate
      try {
        const freshToken = await firebaseUser.getIdToken(false); // Don't force refresh
        if (freshToken) {
          console.log('TokenValidationService: Firebase token validation successful');
          return true;
        }
      } catch (firebaseError) {
        console.error('TokenValidationService: Firebase token validation failed:', firebaseError);
        
        // Try backend validation as fallback
        console.log('TokenValidationService: Falling back to backend validation');
        const isValid = await validateAuthToken();
        console.log('TokenValidationService: Backend validation result:', isValid);
        return isValid;
      }
      
      return false;
    } catch (error) {
      console.error('TokenValidationService: Error validating current token:', error);
      return false;
    }
  }

  /**
   * Check if token needs refresh and refresh if necessary - ENHANCED FOR FIREBASE
   */
  static async refreshTokenIfNeeded(): Promise<void> {
    try {
      console.log('TokenValidationService: Checking if token needs refresh (Firebase-enhanced)');
      
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.log('TokenValidationService: No Firebase user for token refresh');
        throw new Error('No Firebase user available for token refresh');
      }
      
      // Check if token needs refresh using our existing logic
      const needsRefresh = await shouldRefreshToken();
      console.log('TokenValidationService: Token needs refresh:', needsRefresh);
      
      if (needsRefresh) {
        console.log('TokenValidationService: Refreshing token via Firebase...');
        
        try {
          // Try Firebase token refresh first
          const newToken = await firebaseUser.getIdToken(true); // Force refresh
          console.log('TokenValidationService: Firebase token refreshed successfully');
          
          // Update stored token
          await AsyncStorage.setItem('userToken', `Bearer ${newToken}`);
          await updateLastLoginTime();
          
          console.log('TokenValidationService: Token updated in storage');
        } catch (firebaseError) {
          console.error('TokenValidationService: Firebase refresh failed, trying backend:', firebaseError);
          
          // Fallback to backend refresh
          const newToken = await refreshAuthToken();
          console.log('TokenValidationService: Backend token refresh successful');
          
          // Update last login time after successful refresh
          await updateLastLoginTime();
        }
      } else {
        console.log('TokenValidationService: Token refresh not needed');
      }
    } catch (error) {
      console.error('TokenValidationService: Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic token refresh - ENHANCED FOR FIREBASE INTEGRATION
   */
  static scheduleTokenRefresh(): void {
    try {
      if (this.isServiceActive) {
        console.log('TokenValidationService: Token refresh already scheduled, skipping');
        return;
      }

      console.log('TokenValidationService: Scheduling Firebase-enhanced token refresh');
      this.isServiceActive = true;
      
      // Schedule immediate check
      this.performTokenCheck();
      
      // Schedule periodic checks every 25 minutes
      // (Firebase tokens expire in 1 hour, so we refresh at 25min to be safe)
      this.refreshTimer = setInterval(() => {
        this.performTokenCheck();
      }, 25 * 60 * 1000); // 25 minutes

      console.log('TokenValidationService: Token refresh scheduled successfully');
    } catch (error) {
      console.error('TokenValidationService: Error scheduling token refresh:', error);
      this.isServiceActive = false;
    }
  }

  /**
   * Clear token refresh schedule
   */
  static clearTokenRefreshTimer(): void {
    console.log('TokenValidationService: Clearing token refresh timer');
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.isServiceActive = false;
    console.log('TokenValidationService: Token refresh timer cleared');
  }

  /**
   * Perform token check and refresh if needed - ENHANCED FOR FIREBASE
   */
  private static async performTokenCheck(): Promise<void> {
    try {
      console.log('TokenValidationService: Performing Firebase-enhanced token check');
      
      // Check if we still have auth data and Firebase user
      const authData = await getStoredAuthData();
      const firebaseUser = auth.currentUser;
      
      if (!authData || !firebaseUser) {
        console.log('TokenValidationService: No auth data or Firebase user, stopping token refresh');
        this.clearTokenRefreshTimer();
        return;
      }

      // Validate current token
      const isValid = await this.validateCurrentToken();
      if (!isValid) {
        console.log('TokenValidationService: Token is invalid, attempting refresh');
        await this.refreshTokenIfNeeded();
      } else {
        console.log('TokenValidationService: Token is still valid');
      }
    } catch (error) {
      console.error('TokenValidationService: Error during token check:', error);
      // Don't clear the timer on single failures, allow retry
    }
  }

  /**
   * Get token expiration info - ENHANCED FOR FIREBASE
   */
  static async getTokenExpirationInfo(): Promise<{
    hasToken: boolean;
    isExpired: boolean;
    hasFirebaseUser: boolean;
    expiresAt?: number;
    lastRefresh?: number;
  }> {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const authData = await getStoredAuthData();
      const firebaseUser = auth.currentUser;
      
      if (!token) {
        return {
          hasToken: false,
          isExpired: true,
          hasFirebaseUser: !!firebaseUser,
        };
      }

      const needsRefresh = await shouldRefreshToken();
      
      return {
        hasToken: true,
        isExpired: needsRefresh,
        hasFirebaseUser: !!firebaseUser,
        lastRefresh: authData?.lastLoginTime ?? undefined,
      };
    } catch (error) {
      console.error('TokenValidationService: Error getting token expiration info:', error);
      return {
        hasToken: false,
        isExpired: true,
        hasFirebaseUser: false,
      };
    }
  }

  /**
   * Force token validation (useful for testing) - ENHANCED FOR FIREBASE
   */
  static async forceTokenValidation(): Promise<{
    isValid: boolean;
    firebaseValid?: boolean;
    backendValid?: boolean;
    error?: string;
  }> {
    try {
      console.log('TokenValidationService: Force validating token with Firebase');
      
      const firebaseUser = auth.currentUser;
      let firebaseValid = false;
      let backendValid = false;
      
      // Test Firebase validation
      if (firebaseUser) {
        try {
          await firebaseUser.getIdToken(false);
          firebaseValid = true;
        } catch (firebaseError) {
          console.error('TokenValidationService: Firebase validation failed:', firebaseError);
        }
      }
      
      // Test backend validation
      try {
        backendValid = await validateAuthToken();
      } catch (backendError) {
        console.error('TokenValidationService: Backend validation failed:', backendError);
      }
      
      const isValid = firebaseValid || backendValid;
      
      return {
        isValid,
        firebaseValid,
        backendValid,
      };
    } catch (error) {
      console.error('TokenValidationService: Error during force token validation:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Force token refresh (useful for testing) - ENHANCED FOR FIREBASE
   */
  static async forceTokenRefresh(): Promise<{
    success: boolean;
    method?: string;
    error?: string;
  }> {
    try {
      console.log('TokenValidationService: Force refreshing token with Firebase');
      
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        try {
          // Try Firebase refresh first
          const newToken = await firebaseUser.getIdToken(true);
          await AsyncStorage.setItem('userToken', `Bearer ${newToken}`);
          await updateLastLoginTime();
          
          return {
            success: true,
            method: 'firebase',
          };
        } catch (firebaseError) {
          console.error('TokenValidationService: Firebase force refresh failed:', firebaseError);
          
          // Fallback to backend refresh
          await this.refreshTokenIfNeeded();
          return {
            success: true,
            method: 'backend',
          };
        }
      } else {
        // No Firebase user, try backend only
        await this.refreshTokenIfNeeded();
        return {
          success: true,
          method: 'backend',
        };
      }
    } catch (error) {
      console.error('TokenValidationService: Error during force token refresh:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if service is currently active
   */
  static isActive(): boolean {
    return this.isServiceActive;
  }

  /**
   * Get service status for debugging
   */
  static getServiceStatus(): {
    isActive: boolean;
    hasTimer: boolean;
    firebaseUser: boolean;
  } {
    return {
      isActive: this.isServiceActive,
      hasTimer: !!this.refreshTimer,
      firebaseUser: !!auth.currentUser,
    };
  }
}

// Export individual functions for easier imports
export const validateCurrentToken = TokenValidationService.validateCurrentToken.bind(TokenValidationService);
export const refreshTokenIfNeeded = TokenValidationService.refreshTokenIfNeeded.bind(TokenValidationService);
export const scheduleTokenRefresh = TokenValidationService.scheduleTokenRefresh.bind(TokenValidationService);
export const clearTokenRefreshTimer = TokenValidationService.clearTokenRefreshTimer.bind(TokenValidationService);
export const getTokenExpirationInfo = TokenValidationService.getTokenExpirationInfo.bind(TokenValidationService);
export const forceTokenValidation = TokenValidationService.forceTokenValidation.bind(TokenValidationService);
export const forceTokenRefresh = TokenValidationService.forceTokenRefresh.bind(TokenValidationService); 