/*
================================================================================
  !!!  WALLET ROUTER — iOS PATH TOUCHES APPLE WALLET LOCK (appleWalletService)  !!!
================================================================================
  Non-aesthetic changes to iOS routing or generatePass args can break .pkpass.
================================================================================
*/
/**
 * Wallet Pass Service — routes Android (Google) vs iOS (Apple .pkpass buffer).
 */

class WalletPassService {
  /**
   * Generate a wallet pass based on platform.
   *
   * @param {'android'|'ios'} platform
   * @param {Object} cardData
   * @param {string} userId
   * @param {number} cardIndex
   * @param {string} saveContactUrl
   * @returns {Promise<string|Buffer>} Platform-specific result
   *   - Android: Returns Google Wallet save URL (string)
   *   - iOS: Returns .pkpass file buffer (Buffer)
   */
  async generatePass(platform, cardData, userId, cardIndex, saveContactUrl) {
    if (platform === 'android') {
      // Lazy-require so Android doesn't require iOS-only deps (e.g. passkit-generator).
      const GoogleWalletService = require('./googleWalletService');
      const googleService = new GoogleWalletService();

      if (!googleService.validateServiceAccount()) {
        throw new Error('Google Wallet service account not properly configured');
      }
      return await googleService.generatePass(
        cardData,
        userId,
        cardIndex,
        saveContactUrl
      );
    }

    if (platform === 'ios') {
      // Lazy-require so iOS deps are only needed for iOS requests.
      const AppleWalletService = require('./appleWalletService');
      const appleService = new AppleWalletService();

      if (!appleService.validateCertificates()) {
        throw new Error('Apple Wallet certificates not properly configured. Please check certificate paths in environment variables.');
      }
      return await appleService.generatePass(
        cardData,
        userId,
        cardIndex,
        saveContactUrl
      );
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }
}

module.exports = WalletPassService;


