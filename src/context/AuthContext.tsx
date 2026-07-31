import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  getStoredAuthData,
  storeAuthData,
  clearAuthData,
  getKeepLoggedInPreference,
  setKeepLoggedInPreference,
  AuthData
} from '../utils/authStorage';
import { handleAuthError, handleStorageError, createAppError, ERROR_CODES } from '../utils/errorHandler';
// Firebase integration
import { auth } from '../config/firebaseConfig';
import { onIdTokenChanged, User as FirebaseUser, sendEmailVerification } from 'firebase/auth';
// Single source of truth for token refresh, error classification, and sign-out.
import { authLog, ensureFreshIdToken, endSession } from '../services/authSessionService';
// API utilities for data recovery
import { ENDPOINTS, setGlobalAuthContextRef, authenticatedFetchWithRefresh } from '../utils/api';
import { planIsPremium } from '../utils/userPlan';
import { AppState } from 'react-native';

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
  // True until the user's premium plan has been definitively resolved from the
  // backend (the single source of truth). Gates must not evaluate premium
  // status while this is true, to avoid showing the wrong UI during the fetch.
  isLoadingUserStatus: boolean;
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
  updateUserPlan: (plan: string) => void; // Refresh in-memory user.plan from backend sync
  // Derived, canonical premium gate (fail-closed). Prefer this over reading
  // user.plan directly. Only meaningful once isLoadingUserStatus === false.
  isFreeUser: boolean;
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
  | { type: 'SET_EMAIL_VERIFIED'; payload: boolean }
  | { type: 'UPDATE_USER_PLAN'; payload: { plan: string } }
  | { type: 'SET_USER_STATUS_LOADING'; payload: boolean };

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
  isLoadingUserStatus: true, // Premium plan not yet resolved from backend
};

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_USER_STATUS_LOADING':
      if (state.isLoadingUserStatus === action.payload) return state;
      return { ...state, isLoadingUserStatus: action.payload };

    case 'UPDATE_USER_PLAN':
      // Keep the in-memory user.plan in sync with the backend plan that other
      // parts of the app (Header sync, UnlockPremium) fetch. Guard against
      // no-op dispatches so this can be safely called on every screen focus.
      if (!state.user || state.user.plan === action.payload.plan) {
        return state;
      }
      return {
        ...state,
        user: { ...state.user, plan: action.payload.plan },
      };

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
      // Populate the UI with cached data immediately (avoids flash on fast
      // warm starts and lets offline users see their profile), but never set
      // isAuthenticated here — Firebase is the only authority for that.
      // isLoading stays true until onIdTokenChanged settles and dispatches
      // SET_USER or CLEAR_USER, which is when the splash is allowed to exit.
      return {
        ...state,
        user: action.payload.userData,
        userToken: action.payload.userToken,
        isAuthenticated: false,
        isEmailVerified: false,
        keepLoggedIn: action.payload.keepLoggedIn,
        lastLoginTime: action.payload.lastLoginTime,
        isLoading: true,
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

// ── Profile recovery ────────────────────────────────────────────────────────
// Called when Firebase has a valid session but AsyncStorage has no cached
// profile (first install on new device, storage cleared externally, etc.).
// Uses authenticatedFetchWithRefresh so the token is always fresh and retried
// on failure. Hard 8-second timeout ensures the splash never hangs forever.
// On any failure: dispatches CLEAR_USER so the splash exits to SignIn cleanly;
// the Firebase session stays intact and the next launch retries automatically.
async function recoverUserProfile(
  firebaseUser: FirebaseUser,
  token: string,
  dispatch: React.Dispatch<AuthAction>,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_USER, {
      method: 'GET',
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const userData = data.user
        ? {
            ...data.user,
            id: data.user.uid || data.user.id || firebaseUser.uid,
            uid: data.user.uid || data.user.id || firebaseUser.uid,
            name: data.user.name || data.user.displayName || '',
            email: data.user.email || firebaseUser.email || '',
          }
        : {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || data.name || '',
            email: firebaseUser.email || data.email || '',
            plan: data.plan || 'free',
          };

      const keepLoggedIn = await getKeepLoggedInPreference();

      await storeAuthData({
        userToken: `Bearer ${token}`,
        userData,
        userRole: userData.plan === 'admin' ? 'admin' : 'user',
        keepLoggedIn,
        lastLoginTime: Date.now(),
      });

      dispatch({
        type: 'SET_USER',
        payload: {
          user: userData,
          token: `Bearer ${token}`,
          keepLoggedIn,
          lastLoginTime: Date.now(),
          isEmailVerified: true,
        },
      });
    } else if (response.status === 401 || response.status === 403 || response.status === 404) {
      // Backend explicitly rejected this user — genuine, unrecoverable failure.
      authLog('session_invalidated', { reason: `profile_recovery_${response.status}` });
      await endSession(`profile_recovery_${response.status}`);
      dispatch({ type: 'CLEAR_USER' });
      dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
    } else {
      // 5xx or unexpected — transient. Clear user so splash exits to SignIn;
      // the Firebase session is intact and the next launch will retry.
      authLog('profile_recovery_failed', { status: response.status });
      dispatch({ type: 'CLEAR_USER' });
    }
  } catch (error) {
    const reason = (error as Error).name === 'AbortError' ? 'timeout_8s' : String(error);
    authLog('profile_recovery_failed', { reason });
    // Network failure or timeout: Firebase session is still valid.
    // CLEAR_USER exits the splash to SignIn rather than leaving it stuck.
    dispatch({ type: 'CLEAR_USER' });
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  // ── Single source of truth for premium status ──────────────────────────────
  // Whenever a user becomes authenticated, definitively resolve their plan from
  // the backend (GET /Users/{id}) — the canonical source — then flip
  // isLoadingUserStatus to false. This is the ONLY place the plan is fetched for
  // gating; screens read the result from this context. Also refreshes when the
  // app returns to the foreground so upgrades/lapses reflect without a re-login.
  const userId = state.user?.id || (state.user as any)?.uid || null;
  useEffect(() => {
    let active = true;

    // Signed out → nothing to resolve; not loading.
    if (!userId) {
      dispatch({ type: 'SET_USER_STATUS_LOADING', payload: false });
      return;
    }

    const resolvePlan = async (showLoading: boolean) => {
      if (showLoading) dispatch({ type: 'SET_USER_STATUS_LOADING', payload: true });
      try {
        const res = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`, {
          method: 'GET',
        });
        if (res.ok) {
          const data = await res.json();
          const resolvedPlan = (data?.plan ?? 'free');
          if (!active) return;
          dispatch({ type: 'UPDATE_USER_PLAN', payload: { plan: resolvedPlan } });
          // Persist so the next cold start restores the correct plan.
          try {
            const raw = await getStoredAuthData();
            if (raw?.userData) {
              await storeAuthData({ ...raw, userData: { ...raw.userData, plan: resolvedPlan } });
            }
          } catch { /* persistence is best-effort */ }
        }
      } catch {
        /* network/auth error — keep whatever plan we have; fail closed downstream */
      } finally {
        if (active) dispatch({ type: 'SET_USER_STATUS_LOADING', payload: false });
      }
    };

    // Initial definitive resolve (shows loading until done).
    resolvePlan(true);

    // Near-real-time refresh on app foreground (no loading flicker).
    // Guard against firing during logout: if Firebase already signed out,
    // auth.currentUser is null and any API call here would fail or be wasteful.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && auth.currentUser) resolvePlan(false);
    });

    return () => {
      active = false;
      sub?.remove();
    };
  }, [userId]);

  // Firebase session listener — the ONE place that reacts to Firebase's view
  // of the session. Uses onIdTokenChanged rather than onAuthStateChanged so
  // this also fires whenever Firebase silently refreshes the ID token in the
  // background, keeping AsyncStorage's cached copy in sync without polling.
  //
  // INVARIANT: SET_FIREBASE_READY is dispatched as the very LAST action in
  // every code path. The splash screen waits for firebaseReady before it is
  // allowed to navigate, so this guarantees the app never enters MainApp
  // before user state (SET_USER or CLEAR_USER) has fully settled.
  useEffect(() => {
    authLog('app_launch');

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Unverified accounts: block the local session without wiping
          // Firebase's own session (so resendVerificationEmail still works).
          if (!firebaseUser.emailVerified) {
            dispatch({ type: 'CLEAR_USER' });
            dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
            dispatch({ type: 'SET_EMAIL_VERIFIED', payload: false });
            dispatch({ type: 'SET_ERROR', payload: 'Email not verified. Please check your inbox and verify your email address.' });
            return; // finally block dispatches SET_FIREBASE_READY
          }

          const { token, errorClass } = await ensureFreshIdToken();

          if (!token) {
            if (errorClass === 'fatal') {
              // Firebase confirmed this session cannot be revived (disabled
              // account, revoked refresh token). Only legitimate auto-logout.
              authLog('session_invalidated', { reason: 'fatal_token_error' });
              await endSession('fatal_token_error');
              dispatch({ type: 'CLEAR_USER' });
              dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
            }
            // Recoverable (network) errors: change nothing — ensureFreshIdToken
            // already retried with backoff; the next foreground/API call retries.
            return; // finally block dispatches SET_FIREBASE_READY
          }

          const storedAuthData = await getStoredAuthData();

          if (storedAuthData?.userData) {
            // Happy path: Firebase session and cached profile both present.
            dispatch({
              type: 'SET_USER',
              payload: {
                user: storedAuthData.userData,
                token: `Bearer ${token}`,
                keepLoggedIn: storedAuthData.keepLoggedIn,
                lastLoginTime: Date.now(),
                isEmailVerified: true,
              },
            });
          } else {
            // Firebase has a valid session but no cached profile (e.g. storage
            // cleared externally, new device after migration). Recover from
            // backend with timeout and authenticated request; CLEAR_USER on any
            // failure so the splash exits to SignIn rather than hanging.
            await recoverUserProfile(firebaseUser, token, dispatch);
          }
        } else {
          // Firebase reports no live session.
          const keepLoggedIn = await getKeepLoggedInPreference();
          if (!keepLoggedIn) {
            // keepLoggedIn = false: intentional — wipe local state too.
            await clearAuthData();
          }
          // keepLoggedIn = true: genuine "no session" signal from Firebase
          // (not a timing race — Firebase persistence resolves before this
          // first callback). Reflect in-memory without wiping the preference.
          dispatch({ type: 'CLEAR_USER' });
        }
      } catch (error) {
        authLog('refresh_failed', { step: 'listener', error: String(error) });
        // On any unexpected error mark ready so the splash doesn't hang.
        // The user lands on SignIn and can retry.
        dispatch({ type: 'CLEAR_USER' });
      } finally {
        // SET_FIREBASE_READY fires unconditionally here for every path that
        // didn't already return early (the early-return paths each dispatch
        // it explicitly just before their return statement above).
        dispatch({ type: 'SET_FIREBASE_READY', payload: true });
      }
    });

    return () => unsubscribe();
  }, []);

  // Optimistic cache hydration on app start. This lets the UI show cached
  // user data immediately (useful offline, and for a smooth splash), but it
  // is deliberately NOT the source of truth for isAuthenticated: the
  // onIdTokenChanged listener above is what SplashScreen actually waits on
  // (via firebaseReady) before navigating, so this cannot cause a premature
  // redirect - it can only make the wait feel instant when Firebase confirms
  // what this cache already showed.
  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });

        const keepLoggedIn = await getKeepLoggedInPreference();
        dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: keepLoggedIn });

        const authData = await getStoredAuthData();

        if (authData) {
          const finalKeepLoggedIn = authData.keepLoggedIn !== undefined ? authData.keepLoggedIn : keepLoggedIn;
          dispatch({ type: 'RESTORE_AUTH', payload: { ...authData, keepLoggedIn: finalKeepLoggedIn } });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        await handleStorageError(error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to restore authentication state' });
      }
    };

    restoreAuthState();
  }, []);

  // Login is handled directly in SignInScreen via Firebase's signInWithEmailAndPassword.
  // The onIdTokenChanged listener above reacts automatically and sets context state.
  // This stub satisfies the AuthContextType interface for any legacy call sites.
  const login = async (_email: string, _password: string, _keepLoggedIn: boolean): Promise<void> => {
    if (__DEV__) {
      console.warn('[Auth] context.login() is a no-op. Use Firebase signInWithEmailAndPassword in SignInScreen directly.');
    }
  };

  // Logout function - ENHANCED for Firebase
  // Explicit, user-initiated sign-out - the one path here that's always
  // supposed to end the session, so it goes straight to endSession().
  const logout = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await endSession('user_initiated_logout');
      dispatch({ type: 'CLEAR_USER' });
      dispatch({ type: 'SET_KEEP_LOGGED_IN', payload: false });
    } catch (error) {
      await handleStorageError(error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to logout' });
      throw error;
    }
  };

  // Exposed for callers that want to force a refresh explicitly; routine
  // refresh happens automatically via the onIdTokenChanged listener above.
  const refreshToken = async (): Promise<void> => {
    const { token, errorClass } = await ensureFreshIdToken({ forceRefresh: true });
    if (!token) {
      const appError = createAppError(ERROR_CODES.TOKEN_REFRESH_FAILED, new Error(`Token refresh failed (${errorClass ?? 'unknown'})`));
      if (errorClass === 'fatal') {
        await handleAuthError(appError);
        dispatch({ type: 'SET_ERROR', payload: appError.userMessage });
      }
      throw appError;
    }
  };

  // Resend verification email function
  const resendVerificationEmail = async (): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      await sendEmailVerification(currentUser);
      dispatch({ type: 'CLEAR_ERROR' });
      
    } catch (error) {
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

  const updateUserPlan = (plan: string): void => {
    dispatch({ type: 'UPDATE_USER_PLAN', payload: { plan } });
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
    updateUserPlan,
    // Canonical, fail-closed premium gate derived from the single source.
    isFreeUser: !planIsPremium(state.user?.plan),
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
  
  // lastLoginTime is written as part of storeAuthData — no separate call needed.
  await storeAuthData({
    userToken: token,
    userData: user,
    userRole: user.plan === 'admin' ? 'admin' : 'user',
    keepLoggedIn,
    lastLoginTime: now,
  });
};

export default AuthContext;



// export default AuthContext; (duplicate default export removed)
