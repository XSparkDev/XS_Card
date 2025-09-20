import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  getStoredAuthData, 
  storeAuthData, 
  clearAuthData, 
  getKeepLoggedInPreference,
  setKeepLoggedInPreference,
  updateLastLoginTime,
  AuthData
} from '../utils/authStorage';
import { ErrorHandler, ERROR_CODES, handleAuthError, handleStorageError, createAppError } from '../utils/errorHandler';
// Firebase integration
import { auth } from '../config/firebaseConfig';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
// API utilities for data recovery
import { buildUrl, ENDPOINTS, setGlobalAuthContextRef } from '../utils/api';

// User interface
export interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  plan?: string;
  [key: string]: any;
}

// Authentication state interface
interface AuthState {
  user: User | null;
  userToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean; // Track email verification status
  keepLoggedIn: boolean;
  lastLoginTime: number | null;
  error: string | null;
  firebaseReady: boolean; // Track when Firebase auth state is ready
}

// Authentication context interface
interface AuthContextType extends AuthState {
  login: (email: string, password: string, keepLoggedIn: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setKeepLoggedIn: (value: boolean) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  resendVerificationEmail: () => Promise<void>; // Resend email verification
}

// Action types for the reducer
type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: { user: User; token: string; keepLoggedIn: boolean; lastLoginTime: number; isEmailVerified: boolean } }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_KEEP_LOGGED_IN'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORE_AUTH'; payload: AuthData }
  | { type: 'SET_FIREBASE_READY'; payload: boolean }
  | { type: 'SET_EMAIL_VERIFIED'; payload: boolean };

// Initial state
const initialState: AuthState = {
  user: null,
  userToken: null,
  isLoading: true, // Start with loading true while we check stored auth
  isAuthenticated: false,
  isEmailVerified: false, // Default to false for security
  keepLoggedIn: false,
  lastLoginTime: null,
  error: null,
  firebaseReady: false, // Firebase auth state not ready initially
};

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload.user,
        userToken: action.payload.token,
        isAuthenticated: action.payload.isEmailVerified, // Only authenticated if email verified
        isEmailVerified: action.payload.isEmailVerified,
        keepLoggedIn: action.payload.keepLoggedIn,
        lastLoginTime: action.payload.lastLoginTime,
        isLoading: false,
        error: null,
      };
    
    case 'CLEAR_USER':
      return {
        ...state,
        user: null,
        userToken: null,
        isAuthenticated: false,
        isEmailVerified: false,
        lastLoginTime: null,
        isLoading: false,
        error: null,
        // Note: keepLoggedIn preference is preserved
      };
    
    case 'SET_KEEP_LOGGED_IN':
      return {
        ...state,
        keepLoggedIn: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    
    case 'RESTORE_AUTH':
      return {
        ...state,
        user: action.payload.userData,
        userToken: action.payload.userToken,
        isAuthenticated: !!(action.payload.userToken && action.payload.userData),
        isEmailVerified: false, // Will be updated by Firebase auth state listener
        keepLoggedIn: action.payload.keepLoggedIn,
        lastLoginTime: action.payload.lastLoginTime,
        isLoading: false,
        error: null,
      };
    
    case 'SET_FIREBASE_READY':
      return {
        ...state,
        firebaseReady: action.payload,
      };
    
    case 'SET_EMAIL_VERIFIED':
      return {
        ...state,
        isEmailVerified: action.payload,
        isAuthenticated: action.payload && !!state.user, // Update auth status based on verification
      };
    
    default:
      return state;
  }
};

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set up global reference for forced logout notifications
  useEffect(() => {
    setGlobalAuthContextRef({ dispatch });
  }, []);

  // Firebase Auth State Listener - NEW INTEGRATION
  useEffect(() => {
    console.log('AuthProvider: Setting up Firebase auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      // Mark Firebase as ready once the listener fires (regardless of user state)
      dispatch({ type: 'SET_FIREBASE_READY', payload: true });
      console.log('AuthProvider: Firebase auth state ready, user:', !!firebaseUser);
      try {
        console.log('Firebase auth state changed:', !!firebaseUser);
        
        if (firebaseUser) {
          console.log('Firebase user authenticated:', firebaseUser.uid);
          
          // 🔥 CRITICAL: Check email verification FIRST
          if (!firebaseUser.emailVerified) {
            console.log('AuthProvider: Email not verified, blocking authentication');
            
            // Clear any existing auth data
            await clearAuthData();
            dispatch({ type: 'CLEAR_USER' });
            dispatch({ type: 'SET_EMAIL_VERIFIED', payload: false });
            
            // Set error for unverified email
            dispatch({ type: 'SET_ERROR', payload: 'Email not verified. Please check your inbox and verify your email address.' });
            return; // Block authentication
          }
          
          console.log('AuthProvider: Email verified, proceeding with authentication');
          
          // Get fresh token from Firebase
          const token = await firebaseUser.getIdToken();
          console.log('Firebase token refreshed automatically');
          
          // Check if we have stored auth data
          const storedAuthData = await getStoredAuthData();
          
          if (storedAuthData && storedAuthData.userData) {
            // ✅ HAPPY PATH: Both Firebase user AND stored data exist
            // Update token in storage with fresh Firebase token
            await storeAuthData({
              ...storedAuthData,
              userToken: `Bearer ${token}`,
              lastLoginTime: Date.now()
            });
            
            // Update context state
            dispatch({
              type: 'SET_USER',
              payload: {
                user: storedAuthData.userData,
                token: `Bearer ${token}`,
                keepLoggedIn: storedAuthData.keepLoggedIn,
                lastLoginTime: Date.now(),
                isEmailVerified: true // Email is verified since we passed the check above
              }
            });
            
            console.log('AuthProvider: Firebase token updated in context and storage');
          } else {
            // 🔥 FIX: Firebase user exists but no stored data - DATA INCONSISTENCY
            console.warn('AuthProvider: Firebase user authenticated but no stored user data - attempting to recover');
            
            try {
              // Try to re-fetch user data from backend using Firebase token
              const response = await fetch(buildUrl(ENDPOINTS.GET_USER), {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                const data = await response.json();
                console.log('AuthProvider: Successfully recovered user data from backend');
                
                // 🔥 FIX: Improved user data structure handling
                let userData;
                
                if (data.user) {
                  // Backend returned user object in data.user
                  userData = {
                    ...data.user,
                    id: data.user.uid || data.user.id || firebaseUser.uid,
                    uid: data.user.uid || data.user.id || firebaseUser.uid,
                    name: data.user.name || data.user.displayName || '',
                    email: data.user.email || firebaseUser.email || ''
                  };
                } else {
                  // Backend returned user data directly or use Firebase user as fallback
                  userData = {
                    id: firebaseUser.uid,
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName || data.name || '',
                    email: firebaseUser.email || data.email || '',
                    plan: data.plan || 'free'
                  };
                }

                // Get keepLoggedIn preference (should still exist)
                const keepLoggedIn = await getKeepLoggedInPreference();
                
                // Store the recovered data
                await storeAuthData({
                  userToken: `Bearer ${token}`,
                  userData: userData,
                  userRole: userData.plan === 'admin' ? 'admin' : 'user',
                  keepLoggedIn,
                  lastLoginTime: Date.now(),
                });

                // Update context state with recovered data
                dispatch({
                  type: 'SET_USER',
                  payload: {
                    user: userData,
                    token: `Bearer ${token}`,
                    keepLoggedIn,
                    lastLoginTime: Date.now(),
                    isEmailVerified: true // Email is verified since we passed the check above
                  }
                });
                
                console.log('AuthProvider: Data recovery successful - user re-authenticated');
              } else {
                console.error('AuthProvider: Backend user recovery failed with status:', response.status);
                throw new Error(`Backend responded with ${response.status}`);
              }
            } catch (recoveryError) {
              console.error('AuthProvider: Failed to recover user data from backend:', recoveryError);
              console.log('AuthProvider: Forcing logout due to data inconsistency');
              
              // If we can't recover data, force logout to maintain consistency
              try {
                await firebaseSignOut(auth);
              } catch (signOutError) {
                console.error('AuthProvider: Error signing out of Firebase:', signOutError);
              }
              
              await clearAuthData();
              dispatch({ type: 'CLEAR_USER' });
              dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
            }
          }
        } else {
          console.log('Firebase user signed out');
          
          // Check if this was an intentional logout
          const keepLoggedIn = await getKeepLoggedInPreference();
          if (!keepLoggedIn) {
            console.log('AuthProvider: Firebase signout detected with keepLoggedIn=false');
            // Clear local auth data if user doesn't want to stay logged in
            await clearAuthData();
            dispatch({ type: 'CLEAR_USER' });
          } else {
            // 🔥 CRITICAL FIX: Firebase user signed out but keepLoggedIn is true
            // This means we have stored data but Firebase lost the user
            console.log('AuthProvider: Firebase signout detected with keepLoggedIn=true - attempting to restore');
            
            // Check if we have stored auth data
            const storedAuthData = await getStoredAuthData();
            if (storedAuthData && storedAuthData.userToken) {
              console.log('AuthProvider: Found stored auth data, attempting to restore Firebase user');
              
              try {
                // Try to restore Firebase user using stored token
                // Note: We can't directly sign in with token, but we can validate it
                const token = storedAuthData.userToken.replace('Bearer ', '');
                
                // For now, we'll keep the stored data and let the token validation handle it
                // The SplashScreen will validate the token and handle the result
                console.log('AuthProvider: Keeping stored auth data for token validation');
                
                // Don't clear the user - let the validation process handle it
                // This allows the SplashScreen to attempt token validation
              } catch (restoreError) {
                console.error('AuthProvider: Failed to restore Firebase user:', restoreError);
                // If we can't restore, clear the data to maintain consistency
                await clearAuthData();
                dispatch({ type: 'CLEAR_USER' });
                dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
              }
            } else {
              console.log('AuthProvider: No stored auth data found, clearing state');
              await clearAuthData();
              dispatch({ type: 'CLEAR_USER' });
              dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
            }
          }
        }
      } catch (error) {
        console.error('AuthProvider: Error in Firebase auth state listener:', error);
        // Don't throw error here - let the app continue functioning
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up Firebase auth state listener');
      unsubscribe();
    };
  }, []);

  // Restore authentication state on app start - ENHANCED
  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        console.log('AuthProvider: Restoring auth state from storage');
        
        // First, always load the keepLoggedIn preference
        const keepLoggedIn = await getKeepLoggedInPreference();
        console.log('AuthProvider: Loaded keepLoggedIn preference:', keepLoggedIn);
        dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: keepLoggedIn });
        
        // Then check for stored auth data
        const authData = await getStoredAuthData();
        
        if (authData) {
          console.log('AuthProvider: Found stored auth data');
          console.log('AuthProvider: Stored keepLoggedIn:', authData.keepLoggedIn);
          console.log('AuthProvider: Loaded keepLoggedIn preference:', keepLoggedIn);
          
          // Use the preference from storage (authData.keepLoggedIn) as it's more reliable
          const finalKeepLoggedIn = authData.keepLoggedIn !== undefined ? authData.keepLoggedIn : keepLoggedIn;
          console.log('AuthProvider: Final keepLoggedIn value:', finalKeepLoggedIn);
          
          dispatch({ type: 'RESTORE_AUTH', payload: { ...authData, keepLoggedIn: finalKeepLoggedIn } });
          
          // Firebase auth state listener will handle token refresh automatically
        } else {
          console.log('AuthProvider: No stored auth data found');
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('AuthProvider: Error restoring auth state:', error);
        
        // Handle storage errors gracefully
        await handleStorageError(error);
        
        dispatch({ type: 'SET_ERROR', payload: 'Failed to restore authentication state' });
      }
    };

    restoreAuthState();
  }, []);

  // Login function - ENHANCED for Firebase
  const login = async (email: string, password: string, keepLoggedIn: boolean): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      console.log('AuthProvider: Starting Firebase-enhanced login process');
      
      // Note: The actual Firebase authentication will be handled in SignInScreen
      // This function will be called after successful Firebase authentication
      // to update the context state with user data from backend
      
      // For now, this maintains backward compatibility
      const error = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, new Error('Login implementation updated to use Firebase client SDK in SignInScreen'));
      await handleAuthError(error);
      throw error;
      
    } catch (error) {
      // Handle authentication errors with proper error handling
      if (error && typeof error === 'object' && 'code' in error) {
        // Already an AppError, just update UI state
        dispatch({ type: 'SET_ERROR', payload: (error as any).userMessage });
      } else {
        // Convert to AppError and handle
        const appError = createAppError(ERROR_CODES.AUTHENTICATION_FAILED, error as Error);
        await handleAuthError(appError);
        dispatch({ type: 'SET_ERROR', payload: appError.userMessage });
      }
      throw error;
    }
  };

  // Logout function - ENHANCED for Firebase
  const logout = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      console.log('AuthProvider: Starting Firebase-enhanced logout process');
      
      // Sign out from Firebase first
      try {
        await firebaseSignOut(auth);
        console.log('AuthProvider: Firebase signout successful');
      } catch (firebaseError) {
        console.error('AuthProvider: Firebase signout error:', firebaseError);
        // Continue with local logout even if Firebase signout fails
      }
      
      // Clear auth data from storage
      await clearAuthData();
      
      // Update state
      dispatch({ type: 'CLEAR_USER' });
      
      // Get the keepLoggedIn preference (which was cleared) and restore it to false
      dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
      
      console.log('AuthProvider: Logout complete');
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Handle storage errors during logout
      await handleStorageError(error);
      
      dispatch({ type: 'SET_ERROR', payload: 'Failed to logout' });
      throw error;
    }
  };

  // Refresh token function - ENHANCED with Firebase
  const refreshToken = async (): Promise<void> => {
    try {
      console.log('AuthProvider: Firebase-enhanced token refresh');
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Force token refresh from Firebase
        const newToken = await currentUser.getIdToken(true);
        console.log('AuthProvider: Firebase token force-refreshed');
        
        // Update stored token
        const authData = await getStoredAuthData();
        if (authData) {
          await storeAuthData({
            ...authData,
            userToken: `Bearer ${newToken}`,
            lastLoginTime: Date.now()
          });
          console.log('AuthProvider: Refreshed token stored');
        }
      } else {
        console.log('AuthProvider: No Firebase user for token refresh');
        throw new Error('No authenticated user for token refresh');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Handle token refresh errors
      const appError = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, error as Error);
      await handleAuthError(appError);
      
      dispatch({ type: 'SET_ERROR', payload: appError.userMessage });
      throw error;
    }
  };

  // Resend verification email function
  const resendVerificationEmail = async (): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      // Use Firebase's built-in resend verification
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(currentUser);
      console.log('AuthProvider: Verification email sent');
      
      // Clear any existing errors
      dispatch({ type: 'CLEAR_ERROR' });
      
    } catch (error) {
      console.error('Error sending verification email:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send verification email. Please try again.' });
      throw error;
    }
  };

  // Set keep logged in preference
  const setKeepLoggedIn = (value: boolean): void => {
    dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: value });
    
    // Also update in storage with error handling
    setKeepLoggedInPreference(value).catch(async (error) => {
      console.error('Error saving keep logged in preference:', error);
      await handleStorageError(error);
    });
  };

  // Clear error
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Set loading state
  const setLoading = (loading: boolean): void => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  // Context value
  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    setKeepLoggedIn,
    clearError,
    setLoading,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to manually set user data (for Phase 3 integration)
export const setAuthUser = async (user: User, token: string, keepLoggedIn: boolean): Promise<void> => {
  const now = Date.now();
  
  // Store in AsyncStorage
  await storeAuthData({
    userToken: token,
    userData: user,
    userRole: user.plan === 'admin' ? 'admin' : 'user',
    keepLoggedIn,
    lastLoginTime: now,
  });
  
  // Update last login time
  await updateLastLoginTime();
};

export default AuthContext;



export default AuthContext; 
