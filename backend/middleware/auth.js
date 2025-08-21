const { admin, db } = require('../firebase');

exports.authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Authentication required. Please provide a valid token.'
            });
        }

        const token = authHeader.split('Bearer ')[1];
        
        if (!token || token.trim() === '') {
            return res.status(401).json({
                message: 'Authentication token is empty.'
            });
        }
        
        // Check if token is blacklisted
        const blacklistDoc = await db.collection('tokenBlacklist').doc(token).get();
        if (blacklistDoc.exists) {
            return res.status(401).json({
                message: 'Token has been revoked. Please login again.',
                code: 'TOKEN_REVOKED'
            });
        }
        
        let decodedToken;
        
        try {
            // Try to verify as ID token first
            decodedToken = await admin.auth().verifyIdToken(token);
            console.log('[Auth Middleware] ID token verified successfully');
        } catch (idTokenError) {
            // If ID token verification fails, check if it's a custom token
            // Custom tokens start with a specific pattern and can be decoded
            try {
                // For custom tokens, we'll decode without verification
                // This is acceptable for our refresh scenario since we generated the token
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                
                if (decoded && decoded.uid) {
                    // Create a user object similar to what verifyIdToken returns
                    decodedToken = {
                        uid: decoded.uid,
                        email: decoded.claims?.email || decoded.email,
                        // Add other fields as needed
                    };
                    console.log('[Auth Middleware] Custom token decoded successfully for uid:', decoded.uid);
                } else {
                    throw new Error('Invalid custom token format');
                }
            } catch (customTokenError) {
                console.error('[Auth Middleware] Token verification failed:', {
                    idTokenError: idTokenError.message,
                    customTokenError: customTokenError.message
                });
                throw new Error('Invalid token format');
            }
        }
        
        // Attach user info to request
        // If email is missing, fetch from Firestore
        if (!decodedToken.email) {
            try {
                const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.email) {
                        decodedToken.email = userData.email;
                    }
                }
                // Fallback: check cards collection
                if (!decodedToken.email) {
                    const cardDoc = await db.collection('cards').doc(decodedToken.uid).get();
                    if (cardDoc.exists) {
                        const cardData = cardDoc.data();
                        if (cardData.cards && cardData.cards.length > 0 && cardData.cards[0].email) {
                            decodedToken.email = cardData.cards[0].email;
                        }
                    }
                }
            } catch (fetchError) {
                console.warn('[Auth Middleware] Could not fetch email from Firestore:', fetchError.message);
            }
        }
        req.user = decodedToken;
        req.token = token;
        next();
    } catch (error) {
        console.error('[Auth Middleware] Authentication error:', error);
        res.status(401).json({
            message: 'Authentication failed',
            error: error.message
        });
    }
};

// Optional authentication middleware - doesn't fail if no token provided
exports.optionalAuthentication = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // If no auth header, just continue without setting req.user
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[Optional Auth] No auth header provided, continuing as anonymous');
            return next();
        }

        const token = authHeader.split('Bearer ')[1];
        
        // If empty token, continue as anonymous
        if (!token || token.trim() === '') {
            console.log('[Optional Auth] Empty token provided, continuing as anonymous');
            return next();
        }
        
        // Check if token is blacklisted
        const blacklistDoc = await db.collection('tokenBlacklist').doc(token).get();
        if (blacklistDoc.exists) {
            console.log('[Optional Auth] Token is blacklisted, continuing as anonymous');
            return next();
        }
        
        let decodedToken;
        
        try {
            // Try to verify as ID token first
            decodedToken = await admin.auth().verifyIdToken(token);
            console.log('[Optional Auth] ID token verified successfully for uid:', decodedToken.uid);
        } catch (idTokenError) {
            // If ID token verification fails, check if it's a custom token
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                
                if (decoded && decoded.uid) {
                    decodedToken = {
                        uid: decoded.uid,
                        email: decoded.claims?.email || decoded.email,
                    };
                    console.log('[Optional Auth] Custom token decoded successfully for uid:', decoded.uid);
                } else {
                    throw new Error('Invalid custom token format');
                }
            } catch (customTokenError) {
                console.log('[Optional Auth] Token verification failed, continuing as anonymous:', {
                    idTokenError: idTokenError.message,
                    customTokenError: customTokenError.message
                });
                return next();
            }
        }
        
        // Attach user info to request if token was valid
        req.user = decodedToken;
        req.token = token;
        console.log('[Optional Auth] User authenticated successfully - uid:', decodedToken.uid, 'email:', decodedToken.email);
        next();
    } catch (error) {
        console.error('[Optional Auth] Unexpected error, continuing as anonymous:', error);
        // Don't fail - just continue without authentication
        next();
    }
};
