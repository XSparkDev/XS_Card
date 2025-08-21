const { db, admin } = require('../firebase');
const { calculatePrice, getMonthlyCredits } = require('../config/pricing');

/**
 * Credit Service for Paid Event Publishing
 * 
 * Handles welcome credits, monthly credit buckets, and cost calculations
 */

/**
 * Calculate the cost to publish a paid event for a user
 * @param {string} uid - User ID
 * @returns {Promise<{price: number, creditType: string|null, remainingCredits: number}>}
 */
const calculateListingCost = async (uid) => {
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const userTier = userData.tier || userData.plan || 'free'; // Support both tier and plan fields
    
    // 1) Check welcome credit first
    if (!userData.welcomeCreditUsed) {
      await userRef.update({ 
        welcomeCreditUsed: true,
        updatedAt: admin.firestore.Timestamp.now()
      });
      return { 
        price: 0, 
        creditType: 'welcome', 
        remainingCredits: 0 
      };
    }
    
    // 2) Check monthly credit bucket
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`; // "2024-05"
    const bucketId = `${uid}_${periodKey}`;
    const bucketRef = db.collection('creditBuckets').doc(bucketId);
    
    return await db.runTransaction(async (transaction) => {
      const bucketDoc = await transaction.get(bucketRef);
      const allocated = getMonthlyCredits(userTier);
      
      let bucket;
      if (bucketDoc.exists) {
        bucket = bucketDoc.data();
      } else {
        // Create new bucket for this month
        bucket = {
          uid,
          tier: userTier,
          periodStart: `${periodKey}-01`,
          periodEnd: `${periodKey}-31`,
          creditsAllocated: allocated,
          creditsUsed: 0,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };
        transaction.set(bucketRef, bucket);
      }
      
      // Check if user has remaining credits
      const remainingCredits = bucket.creditsAllocated - bucket.creditsUsed;
      
      if (remainingCredits > 0) {
        // Use a credit
        bucket.creditsUsed++;
        bucket.updatedAt = admin.firestore.Timestamp.now();
        transaction.update(bucketRef, {
          creditsUsed: bucket.creditsUsed,
          updatedAt: bucket.updatedAt
        });
        
        return { 
          price: 0, 
          creditType: 'monthly', 
          remainingCredits: remainingCredits - 1 
        };
      }
      
      // No credits remaining, calculate discounted price
      const price = calculatePrice(userTier);
      return { 
        price, 
        creditType: null, 
        remainingCredits: 0 
      };
    });
    
  } catch (error) {
    console.error('Error calculating listing cost:', error);
    throw error;
  }
};

/**
 * Get user's current credit status
 * @param {string} uid - User ID
 * @returns {Promise<{welcomeCreditUsed: boolean, monthlyCredits: {allocated: number, used: number, remaining: number}, tier: string}>}
 */
const getUserCreditStatus = async (uid) => {
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const userTier = userData.tier || userData.plan || 'free';
    
    // Get current month's bucket
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const bucketId = `${uid}_${periodKey}`;
    const bucketRef = db.collection('creditBuckets').doc(bucketId);
    const bucketDoc = await bucketRef.get();
    
    let monthlyCredits = {
      allocated: getMonthlyCredits(userTier),
      used: 0,
      remaining: getMonthlyCredits(userTier)
    };
    
    if (bucketDoc.exists) {
      const bucket = bucketDoc.data();
      monthlyCredits = {
        allocated: bucket.creditsAllocated,
        used: bucket.creditsUsed,
        remaining: bucket.creditsAllocated - bucket.creditsUsed
      };
    }
    
    return {
      welcomeCreditUsed: userData.welcomeCreditUsed || false,
      monthlyCredits,
      tier: userTier
    };
    
  } catch (error) {
    console.error('Error getting user credit status:', error);
    throw error;
  }
};

/**
 * Apply a credit to publish an event (called after successful credit-based publishing)
 * @param {string} uid - User ID
 * @param {string} creditType - Type of credit used ('welcome' or 'monthly')
 * @param {string} eventId - Event ID
 * @returns {Promise<void>}
 */
const applyCreditToEvent = async (uid, creditType, eventId) => {
  try {
    const eventRef = db.collection('events').doc(eventId);
    await eventRef.update({
      listingFee: 0,
      creditApplied: creditType,
      paymentReference: null,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`Applied ${creditType} credit to event ${eventId} for user ${uid}`);
  } catch (error) {
    console.error('Error applying credit to event:', error);
    throw error;
  }
};

/**
 * Record a payment for an event
 * @param {string} eventId - Event ID
 * @param {number} amount - Payment amount in cents
 * @param {string} paymentReference - Paystack payment reference
 * @returns {Promise<void>}
 */
const recordEventPayment = async (eventId, amount, paymentReference) => {
  try {
    const eventRef = db.collection('events').doc(eventId);
    await eventRef.update({
      listingFee: amount,
      creditApplied: null,
      paymentReference,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`Recorded payment of ${amount} cents for event ${eventId}, reference: ${paymentReference}`);
  } catch (error) {
    console.error('Error recording event payment:', error);
    throw error;
  }
};

/**
 * Reset monthly credits for all users (called by scheduled function)
 * @param {string} yearMonth - Format: "2024-05"
 * @returns {Promise<{processed: number, errors: number}>}
 */
const resetMonthlyCredits = async (yearMonth) => {
  try {
    console.log(`Starting monthly credit reset for ${yearMonth}`);
    
    const usersSnapshot = await db.collection('users')
      .where('tier', 'in', ['premium', 'enterprise'])
      .get();
    
    const batch = db.batch();
    let processed = 0;
    let errors = 0;
    
    usersSnapshot.forEach(userDoc => {
      try {
        const userData = userDoc.data();
        const uid = userDoc.id;
        const userTier = userData.tier || userData.plan || 'free';
        
        // Skip free tier users
        if (userTier === 'free') {
          return;
        }
        
        const bucketId = `${uid}_${yearMonth}`;
        const bucketRef = db.collection('creditBuckets').doc(bucketId);
        
        const newBucket = {
          uid,
          tier: userTier,
          periodStart: `${yearMonth}-01`,
          periodEnd: `${yearMonth}-31`,
          creditsAllocated: getMonthlyCredits(userTier),
          creditsUsed: 0,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };
        
        batch.set(bucketRef, newBucket);
        processed++;
        
      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
        errors++;
      }
    });
    
    await batch.commit();
    
    console.log(`Monthly credit reset completed. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors };
    
  } catch (error) {
    console.error('Error in monthly credit reset:', error);
    throw error;
  }
};

module.exports = {
  calculateListingCost,
  getUserCreditStatus,
  applyCreditToEvent,
  recordEventPayment,
  resetMonthlyCredits
}; 