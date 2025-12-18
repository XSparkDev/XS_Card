/**
 * Google Wallet Service
 *
 * Minimal, Android-first implementation using Google Wallet REST API.
 * Uses environment variables for credentials instead of a JSON file.
 *
 * Required env vars:
 * - GOOGLE_WALLET_ISSUER_ID
 * - GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_WALLET_PRIVATE_KEY  (with literal \n, converted here)
 * - GOOGLE_WALLET_CLASS_ID
 */

const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

class GoogleWalletService {
  constructor() {
    this.issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    this.classId = process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1';
    this.serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
    this.rawPrivateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY || '';
    this.privateKey = this.rawPrivateKey ? this.rawPrivateKey.replace(/\\n/g, '\n') : '';
    this.auth = null;
    this.walletObjects = null;
  }

  /**
   * Initialize Google Wallet auth and client
   */
  async initializeAuth() {
    if (this.auth && this.walletObjects) {
      return;
    }

    if (!this.serviceAccountEmail || !this.privateKey || !this.issuerId) {
      throw new Error('Google Wallet service account not properly configured');
    }

    const credentials = {
      type: 'service_account',
      client_email: this.serviceAccountEmail,
      private_key: this.privateKey,
    };

    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    this.walletObjects = google.walletobjects({
      version: 'v1',
      auth: this.auth,
    });
  }

  /**
   * Generate a Google Wallet pass and return a save URL
   * @param {Object} cardData - Card data from Firestore
   * @param {string} userId - User ID
   * @param {number} cardIndex - Card index
   * @param {string} saveContactUrl - URL used in QR code
   * @returns {Promise<string>} Google Wallet save URL (JWT-based)
   */
  async generatePass(cardData, userId, cardIndex, saveContactUrl) {
    await this.initializeAuth();

    // Ensure class exists
    await this.ensurePassClass();

    // Create pass object
    const objectId = `${this.issuerId}.${userId}_${cardIndex}_${Date.now()}`;
    const objectResource = {
      id: objectId,
      classId: `${this.issuerId}.${this.classId}`,
      state: 'ACTIVE',
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: `${cardData.name || ''} ${cardData.surname || ''}`.trim() || 'XS Card',
        },
      },
      subheader: {
        defaultValue: {
          language: 'en-US',
          value: cardData.occupation || 'Business Card',
        },
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: cardData.company || 'XS Card',
        },
      },
      textModulesData: [
        {
          id: 'email',
          header: 'Email',
          body: cardData.email || 'N/A',
        },
        {
          id: 'phone',
          header: 'Phone',
          body: cardData.phone || 'N/A',
        },
      ],
      barcode: {
        type: 'QR_CODE',
        value: saveContactUrl,
        alternateText: 'Scan to save contact',
      },
      hexBackgroundColor: '#1B2B5B',
    };

    // Add images if available
    if (cardData.companyLogo) {
      objectResource.logo = {
        sourceUri: {
          uri: cardData.companyLogo,
        },
      };
    }

    if (cardData.profileImage) {
      objectResource.heroImage = {
        sourceUri: {
          uri: cardData.profileImage,
        },
      };
    }

    // Build JWT payload as per Google Wallet docs
    const jwtPayload = {
      iss: this.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      payload: {
        genericObjects: [objectResource],
      },
    };

    // Sign JWT with service account private key
    const token = jwt.sign(jwtPayload, this.privateKey, {
      algorithm: 'RS256',
    });

    // Build Google Wallet save URL using JWT
    const saveUrl = `https://pay.google.com/gp/v/save/${encodeURIComponent(token)}`;
    return saveUrl;
  }

  /**
   * Get test user emails from environment variable
   * Format: GOOGLE_WALLET_TEST_USERS="email1@example.com,email2@example.com"
   */
  getTestUsers() {
    const testUsersEnv = process.env.GOOGLE_WALLET_TEST_USERS;
    if (!testUsersEnv) {
      return [];
    }
    return testUsersEnv
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  }

  /**
   * Ensure the Google Wallet pass class exists; create if needed.
   * In TEST mode, test users must be added to allow pass saving.
   */
  async ensurePassClass() {
    const classId = `${this.issuerId}.${this.classId}`;

    let existingClass = null;
    try {
      const response = await this.walletObjects.genericclass.get({ resourceId: classId });
      existingClass = response.data;
    } catch (error) {
      // Class doesn't exist, will create it
    }

    const classResource = {
      id: classId,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: 'object.textModulesData["name"]',
                      },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: 'object.textModulesData["position"]',
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    // Add test users if configured (for TEST mode passes)
    const testUsers = this.getTestUsers();
    if (testUsers.length > 0) {
      classResource.testUsers = testUsers;
    }

    if (existingClass) {
      // Google Wallet API doesn't support updating testUsers via PATCH
      // Test users can only be set during class creation
      // For existing classes, test users must be added manually in Google Wallet Console
      if (testUsers.length > 0 && (!existingClass.testUsers || existingClass.testUsers.length === 0)) {
        console.warn(`⚠️  Pass class ${classId} already exists. Test users can only be set during creation.`);
        console.warn(`⚠️  Please add test users manually in Google Wallet Console:`);
        console.warn(`⚠️  1. Go to https://pay.google.com/business/console`);
        console.warn(`⚠️  2. Navigate to class: ${classId}`);
        console.warn(`⚠️  3. Add test user(s): ${testUsers.join(', ')}`);
      }
    } else {
      // Create new class
      await this.walletObjects.genericclass.insert({
        resource: classResource,
      });
      if (testUsers.length > 0) {
        console.log(`✅ Created pass class ${classId} with ${testUsers.length} test user(s)`);
      } else {
        console.log(`⚠️  Created pass class ${classId} in TEST mode. Add test users in Google Wallet Console or set GOOGLE_WALLET_TEST_USERS env var.`);
      }
    }
  }

  /**
   * Check if the pass class is approved for production use
   * @returns {Promise<{isProduction: boolean, status: string, message: string}>}
   */
  async checkClassStatus() {
    await this.initializeAuth();
    const classId = `${this.issuerId}.${this.classId}`;

    try {
      const classData = await this.walletObjects.genericclass.get({ resourceId: classId });
      const reviewStatus = classData.data.reviewStatus || 'UNKNOWN';
      
      const isProduction = reviewStatus === 'APPROVED';
      
      return {
        isProduction,
        status: reviewStatus,
        message: isProduction 
          ? 'Class is approved for production use'
          : `Class is in ${reviewStatus} status. Passes may only work for test users until approved for production.`,
      };
    } catch (error) {
      return {
        isProduction: false,
        status: 'NOT_FOUND',
        message: 'Class not found. It will be created in test mode on first use.',
      };
    }
  }

  /**
   * Quick config validation for feature-flag checks.
   */
  validateServiceAccount() {
    return Boolean(
      this.issuerId &&
      this.serviceAccountEmail &&
      this.privateKey
    );
  }
}

module.exports = GoogleWalletService;


