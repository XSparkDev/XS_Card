// Development and production URLs
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const config = {
    development: {
        WALLET_PUBLIC_URL: process.env.DEV_WALLET_PUBLIC_URL,
        // Add any other development-specific configs here
    },
    production: {
        WALLET_PUBLIC_URL: process.env.PROD_WALLET_PUBLIC_URL || process.env.APP_URL,
        // Add any other production-specific configs here
    }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
