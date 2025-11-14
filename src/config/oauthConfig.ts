/**
 * OAuth Configuration
 * 
 * This file contains OAuth provider configurations.
 * Currently implements Google OAuth, with placeholders for future providers (LinkedIn, Microsoft).
 * 
 * Groundwork for future providers:
 * - Config structure supports multiple providers
 * - Types defined in src/services/oauth/types.ts
 * - Backend auto-provisioning supports all provider types
 */

// Google OAuth Web Client ID from Firebase Console
// Get from: Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!GOOGLE_WEB_CLIENT_ID) {
  console.warn('⚠️  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Google OAuth will not work.');
}

// LinkedIn OAuth Client ID from LinkedIn Developer Portal
// Get from: LinkedIn Developer Portal → Your App → Auth tab → Application credentials
const LINKEDIN_CLIENT_ID = process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID;

if (!LINKEDIN_CLIENT_ID) {
  console.warn('⚠️  EXPO_PUBLIC_LINKEDIN_CLIENT_ID is not set. LinkedIn OAuth will not work.');
}

// Microsoft OAuth Client ID from Microsoft Entra ID (Azure Portal)
// Get from: Azure Portal → App registrations → XS Card → Application (client) ID
const MICROSOFT_CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;

if (!MICROSOFT_CLIENT_ID) {
  console.warn('⚠️  EXPO_PUBLIC_MICROSOFT_CLIENT_ID is not set. Microsoft OAuth will not work once implemented.');
}

export interface OAuthProviderConfig {
  webClientId: string | undefined;
}

export interface OAuthConfig {
  google: OAuthProviderConfig;
  linkedin: OAuthProviderConfig; // Future: LinkedIn OAuth
  microsoft: OAuthProviderConfig; // Future: Microsoft OAuth
}

/**
 * OAuth configuration for all providers
 * 
 * Structure supports:
 * - google.com (implemented)
 * - linkedin.com (future)
 * - microsoft.com (future)
 */
export const oauthConfig: OAuthConfig = {
  google: {
    webClientId: GOOGLE_WEB_CLIENT_ID,
  },
  linkedin: {
    webClientId: LINKEDIN_CLIENT_ID,
  },
  microsoft: {
    webClientId: MICROSOFT_CLIENT_ID,
  },
};

/**
 * Get OAuth config for a specific provider
 * @param provider - Provider type ('google' | 'linkedin' | 'microsoft')
 * @returns Provider config or undefined if not configured
 */
export const getOAuthConfig = (provider: keyof OAuthConfig): OAuthProviderConfig | undefined => {
  return oauthConfig[provider];
};

/**
 * Check if a provider is configured
 * @param provider - Provider type
 * @returns true if provider has webClientId configured
 */
export const isProviderConfigured = (provider: keyof OAuthConfig): boolean => {
  const config = oauthConfig[provider];
  return !!config?.webClientId;
};

