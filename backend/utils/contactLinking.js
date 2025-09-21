/**
 * Contact Linking Utilities
 * Handles linking contacts to XS Card users and profile image generation
 */

const { bucket } = require('../firebase');

/**
 * Get the Firebase Storage bucket name
 * @returns {string} - The storage bucket name
 */
const getBucketName = () => {
  return process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
};

/**
 * Generate profile image URL for a specific card
 * @param {string} userId - The user ID
 * @param {number} cardIndex - The card index (0, 1, 2, etc.)
 * @returns {string} - The full URL to the profile image
 */
const getCardProfileImageUrl = (userId, cardIndex) => {
  const bucketName = getBucketName();
  return `https://storage.googleapis.com/${bucketName}/profiles/${userId}/card${cardIndex}.jpg`;
};

/**
 * Check if a profile image exists for a specific card
 * @param {string} userId - The user ID
 * @param {number} cardIndex - The card index
 * @returns {Promise<boolean>} - True if image exists, false otherwise
 */
const checkProfileImageExists = async (userId, cardIndex) => {
  try {
    const imagePath = `profiles/${userId}/card${cardIndex}.jpg`;
    const file = bucket.file(imagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('Error checking profile image existence:', error);
    return false;
  }
};

/**
 * Link a contact to an XS Card user
 * @param {Object} contactData - The contact data
 * @param {string} sourceUserId - The user ID who shared the card
 * @param {number} sourceCardIndex - The card index that was shared
 * @returns {Promise<Object>} - The contact data with linking information
 */
const linkContactToXsCardUser = async (contactData, sourceUserId, sourceCardIndex) => {
  try {
    // Validate parameters
    if (!sourceUserId || sourceCardIndex === undefined || sourceCardIndex === null) {
      console.log('Missing linking parameters, returning contact without linking');
      return contactData;
    }

    // Get the actual profile image URL from the cards collection
    const { db } = require('../firebase');
    const cardRef = db.collection('cards').doc(sourceUserId);
    
    console.log(`Starting cards lookup for user: ${sourceUserId}`);
    const startTime = Date.now();
    const cardDoc = await cardRef.get();
    const endTime = Date.now();
    console.log(`Cards lookup completed in ${endTime - startTime}ms`);
    console.log(`Card document exists: ${cardDoc.exists}`);
    
    let profileImageUrl = null;
    if (cardDoc.exists) {
      const cardData = cardDoc.data();
      if (cardData.cards && cardData.cards[sourceCardIndex] && cardData.cards[sourceCardIndex].profileImage) {
        profileImageUrl = cardData.cards[sourceCardIndex].profileImage;
        console.log(`Found profile image URL: ${profileImageUrl}`);
      } else {
        console.log(`No profile image found for card ${sourceCardIndex}`);
      }
    } else {
      console.log(`No cards document found for user ${sourceUserId}`);
    }

    // Return contact with linking information
    return {
      ...contactData,
      sourceUserId,
      sourceCardIndex: parseInt(sourceCardIndex),
      profileImageUrl,
      isXsCardUser: true,
      linkedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error linking contact to XS Card user:', error);
    // Return original contact data if linking fails
    return contactData;
  }
};

/**
 * Get profile image URL for a contact
 * @param {Object} contact - The contact object
 * @returns {string|null} - The profile image URL or null
 */
const getContactProfileImageUrl = (contact) => {
  if (contact.isXsCardUser && contact.sourceUserId && contact.sourceCardIndex !== undefined) {
    return getCardProfileImageUrl(contact.sourceUserId, contact.sourceCardIndex);
  }
  return null;
};

/**
 * Validate contact linking data
 * @param {Object} contactData - The contact data to validate
 * @returns {Object} - Validation result with isValid and errors
 */
const validateContactLinking = (contactData) => {
  const errors = [];

  if (contactData.sourceUserId && typeof contactData.sourceUserId !== 'string') {
    errors.push('sourceUserId must be a string');
  }

  if (contactData.sourceCardIndex !== undefined && 
      (typeof contactData.sourceCardIndex !== 'number' || contactData.sourceCardIndex < 0)) {
    errors.push('sourceCardIndex must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  getCardProfileImageUrl,
  checkProfileImageExists,
  linkContactToXsCardUser,
  getContactProfileImageUrl,
  validateContactLinking,
  getBucketName
};
