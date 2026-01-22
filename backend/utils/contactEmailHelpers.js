/**
 * Helper functions for contact-related emails
 */

const { db } = require('../firebase');

/**
 * Get the card owner's name from cards collection or userData
 * Tries multiple fallback strategies to get the best available name
 * 
 * @param {string} userId - The user ID
 * @param {Object} userData - User data from users collection
 * @returns {Promise<string>} The owner's name or fallback
 */
async function getOwnerName(userId, userData) {
    let ownerName = 'an XS Card user';
    
    try {
        // First try: Get from cards collection
        const cardsRef = db.collection('cards').doc(userId);
        const cardsDoc = await cardsRef.get();
        
        if (cardsDoc.exists && cardsDoc.data().cards && cardsDoc.data().cards.length > 0) {
            const firstCard = cardsDoc.data().cards[0];
            if (firstCard.name && firstCard.surname) {
                ownerName = `${firstCard.name} ${firstCard.surname}`;
                return ownerName;
            } else if (firstCard.name) {
                ownerName = firstCard.name;
                return ownerName;
            }
        }
    } catch (nameError) {
        console.error('Error getting owner name from cards collection:', nameError);
        // Continue to fallback
    }
    
    // Fallback: Get from userData
    if (userData) {
        if (userData.name && userData.surname) {
            ownerName = `${userData.name} ${userData.surname}`;
        } else if (userData.name) {
            ownerName = userData.name;
        } else if (userData.fullName) {
            ownerName = userData.fullName;
        }
    }
    
    return ownerName;
}

module.exports = {
    getOwnerName
};

