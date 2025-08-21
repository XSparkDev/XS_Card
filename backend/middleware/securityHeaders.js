/**
 * Middleware to add security headers using Helmet
 */
const helmet = require('helmet');

// Create a configured instance of helmet middleware
const securityHeaders = helmet({
  // Configure Referrer-Policy (which was missing according to the pentest)
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // Configure Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Add additional directives as needed for your application
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://*.render.com"]
    },
  },
  
  // Set Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  
  // Disable X-Powered-By header
  hidePoweredBy: true
});

module.exports = securityHeaders;
