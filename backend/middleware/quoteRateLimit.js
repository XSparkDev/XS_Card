/**
 * Quote Generation Rate Limiting Middleware
 * 
 * Rate limiting for enterprise quote generation endpoint.
 * Limits: 10 requests per hour per IP address.
 */

const rateLimit = require('express-rate-limit');
const { getEnvOverride } = require('../config/environment');

/**
 * Create rate limiter for quote generation endpoint
 * Default: 10 requests per hour per IP
 */
const createQuoteRateLimit = () => {
  return rateLimit({
    windowMs: parseInt(getEnvOverride('QUOTE_RATE_WINDOW_MS', '3600000')), // 1 hour (3600000 ms)
    max: parseInt(getEnvOverride('QUOTE_RATE_LIMIT', '10')), // 10 requests per hour
    message: {
      error: 'Too many quote requests',
      message: 'Rate limit exceeded. Maximum 10 quote requests per hour per IP address.',
      retryAfter: 3600 // seconds
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      console.warn('Quote generation rate limit exceeded:', {
        ip: clientIP,
        userAgent,
        timestamp: new Date().toISOString(),
        path: req.path,
        attempts: req.rateLimit?.totalHits || 'unknown'
      });
      
      res.status(429).json({
        error: 'Too many quote requests',
        message: 'Rate limit exceeded. Maximum 10 quote requests per hour per IP address. Please try again later.',
        retryAfter: 3600 // seconds
      });
    },
    
    // Skip rate limiting in test environment
    skip: (req) => {
      return process.env.NODE_ENV === 'test';
    },
    
    // Store rate limit data in memory (for production, consider Redis)
    store: undefined // Uses default memory store
  });
};

module.exports = {
  createQuoteRateLimit,
  quoteRateLimit: createQuoteRateLimit()
};

