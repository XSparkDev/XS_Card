const { admin, db } = require('../firebase');

/**
 * WebSocket Authentication Middleware for Socket.io
 * Validates JWT tokens for socket connections
 */
class SocketAuth {
    /**
     * Authenticate socket connection using JWT token
     * @param {Object} socket - Socket.io socket instance
     * @param {Function} next - Socket.io next function
     */
    static async authenticateSocket(socket, next) {
        try {
            // Extract token from socket handshake
            const token = socket.handshake.auth?.token || 
                         socket.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token) {
                console.log('[Socket Auth] No token provided for socket connection');
                return next(new Error('Authentication required. Please provide a valid token.'));
            }

            // Check if token is blacklisted (same as HTTP middleware)
            const blacklistDoc = await db.collection('tokenBlacklist').doc(token).get();
            if (blacklistDoc.exists) {
                console.log('[Socket Auth] Blacklisted token attempted connection');
                return next(new Error('Token has been revoked. Please login again.'));
            }

            let decodedToken;

            try {
                // Try to verify as ID token first (same logic as HTTP middleware)
                decodedToken = await admin.auth().verifyIdToken(token);
                console.log('[Socket Auth] ID token verified successfully for user:', decodedToken.uid);
            } catch (idTokenError) {
                // Fallback to custom token handling (same as HTTP middleware)
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(token);
                    
                    if (decoded && decoded.uid) {
                        decodedToken = {
                            uid: decoded.uid,
                            email: decoded.claims?.email || decoded.email,
                        };
                        console.log('[Socket Auth] Custom token decoded successfully for user:', decoded.uid);
                    } else {
                        throw new Error('Invalid custom token format');
                    }
                } catch (customTokenError) {
                    console.error('[Socket Auth] Token verification failed:', {
                        idTokenError: idTokenError.message,
                        customTokenError: customTokenError.message
                    });
                    throw new Error('Invalid token format');
                }
            }

            // Attach user info to socket for later use
            socket.user = decodedToken;
            socket.token = token;
            socket.userId = decodedToken.uid;

            console.log(`[Socket Auth] Socket authenticated for user: ${decodedToken.uid}`);
            next();

        } catch (error) {
            console.error('[Socket Auth] Authentication error:', error.message);
            next(new Error(`Authentication failed: ${error.message}`));
        }
    }

    /**
     * Middleware wrapper for easier use with Socket.io
     * @param {Object} socket 
     * @param {Function} next 
     */
    static middleware() {
        return (socket, next) => {
            SocketAuth.authenticateSocket(socket, next);
        };
    }
}

module.exports = SocketAuth; 