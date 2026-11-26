import { getKeepLoggedInPreference, getStoredAuthData } from './authStorage';
// Firebase integration
import { auth } from '../config/firebaseConfig';
import { authLog, ensureFreshIdToken, endSession } from '../services/authSessionService';

/**
 * App-lifecycle hooks (foreground/background) that delegate every real
 * decision to authSessionService - this file no longer runs its own timers
 * or independently decides to clear storage. Firebase's SDK already keeps
 * the ID token fresh in the background on its own via the onIdTokenChanged
 * listener AuthContext keeps subscribed for the app's lifetime; the
 * foreground hook below is just a cheap "catch up" call for the case where
 * the JS timer was throttled while backgrounded.
 */
export class AuthManager {
  private static isExportingContact = false;

  /**
   * If keepLoggedIn is disabled, ending the session on background is an
   * intentional product choice (the user opted out of persistence), not an
   * auto-logout bug - it still routes through the single endSession() path.
   */
  static async handleAppBackground(): Promise<void> {
    try {
      if (this.isExportingContact) {
        return; // Never sign out mid-export.
      }

      const keepLoggedIn = await getKeepLoggedInPreference();
      if (!keepLoggedIn) {
        await this.performAutoLogout();
      }
    } catch (error) {
      authLog('refresh_failed', { step: 'handleAppBackground', error: String(error) });
    }
  }

  /**
   * Cheap catch-up refresh on foreground. Firebase decides internally
   * whether the cached token is actually stale enough to need a network
   * call - this never forces one.
   */
  static async handleAppForeground(): Promise<void> {
    try {
      this.isExportingContact = false;

      const keepLoggedIn = await getKeepLoggedInPreference();
      if (!keepLoggedIn) return;

      if (auth.currentUser) {
        await ensureFreshIdToken();
      }
      // If there's no Firebase user yet, the onIdTokenChanged listener in
      // AuthContext (already subscribed) will react the moment Firebase
      // resolves one - nothing to do here.
    } catch (error) {
      authLog('refresh_failed', { step: 'handleAppForeground', error: String(error) });
    }
  }

  static async performAutoLogout(): Promise<void> {
    await endSession('keep_logged_in_disabled_on_background');
  }

  /** Lightweight status snapshot for diagnostics/debugging screens. */
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

      return {
        isAuthenticated: !!authData && firebaseUser,
        keepLoggedIn,
        tokenValid: firebaseUser,
        firebaseUser,
      };
    } catch (error) {
      authLog('refresh_failed', { step: 'getAuthStatus', error: String(error) });
      return {
        isAuthenticated: false,
        keepLoggedIn: false,
        tokenValid: false,
        firebaseUser: false,
      };
    }
  }

  /** Prevents auto-logout while a contact export is mid-flight. */
  static setContactExporting(exporting: boolean): void {
    this.isExportingContact = exporting;
  }

  static isContactExportInProgress(): boolean {
    return this.isExportingContact;
  }
}
