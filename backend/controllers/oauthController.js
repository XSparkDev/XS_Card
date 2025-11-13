/**
 * OAuth Controller
 * 
 * NEW FILE (POOP) - Handles OAuth flows for Google, LinkedIn, Microsoft
 * Does NOT modify existing auth controllers (CEMENT)
 * 
 * Flow:
 * 1. App calls /oauth/google/start
 * 2. Backend redirects to Google OAuth
 * 3. Google redirects to /oauth/google/callback
 * 4. Backend exchanges code for tokens
 * 5. Backend creates Firebase custom token
 * 6. Backend redirects to app via custom scheme
 */

const { admin, db } = require('../firebase');
const axios = require('axios');
require('dotenv').config();

// OAuth state storage (in-memory for simplicity, use Redis for production)
const oauthStates = new Map();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      oauthStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

/**
 * GET /oauth/google/start
 * Initiates Google OAuth flow
 * 
 * Query params:
 * - state: Random state token from app (for CSRF protection)
 * 
 * Response:
 * - Redirects to Google OAuth consent screen
 */
exports.startGoogleOAuth = async (req, res) => {
  try {
    console.log('[OAuth] startGoogleOAuth called');
    console.log('[OAuth] Request method:', req.method);
    console.log('[OAuth] Request path:', req.path);
    console.log('[OAuth] Request query:', req.query);
    
    const { state } = req.query;

    if (!state) {
      console.log('[OAuth] Missing state parameter');
      return res.status(400).json({
        success: false,
        message: 'Missing state parameter'
      });
    }

    // Store state for validation in callback
    oauthStates.set(state, {
      timestamp: Date.now(),
      provider: 'google.com'
    });

    console.log('[OAuth] Starting Google OAuth flow, state:', state);

    // Get Google OAuth credentials from environment
    const googleClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_WEB_CLIENT_SECRET;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/oauth/google/callback`;

    if (!googleClientId || !googleClientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth not configured on server'
      });
    }

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', googleClientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid profile email');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    console.log('[OAuth] Redirecting to Google:', googleAuthUrl.toString());

    // Redirect to Google OAuth
    res.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('[OAuth] Error starting Google OAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start OAuth flow',
      error: error.message
    });
  }
};

/**
 * GET /oauth/google/callback
 * Handles Google OAuth callback
 * 
 * Query params:
 * - code: Authorization code from Google
 * - state: State token for CSRF protection
 * 
 * Response:
 * - Redirects to app via custom scheme with Firebase token
 */
exports.handleGoogleCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    console.log('[OAuth] Google callback received, state:', state);

    // Handle OAuth errors from Google
    if (oauthError) {
      console.error('[OAuth] Google OAuth error:', oauthError);
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=${encodeURIComponent(oauthError)}&state=${state}`;
      return res.redirect(appRedirect);
    }

    // Validate state
    if (!state || !oauthStates.has(state)) {
      console.error('[OAuth] Invalid or expired state:', state);
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=invalid_state`;
      return res.redirect(appRedirect);
    }

    // Clean up state
    oauthStates.delete(state);

    if (!code) {
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=no_code&state=${state}`;
      return res.redirect(appRedirect);
    }

    // Exchange authorization code for tokens
    const googleClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_WEB_CLIENT_SECRET;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/oauth/google/callback`;

    console.log('[OAuth] Exchanging code for tokens...');

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { id_token, access_token } = tokenResponse.data;

    if (!id_token) {
      throw new Error('No ID token received from Google');
    }

    console.log('[OAuth] Tokens received, decoding Google ID token...');

    // Decode Google ID token (it's a JWT, not a Firebase token)
    const jwt = require('jsonwebtoken');
    const decodedToken = jwt.decode(id_token);
    
    if (!decodedToken || !decodedToken.email) {
      throw new Error('Invalid Google ID token - missing email');
    }

    const googleEmail = decodedToken.email;
    const googleName = decodedToken.name || googleEmail.split('@')[0];
    const googleSub = decodedToken.sub; // Google user ID

    console.log('[OAuth] Google user decoded:', googleEmail);

    // Get or create Firebase user by email
    let firebaseUser;
    try {
      // Try to get existing user by email
      firebaseUser = await admin.auth().getUserByEmail(googleEmail);
      console.log('[OAuth] Existing Firebase user found:', firebaseUser.uid);
    } catch (error) {
      // User doesn't exist, create new one
      if (error.code === 'auth/user-not-found') {
        console.log('[OAuth] Creating new Firebase user for:', googleEmail);
        firebaseUser = await admin.auth().createUser({
          email: googleEmail,
          displayName: googleName,
          emailVerified: true, // Google emails are pre-verified
          providerData: [{
            uid: googleSub,
            email: googleEmail,
            displayName: googleName,
            providerId: 'google.com'
          }]
        });
        console.log('[OAuth] New Firebase user created:', firebaseUser.uid);
      } else {
        throw error;
      }
    }

    // Create Firebase custom token for this user
    const firebaseToken = await admin.auth().createCustomToken(firebaseUser.uid, {
      provider: 'google.com',
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email
    });

    console.log('[OAuth] Firebase custom token created');

    // Redirect to app with Firebase token
    const appRedirect = `com.p.zzles.xscard://oauth-callback?token=${encodeURIComponent(firebaseToken)}&state=${state}&provider=google.com`;
    
    console.log('[OAuth] Redirecting to app');
    res.redirect(appRedirect);
  } catch (error) {
    console.error('[OAuth] Error in Google callback:', error);
    const errorMessage = encodeURIComponent(error.message || 'OAuth failed');
    const appRedirect = `com.p.zzles.xscard://oauth-callback?error=${errorMessage}`;
    res.redirect(appRedirect);
  }
};

/**
 * GET /oauth/linkedin/start
 * Initiates LinkedIn OAuth flow
 * Phase 4: POOP - LinkedIn OAuth backend handler
 * 
 * Query params:
 * - state: Random state token from app (for CSRF protection)
 * 
 * Response:
 * - Redirects to LinkedIn OAuth consent screen
 */
exports.startLinkedInOAuth = async (req, res) => {
  try {
    console.log('[OAuth] startLinkedInOAuth called');
    console.log('[OAuth] Request method:', req.method);
    console.log('[OAuth] Request path:', req.path);
    console.log('[OAuth] Request query:', req.query);
    
    const { state } = req.query;

    if (!state) {
      console.log('[OAuth] Missing state parameter');
      return res.status(400).json({
        success: false,
        message: 'Missing state parameter'
      });
    }

    // Store state for validation in callback
    oauthStates.set(state, {
      timestamp: Date.now(),
      provider: 'linkedin.com'
    });

    console.log('[OAuth] Starting LinkedIn OAuth flow, state:', state);

    // Get LinkedIn OAuth credentials from environment
    const linkedinClientId = process.env.LINKEDIN_CLIENT_ID;
    const linkedinClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/oauth/linkedin/callback`;

    if (!linkedinClientId || !linkedinClientSecret) {
      return res.status(500).json({
        success: false,
        message: 'LinkedIn OAuth not configured on server'
      });
    }

    // Build LinkedIn OAuth URL
    const linkedinAuthUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    linkedinAuthUrl.searchParams.set('response_type', 'code');
    linkedinAuthUrl.searchParams.set('client_id', linkedinClientId);
    linkedinAuthUrl.searchParams.set('redirect_uri', redirectUri);
    linkedinAuthUrl.searchParams.set('state', state);
    linkedinAuthUrl.searchParams.set('scope', 'openid profile email');

    console.log('[OAuth] Redirecting to LinkedIn:', linkedinAuthUrl.toString());

    // Redirect to LinkedIn OAuth
    res.redirect(linkedinAuthUrl.toString());
  } catch (error) {
    console.error('[OAuth] Error starting LinkedIn OAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start OAuth flow',
      error: error.message
    });
  }
};

/**
 * GET /oauth/linkedin/callback
 * Handles LinkedIn OAuth callback
 * Phase 4: POOP - LinkedIn OAuth backend handler
 * 
 * Query params:
 * - code: Authorization code from LinkedIn
 * - state: State token for CSRF protection
 * 
 * Response:
 * - Redirects to app via custom scheme with Firebase token
 */
exports.handleLinkedInCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    console.log('[OAuth] LinkedIn callback received, state:', state);

    // Handle OAuth errors from LinkedIn
    if (oauthError) {
      console.error('[OAuth] LinkedIn OAuth error:', oauthError);
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=${encodeURIComponent(oauthError)}&state=${state}&provider=linkedin`;
      return res.redirect(appRedirect);
    }

    // Validate state
    if (!state || !oauthStates.has(state)) {
      console.error('[OAuth] Invalid or expired state:', state);
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=invalid_state&provider=linkedin`;
      return res.redirect(appRedirect);
    }

    // Clean up state
    oauthStates.delete(state);

    if (!code) {
      const appRedirect = `com.p.zzles.xscard://oauth-callback?error=no_code&state=${state}&provider=linkedin`;
      return res.redirect(appRedirect);
    }

    // Exchange authorization code for tokens
    const linkedinClientId = process.env.LINKEDIN_CLIENT_ID;
    const linkedinClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/oauth/linkedin/callback`;

    console.log('[OAuth] Exchanging code for tokens...');

    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: linkedinClientId,
        client_secret: linkedinClientSecret,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, id_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access token received from LinkedIn');
    }

    console.log('[OAuth] Tokens received, fetching LinkedIn user info...');

    // Get user info from LinkedIn
    const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const linkedinUser = userInfoResponse.data;

    if (!linkedinUser || !linkedinUser.email) {
      throw new Error('Invalid LinkedIn user data - missing email');
    }

    const linkedinEmail = linkedinUser.email;
    const linkedinName = linkedinUser.name || linkedinEmail.split('@')[0];
    const linkedinSub = linkedinUser.sub; // LinkedIn user ID

    console.log('[OAuth] LinkedIn user fetched:', linkedinEmail);

    // Get or create Firebase user by email
    let firebaseUser;
    try {
      // Try to get existing user by email
      firebaseUser = await admin.auth().getUserByEmail(linkedinEmail);
      console.log('[OAuth] Existing Firebase user found:', firebaseUser.uid);
    } catch (error) {
      // User doesn't exist, create new one
      if (error.code === 'auth/user-not-found') {
        console.log('[OAuth] Creating new Firebase user for:', linkedinEmail);
        firebaseUser = await admin.auth().createUser({
          email: linkedinEmail,
          displayName: linkedinName,
          emailVerified: true, // LinkedIn emails are pre-verified
          providerData: [{
            uid: linkedinSub,
            email: linkedinEmail,
            displayName: linkedinName,
            providerId: 'linkedin.com'
          }]
        });
        console.log('[OAuth] New Firebase user created:', firebaseUser.uid);
      } else {
        throw error;
      }
    }

    // Create Firebase custom token for this user
    const firebaseToken = await admin.auth().createCustomToken(firebaseUser.uid, {
      provider: 'linkedin.com',
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email
    });

    console.log('[OAuth] Firebase custom token created');

    // Redirect to app with Firebase token
    const appRedirect = `com.p.zzles.xscard://oauth-callback?token=${encodeURIComponent(firebaseToken)}&state=${state}&provider=linkedin`;
    
    console.log('[OAuth] Redirecting to app');
    res.redirect(appRedirect);
  } catch (error) {
    console.error('[OAuth] Error in LinkedIn callback:', error);
    const errorMessage = encodeURIComponent(error.message || 'OAuth failed');
    const appRedirect = `com.p.zzles.xscard://oauth-callback?error=${errorMessage}&provider=linkedin`;
    res.redirect(appRedirect);
  }
};

// TODO: Add Microsoft OAuth handlers here when implementing
// exports.startMicrosoftOAuth = async (req, res) => { ... }
// exports.handleMicrosoftCallback = async (req, res) => { ... }

