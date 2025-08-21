/**
 * Pricing configuration for paid event publishing
 * 
 * This file contains the pricing rules for event publishing credits
 * Values can be updated via environment variables or remote config
 */

const pricingConfig = {
  // Base price for publishing a paid event (in ZAR cents)
  basePrice: 5000, // R50.00 in cents
  
  // Discount rate for premium/enterprise users (80% discount = 0.2 multiplier)
  premiumDiscount: 0.2,
  
  // Monthly credit allocation by tier
  monthlyCredits: {
    free: 0,
    premium: 5, // 4 + 1 extra
    enterprise: 12
  },
  
  // Tier names mapping
  tierNames: {
    free: 'Free',
    premium: 'Premium',
    enterprise: 'Enterprise'
  }
};

// Helper function to calculate price based on tier
const calculatePrice = (tier) => {
  if (tier === 'free') {
    return pricingConfig.basePrice;
  }
  return Math.round(pricingConfig.basePrice * pricingConfig.premiumDiscount);
};

// Helper function to get monthly credits for a tier
const getMonthlyCredits = (tier) => {
  return pricingConfig.monthlyCredits[tier] || 0;
};

module.exports = {
  ...pricingConfig,
  calculatePrice,
  getMonthlyCredits
}; 