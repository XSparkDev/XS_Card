/**
 * Single source of truth for the Firebase session lifecycle: restoring a
 * session on cold start, keeping its ID token fresh, and deciding whether a
 * failure is a transient blip (keep the session, retry later) or a genuine,
 * unrecoverable auth failure (sign the user out). Every other module
 * (AuthContext, AuthManager, api.ts) delegates to the functions here instead
 * of independently deciding to clear storage or sign out of Firebase.
 *
 * Design notes:
 * - Uses onIdTokenChanged (not onAuthStateChanged) as the one listener that
 *   matters: it fires on sign-in/out AND every time Firebase's SDK silently
 *   refreshes the ID token in the background, which is exactly the signal
 *   needed to keep AsyncStorage's cached token in sync without polling.
 * - Firebase's client SDK already proactively refreshes the ID token before
 *   it expires as long as a listener is subscribed (which AuthContext keeps
 *   alive for the app's lifetime) and getIdToken() itself only calls the
 *   network when the cached token is actually stale. There is deliberately
 *   no custom refresh-interval timer here - it would duplicate work Firebase
 *   already does and be another thing to get out of sync.
 */
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { getStoredAuthData, storeAuthData, clearAuthData } from '../utils/authStorage';

// ── Structured, dev-only diagnostics ────────────────────────────────────────
export type AuthLogEvent =
  | 'app_launch'
  | 'firebase_initialized'
  | 'restoration_started'
  | 'restoration_completed'
  | 'token_refreshed'
  | 'refresh_failed'
  | 'retry_initiated'
  | 'retry_succeeded'
  | 'session_invalidated'
  | 'user_signed_out'
  | 'profile_recovery_failed';

export function authLog(event: AuthLogEvent, data?: Record<string, unknown>): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[Auth] ${event}`, data ?? '');
}

// ── Error classification ────────────────────────────────────────────────────
// Anything not explicitly recognized as fatal is treated as recoverable. This
// is deliberately fail-safe: an error we don't recognize should never end a
// session that Keep Me Logged In was supposed to preserve.
export type AuthErrorClass = 'fatal' | 'recoverable';

const FATAL_FIREBASE_CODES = new Set([
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/invalid-user-token',
  'auth/user-token-expired', // refresh token itself was revoked (password reset elsewhere, admin revoke, etc.)
  'auth/invalid-credential',
  'auth/requires-recent-login',
]);

export function classifyAuthError(error: unknown): AuthErrorClass {
  const code = (error as { code?: string } | undefined)?.code;
  if (code && FATAL_FIREBASE_CODES.has(code)) return 'fatal';
  return 'recoverable';
}

// ── Token refresh ────────────────────────────────────────────────────────────
export interface EnsureFreshTokenResult {
  token: string | null;
  error?: unknown;
  errorClass?: AuthErrorClass;
}

// Several screens fire off several parallel API calls on mount, each of
// which asks for a fresh token via authenticatedFetchWithRefresh. Without
// this, a single screen load could trigger half a dozen concurrent
// getIdToken() + AsyncStorage writes for what is, functionally, one check.
// Only the routine (non-forced) path is deduped - a forced refresh is
// always an explicit, deliberate request (e.g. retrying after a 401) and
// should run independently.
let inFlightRoutineCheck: Promise<EnsureFreshTokenResult> | null = null;

/**
 * Get a valid ID token for the current Firebase user, retrying transient
 * failures with backoff. Never throws - callers branch on errorClass.
 * forceRefresh should stay false for routine calls; Firebase already knows
 * whether the cached token is stale and only hits the network when it is.
 */
export async function ensureFreshIdToken(
  opts: { forceRefresh?: boolean; retries?: number } = {}
): Promise<EnsureFreshTokenResult> {
  const { forceRefresh = false, retries = 2 } = opts;

  if (!forceRefresh && inFlightRoutineCheck) {
    return inFlightRoutineCheck;
  }

  const runner = ensureFreshIdTokenInternal(forceRefresh, retries);
  if (!forceRefresh) {
    inFlightRoutineCheck = runner;
    runner.finally(() => {
      inFlightRoutineCheck = null;
    });
  }
  return runner;
}

async function ensureFreshIdTokenInternal(
  forceRefresh: boolean,
  retries: number
): Promise<EnsureFreshTokenResult> {
  const user = auth.currentUser;
  if (!user) {
    return { token: null };
  }

  let attempt = 0;
  let lastError: unknown;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const token = await user.getIdToken(forceRefresh);
      if (attempt > 0) authLog('retry_succeeded', { attempt });
      authLog('token_refreshed', { attempt, forced: forceRefresh });
      await syncTokenToStorage(token);
      return { token };
    } catch (error) {
      lastError = error;
      const errorClass = classifyAuthError(error);
      authLog('refresh_failed', { attempt, code: (error as { code?: string })?.code, errorClass });

      if (errorClass === 'fatal') {
        return { token: null, error, errorClass };
      }

      if (attempt >= retries) {
        return { token: null, error, errorClass: 'recoverable' };
      }

      attempt += 1;
      authLog('retry_initiated', { attempt });
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
}

async function syncTokenToStorage(token: string): Promise<void> {
  try {
    const stored = await getStoredAuthData();
    await storeAuthData({
      ...(stored ?? {}),
      userToken: `Bearer ${token}`,
      lastLoginTime: Date.now(),
    });
  } catch (error) {
    // Storage sync failing doesn't invalidate the in-memory Firebase session;
    // the next successful refresh will re-sync it. Not fatal.
    authLog('refresh_failed', { step: 'syncTokenToStorage', error: String(error) });
  }
}

// ── Sign-out ─────────────────────────────────────────────────────────────────
// Shared with any module that ends a session, so a fatal error discovered by
// a background token refresh (not just a live API call) still gets the user
// back to the sign-in screen instead of leaving a stale MainApp on screen.
let authNavigationRef: { reset: (state: unknown) => void } | null = null;

export function setAuthNavigationRef(ref: { reset: (state: unknown) => void } | null): void {
  authNavigationRef = ref;
}

function resetToAuthStack(): void {
  try {
    authNavigationRef?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  } catch (error) {
    authLog('refresh_failed', { step: 'resetToAuthStack', error: String(error) });
  }
}

/**
 * The ONLY function allowed to end a session. Every other module that used
 * to call firebaseSignOut()+clearAuthData() directly now calls this instead,
 * so there is exactly one place that decides "this session is really over."
 */
export async function endSession(reason: string): Promise<void> {
  authLog('user_signed_out', { reason });
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    authLog('session_invalidated', { step: 'firebaseSignOut', reason, error: String(error) });
  }
  try {
    await clearAuthData();
  } catch (error) {
    authLog('session_invalidated', { step: 'clearAuthData', reason, error: String(error) });
  }
  resetToAuthStack();
}
