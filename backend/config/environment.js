/**
 * Environment Configuration
 * 
 * This file handles environment-specific configuration with fallbacks
 * Following Golden Rules: ALL financial values must be configurable without code changes
 */

const environment = process.env.NODE_ENV || 'development';

// Environment-specific configurations
const configs = {
    development: {
        paystack: {
            baseUrl: 'api.paystack.co',
            port: 443,
            timeout: 30000
        },
        subscription: {
            trialDays: 0,
            trialMinutes: 10,
            verificationAmount: 100 // R1.00 in cents
        },
        rateLimit: {
            subscriptionRequests: 5,
            windowMs: 15 * 60 * 1000 // 15 minutes
        }
    },
    
    production: {
        paystack: {
            baseUrl: 'api.paystack.co',
            port: 443,
            timeout: 30000
        },
        subscription: {
            trialDays: 0,
            trialMinutes: 10,
            verificationAmount: 100 // R1.00 in cents
        },
        rateLimit: {
            subscriptionRequests: 10,
            windowMs: 15 * 60 * 1000 // 15 minutes
        }
    }
};

// Get current environment config
const getConfig = () => {
    return configs[environment] || configs.development;
};

// Environment variable overrides
const getEnvOverride = (key, defaultValue) => {
    return process.env[key] || defaultValue;
};

module.exports = {
    environment,
    getConfig,
    getEnvOverride
};
