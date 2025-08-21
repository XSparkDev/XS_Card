const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { getUserInfo } = require('../utils/userUtils');

// Test route to debug getUserInfo function
router.get('/test-user-info/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`[TEST] Testing getUserInfo for userId: ${userId}`);
    
    const userInfo = await getUserInfo(userId);
    
    res.json({
      success: true,
      message: 'getUserInfo test completed',
      data: {
        requestedUserId: userId,
        userInfo: userInfo,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[TEST] Error testing getUserInfo:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing getUserInfo',
      error: error.message
    });
  }
});

// Test route to check raw user and card data
router.get('/test-raw-data/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const { db } = require('../firebase.js');
    
    console.log(`[TEST] Getting raw data for userId: ${userId}`);
    
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get card data
    const cardDoc = await db.collection('cards').doc(userId).get();
    const cardData = cardDoc.exists ? cardDoc.data() : null;
    
    res.json({
      success: true,
      message: 'Raw data retrieved',
      data: {
        requestedUserId: userId,
        userDocument: {
          exists: userDoc.exists,
          data: userData
        },
        cardDocument: {
          exists: cardDoc.exists,
          data: cardData
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[TEST] Error getting raw data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting raw data',
      error: error.message
    });
  }
});

module.exports = router; 