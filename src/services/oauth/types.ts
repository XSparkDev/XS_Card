/**
 * OAuth Types
 * 
 * Type definitions for OAuth providers.
 * Supports Google (implemented), LinkedIn (future), and Microsoft (future).
 */

/**
 * OAuth provider types
 * Matches Firebase providerData identifiers:
 * - google.com: Google OAuth
 * - linkedin.com: LinkedIn OAuth (future)
 * - microsoft.com: Microsoft OAuth (future)
 */
export type OAuthProviderType = 'google.com' | 'linkedin.com' | 'microsoft.com';

/**
 * OAuth sign-in result
 * Contains the Firebase user and ID token after successful OAuth authentication
 */
export interface OAuthResult {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  token: string; // Firebase ID token
  providerId: OAuthProviderType;
}

/**
 * OAuth error
 * Standardized error format for OAuth operations
 */
export interface OAuthError {
  code: string;
  message: string;
  providerId: OAuthProviderType;
}

/**
 * OAuth provider interface
 * All OAuth providers should implement this interface
 * 
 * Future implementations:
 * - LinkedInProvider (linkedin.com)
 * - MicrosoftProvider (microsoft.com)
 */
export interface IOAuthProvider {
  signIn(): Promise<OAuthResult>;
  getProviderId(): OAuthProviderType;
}

