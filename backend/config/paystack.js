/**
 * Paystack Configuration
 * 
 * This file handles Paystack API configuration with environment overrides
 * Following Golden Rules: ALL Paystack plan codes must match the live Paystack dashboard
 */

const { getConfig, getEnvOverride } = require('./environment');

const config = getConfig();

// Paystack API Configuration
const paystackConfig = {
    // API Configuration
    baseUrl: getEnvOverride('PAYSTACK_BASE_URL', config.paystack.baseUrl),
    port: parseInt(getEnvOverride('PAYSTACK_PORT', config.paystack.port)),
    timeout: parseInt(getEnvOverride('PAYSTACK_TIMEOUT', config.paystack.timeout)),
    
    // API Keys (from environment variables)
    secretKey: getEnvOverride('PAYSTACK_SECRET_KEY', ''),
    publicKey: getEnvOverride('PAYSTACK_PUBLIC_KEY', ''),
    
    // API Endpoints
    endpoints: {
        initialize: '/transaction/initialize',
        verify: '/transaction/verify',
        subscription: '/subscription',
        customer: '/customer'
    },
    
    // Request Configuration
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'XSCard-Subscription/1.0'
    }
};

// Validation function
const validateConfig = () => {
    const errors = [];
    
    if (!paystackConfig.secretKey) {
        errors.push('PAYSTACK_SECRET_KEY is required');
    }
    
    if (!paystackConfig.publicKey) {
        errors.push('PAYSTACK_PUBLIC_KEY is required');
    }
    
    if (errors.length > 0) {
        throw new Error(`Paystack configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
};

// Get authorization header
const getAuthHeader = () => {
    return `Bearer ${paystackConfig.secretKey}`;
};

// Get request options for API calls
const getRequestOptions = (path, method = 'GET') => {
    return {
        hostname: paystackConfig.baseUrl,
        port: paystackConfig.port,
        path: path,
        method: method,
        headers: {
            ...paystackConfig.headers,
            'Authorization': getAuthHeader()
        },
        timeout: paystackConfig.timeout
    };
};

module.exports = {
    paystackConfig,
    validateConfig,
    getAuthHeader,
    getRequestOptions
};
