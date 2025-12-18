/**
 * Wallet Pass Service
 *
 * Minimal unified service to route wallet pass generation
 * to the appropriate platform-specific implementation.
 *
 * Supports:
 * - Android → GoogleWalletService (returns save URL)
 * - iOS     → AppleWalletService (returns .pkpass buffer)
 */

const GoogleWalletService = require('./googleWalletService');
const AppleWalletService = require('./appleWalletService');

class WalletPassService {
  constructor() {
    this.googleService = new GoogleWalletService();
    this.appleService = new AppleWalletService();
  }

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
      if (!this.googleService.validateServiceAccount()) {
        throw new Error('Google Wallet service account not properly configured');
      }
      return await this.googleService.generatePass(
        cardData,
        userId,
        cardIndex,
        saveContactUrl
      );
    }

    if (platform === 'ios') {
      if (!this.appleService.validateCertificates()) {
        throw new Error('Apple Wallet certificates not properly configured. Please check certificate paths in environment variables.');
      }
      return await this.appleService.generatePass(
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


