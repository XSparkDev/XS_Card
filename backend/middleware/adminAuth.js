require('dotenv').config();

/**
 * Admin authentication middleware.
 * Expects:
 * - Authorization: Bearer <ADMIN_API_KEY>  (but we also tolerate "Beasrer <key>" or any prefix by taking last token)
 * - OR x-api-key: <ADMIN_API_KEY>
 */
exports.adminAuth = async (req, res, next) => {
  try {
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey) {
      return res.status(500).json({
        message: 'Admin auth not configured (ADMIN_API_KEY missing)',
      });
    }

    const authHeader = req.headers.authorization || '';
    const xApiKey = req.headers['x-api-key'];

    let providedKey = '';
    if (typeof xApiKey === 'string' && xApiKey.trim()) {
      providedKey = xApiKey.trim();
    } else if (typeof authHeader === 'string' && authHeader.trim()) {
      // Be tolerant of typos like "Beasrer <key>" by always using the last token.
      // Example: "Bearer abc" -> "abc"
      const parts = authHeader.trim().split(/\s+/);
      providedKey = parts[parts.length - 1];
    }

    if (!providedKey) {
      return res.status(401).json({
        message: 'Admin authentication required. Provide ADMIN_API_KEY.',
      });
    }

    if (providedKey !== expectedKey) {
      return res.status(403).json({
        message: 'Admin authentication failed',
      });
    }

    next();
  } catch (err) {
    console.error('[adminAuth] error:', err);
    res.status(500).json({ message: 'Admin authentication error' });
  }
};

