/**
 * User Detection Utilities
 * Handles checking if users exist by email for contact linking
 */

const { db } = require('../firebase');

/**
 * Check if a user exists by email address
 * @param {string} email - The email address to check
 * @returns {Promise<Object|null>} - User data if found, null if not found
 */
const checkUserExistsByEmail = async (email) => {
  try {
    if (!email || typeof email !== 'string') {
      console.log('Invalid email provided for user lookup');
      return null;
    }

    // Normalize email to lowercase for consistent lookup
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`Checking if user exists with email: ${normalizedEmail}`);

    // Query users collection by email field
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', normalizedEmail);
    
    console.log(`Starting email lookup for: ${normalizedEmail}`);
    const startTime = Date.now();
    const snapshot = await query.get();
    const endTime = Date.now();
    console.log(`Email lookup completed in ${endTime - startTime}ms`);

    if (snapshot.empty) {
      console.log(`No user found with email: ${normalizedEmail}`);
      return null;
    }

    // Should only be one user per email
    if (snapshot.size > 1) {
      console.warn(`Multiple users found with email: ${normalizedEmail}`);
    }

    // Get the first (should be only) user document
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    console.log(`User found: ${userDoc.id}`);
    
    // Return minimal user data for linking
    return {
      userId: userDoc.id,
      email: userData.email,
      // Add any other fields needed for linking
      plan: userData.plan || 'free'
    };

  } catch (error) {
    console.error('Error checking user existence by email:', error);
    return null;
  }
};

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} - True if email format is valid
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Check if user exists and validate email format
 * @param {string} email - The email to check
 * @returns {Promise<Object>} - Result with user data and validation info
 */
const validateAndCheckUser = async (email) => {
  // Validate email format first
  if (!isValidEmail(email)) {
    return {
      isValid: false,
      userExists: false,
      userData: null,
      error: 'Invalid email format'
    };
  }

  // Check if user exists
  const userData = await checkUserExistsByEmail(email);
  
  return {
    isValid: true,
    userExists: userData !== null,
    userData: userData,
    error: null
  };
};

module.exports = {
  checkUserExistsByEmail,
  isValidEmail,
  validateAndCheckUser
};
