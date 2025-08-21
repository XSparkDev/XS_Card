const fs = require('fs');
const path = require('path');
const { db } = require('../firebase');
const { uploadFile, convertPathToStorageUrl } = require('./firebaseStorage');

/**
 * Migrate a single user's images to Firebase Storage
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Migration results
 */
const migrateUserImages = async (userId) => {
  try {
    const result = {
      success: true,
      user: {
        profileImage: null,
        companyLogo: null
      },
      cards: []
    };

    // Migrate user profile images
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        success: false,
        message: `User ${userId} not found`,
        result
      };
    }

    const userData = userDoc.data();
    
    // Migrate user profile image if it exists
    if (userData.profileImage && userData.profileImage.startsWith('/profiles/')) {
      const imagePath = path.join(__dirname, '..', 'public', userData.profileImage.slice(1));
      
      if (fs.existsSync(imagePath)) {
        const fileBuffer = fs.readFileSync(imagePath);
        const newUrl = await uploadFile(fileBuffer, path.basename(imagePath), userId, 'profileImage');
        
        await userRef.update({ profileImage: newUrl });
        result.user.profileImage = newUrl;
      } else {
        // If file doesn't exist, convert the path to a Firebase Storage URL format
        const fallbackUrl = await convertPathToStorageUrl(userData.profileImage, userId);
        if (fallbackUrl) {
          await userRef.update({ profileImage: fallbackUrl });
          result.user.profileImage = fallbackUrl;
        }
      }
    }
    
    // Migrate user company logo if it exists
    if (userData.companyLogo && userData.companyLogo.startsWith('/profiles/')) {
      const logoPath = path.join(__dirname, '..', 'public', userData.companyLogo.slice(1));
      
      if (fs.existsSync(logoPath)) {
        const fileBuffer = fs.readFileSync(logoPath);
        const newUrl = await uploadFile(fileBuffer, path.basename(logoPath), userId, 'companyLogo');
        
        await userRef.update({ companyLogo: newUrl });
        result.user.companyLogo = newUrl;
      } else {
        // If file doesn't exist, convert the path to a Firebase Storage URL format
        const fallbackUrl = await convertPathToStorageUrl(userData.companyLogo, userId);
        if (fallbackUrl) {
          await userRef.update({ companyLogo: fallbackUrl });
          result.user.companyLogo = fallbackUrl;
        }
      }
    }

    // Migrate cards images
    const cardRef = db.collection('cards').doc(userId);
    const cardDoc = await cardRef.get();

    if (cardDoc.exists) {
      const cardData = cardDoc.data();
      
      if (cardData.cards && cardData.cards.length > 0) {
        const updatedCards = [];
        
        for (let i = 0; i < cardData.cards.length; i++) {
          const card = cardData.cards[i];
          const cardResult = { index: i, profileImage: null, companyLogo: null };
          
          // Migrate card profile image
          if (card.profileImage && card.profileImage.startsWith('/profiles/')) {
            const imagePath = path.join(__dirname, '..', 'public', card.profileImage.slice(1));
            
            if (fs.existsSync(imagePath)) {
              const fileBuffer = fs.readFileSync(imagePath);
              const newUrl = await uploadFile(fileBuffer, path.basename(imagePath), userId, 'profileImage');
              
              card.profileImage = newUrl;
              cardResult.profileImage = newUrl;
            } else {
              // If file doesn't exist, convert the path to a Firebase Storage URL format
              const fallbackUrl = await convertPathToStorageUrl(card.profileImage, userId);
              if (fallbackUrl) {
                card.profileImage = fallbackUrl;
                cardResult.profileImage = fallbackUrl;
              }
            }
          }
          
          // Migrate card company logo
          if (card.companyLogo && card.companyLogo.startsWith('/profiles/')) {
            const logoPath = path.join(__dirname, '..', 'public', card.companyLogo.slice(1));
            
            if (fs.existsSync(logoPath)) {
              const fileBuffer = fs.readFileSync(logoPath);
              const newUrl = await uploadFile(fileBuffer, path.basename(logoPath), userId, 'companyLogo');
              
              card.companyLogo = newUrl;
              cardResult.companyLogo = newUrl;
            } else {
              // If file doesn't exist, convert the path to a Firebase Storage URL format
              const fallbackUrl = await convertPathToStorageUrl(card.companyLogo, userId);
              if (fallbackUrl) {
                card.companyLogo = fallbackUrl;
                cardResult.companyLogo = fallbackUrl;
              }
            }
          }
          
          updatedCards.push(card);
          result.cards.push(cardResult);
        }
        
        // Update cards with new URLs
        await cardRef.update({ cards: updatedCards });
      }
    }
    
    return {
      success: true,
      message: `Successfully migrated images for user ${userId}`,
      result
    };
    
  } catch (error) {
    console.error(`Error migrating images for user ${userId}:`, error);
    return {
      success: false,
      message: `Error migrating images: ${error.message}`,
      error
    };
  }
};

/**
 * Migrate all users' images to Firebase Storage
 * @returns {Promise<Object>} - Migration results
 */
const migrateAllUserImages = async () => {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      return {
        success: true,
        message: 'No users found to migrate',
        results: []
      };
    }
    
    const results = [];
    
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const result = await migrateUserImages(userId);
      results.push({
        userId,
        ...result
      });
    }
    
    return {
      success: true,
      message: `Successfully migrated images for ${results.length} users`,
      results
    };
    
  } catch (error) {
    console.error('Error migrating all user images:', error);
    return {
      success: false,
      message: `Error migrating all user images: ${error.message}`,
      error
    };
  }
};

module.exports = {
  migrateUserImages,
  migrateAllUserImages
}; 