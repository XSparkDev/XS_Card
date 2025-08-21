const { db } = require('../firebase.js');

/**
 * Enhanced function to get user information with fallback to cards collection
 * This solves the "undefined names" issue by:
 * 1. First trying to get name/surname from users collection
 * 2. If not available, falling back to the first card in cards collection
 * 3. Providing sensible defaults if neither works
 * 
 * @param {string} userId - The user's document ID
 * @returns {Promise<Object>} User information object
 */
const getUserInfo = async (userId) => {
  try {
    console.log(`[getUserInfo] Getting user info for userId: ${userId}`);
    
    // First try to get from users collection
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`[getUserInfo] User document found`);
      
      // Check if we have complete name information
      if (userData.name && userData.surname) {
        const fullName = `${userData.name} ${userData.surname}`.trim();
        console.log(`[getUserInfo] Found complete name in users collection: "${fullName}"`);
        
        const result = {
          name: fullName,
          email: userData.email || 'No email',
          phone: userData.phone || '',
          company: userData.company || '',
          profileImage: userData.profileImage || null
        };
        
        return result;
      } else {
        console.log(`[getUserInfo] Incomplete name data in users collection, checking cards...`);
      }
    } else {
      console.log(`[getUserInfo] User document not found, checking cards collection...`);
    }

    // Fallback: Get name from first card in cards collection
    const cardDoc = await db.collection('cards').doc(userId).get();
    
    if (cardDoc.exists) {
      const cardData = cardDoc.data();
      console.log(`[getUserInfo] Card document found`);
      
      if (cardData.cards && cardData.cards.length > 0) {
        const firstCard = cardData.cards[0];
        console.log(`[getUserInfo] Found cards array with ${cardData.cards.length} cards`);
        
        // Build the name from card data
        let cardName = 'User'; // Default fallback
        if (firstCard.name && firstCard.surname) {
          cardName = `${firstCard.name} ${firstCard.surname}`.trim();
          console.log(`[getUserInfo] Built full name from card: "${cardName}"`);
        } else if (firstCard.name) {
          cardName = firstCard.name.trim();
        } else if (firstCard.surname) {
          cardName = firstCard.surname.trim();
        }
        
        // Get user data for additional fields (email, profile image, etc.)
        let userData = {};
        if (userDoc && userDoc.exists) {
          userData = userDoc.data();
        }
        
        const result = {
          name: cardName,
          email: firstCard.email || userData.email || 'No email',
          phone: firstCard.phone || userData.phone || '',
          company: firstCard.company || userData.company || '',
          profileImage: firstCard.profileImage || userData.profileImage || null
        };
        
        console.log(`[getUserInfo] Returning from cards collection: "${result.name}"`);
        return result;
      } else {
        console.log(`[getUserInfo] Cards array is empty or doesn't exist`);
      }
    } else {
      console.log(`[getUserInfo] Card document does not exist`);
    }
    
    // Final fallback: Use email prefix or generic name
    let fallbackName = 'User';
    let fallbackEmail = 'No email';
    
    // Try to get email from user document for fallback name
    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      if (userData.email) {
        fallbackEmail = userData.email;
        // Use part of email as name
        const emailPrefix = userData.email.split('@')[0];
        fallbackName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        console.log(`[getUserInfo] Using email prefix as name: "${fallbackName}"`);
      }
    }
    
    const result = {
      name: fallbackName,
      email: fallbackEmail,
      phone: '',
      company: '',
      profileImage: null
    };
    
    console.log(`[getUserInfo] Returning fallback data: "${result.name}"`);
    return result;
    
  } catch (error) {
    console.error(`[getUserInfo] ERROR for userId ${userId}:`, error.message);
    
    // Return safe fallback even on error
    return {
      name: 'User',
      email: 'No email',
      phone: '',
      company: '',
      profileImage: null
    };
  }
};

module.exports = {
  getUserInfo
}; 