import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { 
  getKeepLoggedInPreference, 
  clearAuthData, 
  getStoredAuthData,
  updateLastLoginTime 
} from './authStorage';
import { validateAuthToken, shouldRefreshToken, refreshAuthToken } from './api';
import { validateCurrentToken, scheduleTokenRefresh, clearTokenRefreshTimer } from '../services/tokenValidationService';
// Firebase integration
import { auth } from '../config/firebaseConfig';
import { signOut as firebaseSignOut } from 'firebase/auth';

export class AuthManager {
  private static tokenRefreshTimer: NodeJS.Timeout | null = null;
  private static isTokenRefreshActive = false;
  private static isExportingContact = false; // Flag to track contact export operations

  /**
   * Handle app going to background - ENHANCED FOR FIREBASE INTEGRATION
   * If keepLoggedIn is false, clear authentication data
   */
  static async handleAppBackground(): Promise<void> {
    try {
      console.log('AuthManager: Handling app background - Platform:', Platform.OS);
      
      // Check if we're in the middle of a contact export operation
      if (this.isExportingContact) {
        console.log('AuthManager: Contact export in progress, skipping auto-logout');
        return;
      }
      
      const keepLoggedIn = await getKeepLoggedInPreference();
      console.log('Keep logged in preference:', keepLoggedIn);
      
      if (!keepLoggedIn) {
        console.log('Keep logged in is disabled, clearing auth data on background');
        await this.performAutoLogout();
      } else {
        console.log('Keep logged in is enabled, maintaining session');
        
        // iOS-specific debugging
        if (Platform.OS === 'ios') {
          console.log('iOS: Checking current auth state before background');
          const authData = await getStoredAuthData();
          console.log('iOS: Current auth data:', authData ? 'exists' : 'null');
          const firebaseUser = auth.currentUser;
          console.log('iOS: Firebase user:', firebaseUser ? firebaseUser.uid : 'null');
        }
        
        // Token refresh is now handled by AuthContext Firebase integration
        // We don't need manual timers here anymore
        console.log('AuthManager: Session maintained by AuthContext Firebase integration');
      }
    } catch (error) {
      console.error('Error handling app background:', error);
    }
  }

  /**
   * Handle app coming to foreground - ENHANCED FOR FIREBASE INTEGRATION
   * Check auth status and let AuthContext handle token refresh
   */
  static async handleAppForeground(): Promise<void> {
    try {
      console.log('AuthManager: Handling app foreground - Platform:', Platform.OS);
      
      // Reset export flag when app comes back to foreground
      this.isExportingContact = false;
      console.log('AuthManager: Reset contact export flag on foreground');
      
      const keepLoggedIn = await getKeepLoggedInPreference();
      console.log('Keep logged in preference:', keepLoggedIn);
      
      if (keepLoggedIn) {
        console.log('Keep logged in is enabled');
        
        // iOS-specific debugging
        if (Platform.OS === 'ios') {
          console.log('iOS: Checking auth state after foreground');
          const authData = await getStoredAuthData();
          console.log('iOS: Stored auth data after foreground:', authData ? 'exists' : 'null');
          if (authData) {
            console.log('iOS: Stored token exists:', authData.userToken ? 'yes' : 'no');
            console.log('iOS: Stored keepLoggedIn:', authData.keepLoggedIn);
          }
        }
        
        // Check if Firebase user is still authenticated
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          console.log('Firebase user is still authenticated:', firebaseUser.uid);
          // AuthContext Firebase listener will handle token refresh automatically
          // Just ensure token refresh service is active
          console.log('AuthManager: Ensuring token refresh service is active');
          scheduleTokenRefresh();
          
          // Update last activity time
          await updateLastLoginTime();
        } else {
          console.log('No Firebase user found, performing auto logout');
          await this.performAutoLogout();
        }
      } else {
        console.log('Keep logged in is disabled, no validation needed');
        // Ensure token refresh service is stopped
        clearTokenRefreshTimer();
      }
    } catch (error) {
      console.error('Error handling app foreground:', error);
    }
  }

  /**
   * Perform auto-logout when session should not be maintained
   */
  static async performAutoLogout(): Promise<void> {
    try {
      console.log('AuthManager: Performing auto-logout');
      
      // Stop token refresh service immediately
      clearTokenRefreshTimer();
      
      // Sign out from Firebase
      try {
        await firebaseSignOut(auth);
        console.log('AuthManager: Firebase signout successful');
      } catch (firebaseError) {
        console.error('AuthManager: Firebase signout error:', firebaseError);
        // Continue with local logout even if Firebase signout fails
      }
      
      // Clear local auth data
      await clearAuthData();
      
      console.log('AuthManager: Auto-logout completed');
    } catch (error) {
      console.error('AuthManager: Error during auto-logout:', error);
      // Ensure token refresh is stopped even on error
      clearTokenRefreshTimer();
    }
  }

  /**
   * Check current authentication status - ENHANCED FOR FIREBASE
   */
  static async validateTokenOnResume(): Promise<boolean> {
    try {
      console.log('AuthManager: Validating token on resume');
      
      // Check Firebase auth state first
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.log('AuthManager: No Firebase user, token invalid');
        return false;
      }
      
      // Check stored auth data
      const authData = await getStoredAuthData();
      if (!authData) {
        console.log('AuthManager: No stored auth data, token invalid');
        return false;
      }
      
      // With Firebase, if user exists and we have stored data, token should be valid
      // AuthContext will handle automatic token refresh
      console.log('AuthManager: Token validation successful with Firebase integration');
      return true;
    } catch (error) {
      console.error('AuthManager: Error validating token on resume:', error);
      return false;
    }
  }

  /**
   * Setup token refresh timer - DEPRECATED
   * @deprecated Use AuthContext Firebase integration instead
   */
  static setupTokenRefreshTimer(): void {
    console.warn('AuthManager.setupTokenRefreshTimer() is deprecated. Token refresh is now handled by AuthContext Firebase integration.');
    // This method is kept for backward compatibility but does nothing
    // Token refresh is now handled by AuthContext
  }

  /**
   * Clear token refresh timer - UPDATED FOR NEW INTEGRATION
   */
  static clearTokenRefreshTimer(): void {
    console.log('AuthManager: Clearing token refresh timer');
    
    // Clear local timer if it exists (legacy)
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    
    // Clear the service-level timer
    clearTokenRefreshTimer();
    
    this.isTokenRefreshActive = false;
    console.log('AuthManager: Token refresh timer cleared');
  }

  /**
   * Initialize AuthManager - ENHANCED FOR FIREBASE INTEGRATION
   */
  static async initialize(): Promise<void> {
    try {
      console.log('AuthManager: Initializing with Firebase integration');
      
      const keepLoggedIn = await getKeepLoggedInPreference();
      console.log('AuthManager: Keep logged in preference:', keepLoggedIn);
      
      if (keepLoggedIn) {
        // Check if Firebase user exists
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          console.log('AuthManager: Firebase user found during initialization:', firebaseUser.uid);
          // AuthContext Firebase listener will handle token refresh
          console.log('AuthManager: Token refresh handled by AuthContext');
        } else {
          console.log('AuthManager: No Firebase user found, waiting for auth state');
        }
      } else {
        // Ensure token refresh is stopped if keepLoggedIn is false
        clearTokenRefreshTimer();
      }
      
      console.log('AuthManager initialized successfully with Firebase integration');
    } catch (error) {
      console.error('Error initializing AuthManager:', error);
    }
  }

  /**
   * Clean up AuthManager resources
   */
  static cleanup(): Promise<void> {
    return new Promise((resolve) => {
      console.log('AuthManager: Cleaning up resources');
      this.clearTokenRefreshTimer();
      this.isTokenRefreshActive = false;
      resolve();
    });
  }

  /**
   * Get current authentication status - ENHANCED FOR FIREBASE
   */
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    keepLoggedIn: boolean;
    tokenValid: boolean;
    firebaseUser: boolean;
  }> {
    try {
      const authData = await getStoredAuthData();
      const keepLoggedIn = await getKeepLoggedInPreference();
      const firebaseUser = !!auth.currentUser;
      
      // With Firebase, if user exists, token is automatically valid
      const tokenValid = firebaseUser;
      
      return {
        isAuthenticated: !!authData && firebaseUser,
        keepLoggedIn,
        tokenValid,
        firebaseUser,
      };
    } catch (error) {
      console.error('Error getting auth status:', error);
      return {
        isAuthenticated: false,
        keepLoggedIn: false,
        tokenValid: false,
        firebaseUser: false,
      };
    }
  }

  /**
   * Set the contact export flag to prevent auto-logout during export
   */
  static setContactExporting(exporting: boolean): void {
    this.isExportingContact = exporting;
    console.log('AuthManager: Contact export flag set to:', exporting);
  }

  /**
   * Check if contact export is in progress
   */
  static isContactExportInProgress(): boolean {
    return this.isExportingContact;
  }
} 