/**
 * Payment Initialization Rate Limiting Middleware
 * 
 * Rate limiting for enterprise payment initialization endpoint.
 * Limits: 5 requests per hour per quote ID.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getEnvOverride } = require('../config/environment');

/**
 * Create rate limiter for payment initialization endpoint
 * Default: 5 requests per hour per quote
 * 
 * Uses quoteId from request body as key for rate limiting
 */
const createPaymentInitRateLimit = () => {
  return rateLimit({
    windowMs: parseInt(getEnvOverride('PAYMENT_INIT_RATE_WINDOW_MS', '3600000')), // 1 hour (3600000 ms)
    max: parseInt(getEnvOverride('PAYMENT_INIT_RATE_LIMIT', '5')), // 5 requests per hour
    message: {
      error: 'Too many payment initialization requests',
      message: 'Rate limit exceeded. Maximum 5 payment initialization requests per hour per quote.',
      retryAfter: 3600 // seconds
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    
    // Custom key generator - use quoteId from request body, fallback to IP with IPv6 support
    keyGenerator: (req) => {
      const quoteId = req.body?.quoteId || req.query?.quoteId;
      if (quoteId) {
        return `payment_init_${quoteId}`;
      }
      // Use ipKeyGenerator helper for IPv6 compatibility
      return `payment_init_${ipKeyGenerator(req)}`;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const quoteId = req.body?.quoteId || req.query?.quoteId || 'unknown';
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      console.warn('Payment initialization rate limit exceeded:', {
        quoteId,
        ip: clientIP,
        userAgent,
        timestamp: new Date().toISOString(),
        path: req.path,
        attempts: req.rateLimit?.totalHits || 'unknown'
      });
      
      res.status(429).json({
        error: 'Too many payment initialization requests',
        message: 'Rate limit exceeded. Maximum 5 payment initialization requests per hour per quote. Please try again later.',
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
  createPaymentInitRateLimit,
  paymentInitRateLimit: createPaymentInitRateLimit()
};

