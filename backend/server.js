    /**
 * XS Card Backend Server
 */

process.removeAllListeners('warning');

require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Rate limiting for failed captcha attempts
const failedCaptchaAttempts = new Map();
const CAPTCHA_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000 // 60 minutes
};
const { db, admin, storage, bucket } = require('./firebase.js');
const { sendMailWithStatus } = require('./public/Utils/emailService');
const { checkUserExistsByEmail } = require('./utils/userDetection');
const { linkContactToXsCardUser } = require('./utils/contactLinking');
const { handleSingleUpload } = require('./middleware/fileUpload');
const app = express();
const port = 8383;

// Add CORS middleware to allow loading Firebase Storage images
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

// Import routes
const userRoutes = require('./routes/userRoutes');
const cardRoutes = require('./routes/cardRoutes');
const contactRoutes = require('./routes/contactRoutes');
const contactRequestRoutes = require('./routes/contactRequestRoutes'); // Add contact request routes
const meetingRoutes = require('./routes/meetingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes'); // Add subscription routes
const apkRoutes = require('./routes/apkRoutes'); // Add APK routes
const eventRoutes = require('./routes/eventRoutes'); // Add event routes
const testRoutes = require('./routes/testRoutes'); // Add test routes for debugging
const ticketRoutes = require('./routes/ticketRoutes'); // Add ticket routes
const eventOrganiserRoutes = require('./routes/eventOrganiserRoutes'); // Add event organiser routes
const bulkRegistrationRoutes = require('./routes/bulkRegistrationRoutes'); // Add bulk registration routes
const revenueCatRoutes = require('./routes/revenueCatRoutes'); // Add RevenueCat routes

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Define critical public routes FIRST to avoid middleware conflicts
app.get('/saveContact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'saveContact.html'));
});

// Define public endpoints that need to be accessible without authentication
// These MUST be defined before any routes that might have authentication middleware

// Modified public endpoint to get specific card by userId and cardIndex - MOVED TO VERY TOP
app.get('/public/cards/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const cardIndex = parseInt(req.query.cardIndex) || 0;
        console.log(`Fetching public card for user ${userId}, card index ${cardIndex}`);

        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();
        
        if (!doc.exists) {
            console.log(`User ${userId} not found`);
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = doc.data();
        if (!userData.cards || !userData.cards[cardIndex]) {
            console.log(`Card index ${cardIndex} not found for user ${userId}`);
            return res.status(404).send({ message: 'Card not found' });
        }

        // Get the specific card and add user ID
        const card = {
            id: userId,
            ...userData.cards[cardIndex]
        };

        // Log image URLs for debugging
        console.log('Card data being sent to client:');
        console.log('- Profile Image:', card.profileImage);
        console.log('- Company Logo:', card.companyLogo);

        res.status(200).send(card);
    } catch (error) {
        console.error('Error fetching public card:', error);
        res.status(500).send({ 
            message: 'Error fetching card', 
            error: error.message 
        });
    }
});

// Add scan tracking endpoint as public
app.post('/track-scan', async (req, res) => {
    const { userId, cardIndex = 0, scanType = 'save' } = req.body;
    
    console.log('Track scan called:', { userId, cardIndex, scanType });
    
    // Validate required parameters
    if (!userId) {
        return res.status(400).send({ 
            success: false,
            message: 'User ID is required'
        });
    }

    // Validate cardIndex is a number
    const parsedCardIndex = parseInt(cardIndex);
    if (isNaN(parsedCardIndex) || parsedCardIndex < 0) {
        return res.status(400).send({ 
            success: false,
            message: 'Valid card index is required'
        });
    }

    try {
        // Get user's cards
        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        if (!cardDoc.exists) {
            return res.status(404).send({ 
                success: false,
                message: 'User cards not found' 
            });
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !Array.isArray(cardsData.cards)) {
            return res.status(404).send({ 
                success: false,
                message: 'No cards found for user' 
            });
        }

        // Check if cardIndex is valid
        if (parsedCardIndex >= cardsData.cards.length) {
            return res.status(404).send({ 
                success: false,
                message: 'Card index out of range' 
            });
        }

        // Update the cards array
        const updatedCards = [...cardsData.cards];
        
        // Initialize scans field if it doesn't exist, then increment
        if (!updatedCards[parsedCardIndex].scans) {
            updatedCards[parsedCardIndex].scans = 0;
        }
        updatedCards[parsedCardIndex].scans += 1;

        // Save back to database
        await cardRef.update({
            cards: updatedCards
        });

        console.log(`Scan tracked for user ${userId}, card ${parsedCardIndex}. New count: ${updatedCards[parsedCardIndex].scans}`);

        res.status(200).send({ 
            success: true,
            message: 'Scan tracked successfully',
            cardIndex: parsedCardIndex,
            newScanCount: updatedCards[parsedCardIndex].scans,
            scanType: scanType
        });

    } catch (error) {
        console.error('Error tracking scan:', error);
        res.status(500).send({ 
            success: false,
            message: 'Failed to track scan',
            error: error.message 
        });
    }
});

// Add a route to handle query form submissions
app.post('/submit-query', async (req, res) => {
  try {
    console.log('Received query form submission:', req.body);
    
    const { name, email, message, to, type, captchaToken, ...rest } = req.body;
    
    // Verify hCaptcha first
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const captchaValid = await verifyHCaptcha(captchaToken, clientIP);
    if (!captchaValid) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification failed. Please try again.',
      });
    }
    
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (name, email, message)',
      });
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER, // Use system email as from address
      replyTo: email, // Set reply-to as the user's email address
      to: to || 'xscard@xspark.co.za', // Use provided destination or default
      subject: `New Contact Query from ${name}`,
      html: `
        <h2>New Query from XS Card Website</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
        <p style="color: #666; font-size: 12px;">This message was sent from the XS Card contact form.</p>
      `
    };

    const result = await sendMailWithStatus(mailOptions);
    console.log('Query email send attempt completed:', result);

    // --- Save to Firestore ---
    try {
      const messageDoc = {
        type: type || 'contact',
        name,
        email,
        message,
        status: 'open', // Set default status to 'open' for new requests
        submittedAt: admin.firestore.Timestamp.now(),
        ...rest // Save any extra fields (company, job title, etc.)
      };
      await db.collection('messages').add(messageDoc);
      console.log('Message saved to Firestore:', messageDoc);
    } catch (dbError) {
      console.error('Failed to save message to Firestore:', dbError);
      // Do not fail the request if DB write fails, just log
    }
    // --- End Firestore save ---
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Your message has been sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send your message',
        details: result
      });
    }
  } catch (error) {
    console.error('Query submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process your message',
      error: error.message
    });
  }
});

// Add the AddContact endpoint directly to server.js - MOVED TO TOP
// This bypasses any router or authentication middleware issues
app.post('/AddContact', async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    // Detailed logging
    console.log('Add Contact called - Public endpoint in server.js');
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ 
            success: false,
            message: 'User ID and contact info are required'
        });
    }

    // Validate that email is provided (required for user detection)
    if (!contactInfo.email || !contactInfo.email.trim()) {
        return res.status(400).send({ 
            success: false,
            message: 'Email is required for contact saving'
        });
    }

    try {
        // Get user's plan information
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (!userData) {
            return res.status(404).send({ message: 'User not found' });
        }

        const contactRef = db.collection('contacts').doc(userId);
        const doc = await contactRef.get();

        let currentContacts = [];
        if (doc.exists) {
            currentContacts = doc.data().contactList || [];
        }

        // Free plan contact limit
        const FREE_PLAN_CONTACT_LIMIT = 20;

        // Check if free user has reached contact limit
        if (userData.plan === 'free' && currentContacts.length >= FREE_PLAN_CONTACT_LIMIT) {
            console.log(`Contact limit reached for free user ${userId}. Current contacts: ${currentContacts.length}`);
            return res.status(403).send({
                message: 'Contact limit reached',
                error: 'FREE_PLAN_LIMIT_REACHED',
                currentContacts: currentContacts.length,
                limit: FREE_PLAN_CONTACT_LIMIT
            });
        }

        // Create base contact
        const baseContact = {
            ...contactInfo,
            email: contactInfo.email || '', // Add email field with fallback
            createdAt: admin.firestore.Timestamp.now()
        };

        // Check if the contact email belongs to an existing XS Card user
        let newContact = baseContact;
        try {
            console.log('Checking if contact is an XS Card user...');
            const existingUser = await checkUserExistsByEmail(contactInfo.email);
            
            if (existingUser) {
                console.log(`Contact is XS Card user: ${existingUser.userId}`);
                // Link the contact to the XS Card user (using card index 0 as primary)
                // Make linking non-blocking for better performance
                setImmediate(async () => {
                    try {
                        const linkedContact = await linkContactToXsCardUser(baseContact, existingUser.userId, 0);
                        console.log('Linked contact created in background');
                        // Update the contact in the database with linking info
                        const updatedContacts = [...currentContacts];
                        const contactIndex = updatedContacts.findIndex(c => c.email === baseContact.email);
                        if (contactIndex !== -1) {
                            updatedContacts[contactIndex] = linkedContact;
                            await contactRef.set({
                                userId: db.doc(`users/${userId}`),
                                contactList: updatedContacts
                            }, { merge: true });
                            console.log('Contact updated with linking info');
                        }
                    } catch (linkingError) {
                        console.error('Error during background linking:', linkingError);
                    }
                });
                console.log('Contact saved, linking will happen in background');
            } else {
                console.log('Contact is not an XS Card user, saving as regular contact');
            }
        } catch (linkingError) {
            console.error('Error during user detection (non-blocking):', linkingError);
            // Continue with regular contact if linking fails
            newContact = baseContact;
        }

        currentContacts.push(newContact);

        await contactRef.set({
            userId: db.doc(`users/${userId}`),
            contactList: currentContacts
        }, { merge: true });
        
        // Send email notification if user has email (non-blocking)
        if (userData.email) {
            // Send email in background - don't wait for it
            setImmediate(async () => {
                try {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: userData.email,
                        subject: 'Someone Saved Your Contact Information',
                        html: `
                            <h2>New Contact Added</h2>
                            <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                                <p><strong>Contact Details:</strong></p>                        <ul style="list-style: none; padding-left: 0;">
                                    <li><strong>Name:</strong> ${contactInfo.name}</li>
                                    <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                                    <li><strong>Phone Number:</strong> ${contactInfo.phone || 'Not provided'}</li>
                                    <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
                                    ${contactInfo.company ? `<li><strong>Company:</strong> ${contactInfo.company}</li>` : ''}
                                    <li><strong>How You Met:</strong> ${contactInfo.howWeMet || 'Not provided'}</li>
                                </ul>
                            </div>
                            <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
                            ${userData.plan === 'free' ? 
                                `<p style="color: #ff4b6e;">You have ${FREE_PLAN_CONTACT_LIMIT - currentContacts.length} contacts remaining in your free plan.</p>` 
                                : ''}
                        `
                    };

                    const mailResult = await sendMailWithStatus(mailOptions);
                    if (!mailResult.success) {
                        console.error('Failed to send email notification:', mailResult.error);
                    }
                } catch (emailError) {
                    console.error('Email sending error:', emailError);
                }
            });
        }
        
        res.status(201).send({ 
            success: true,
            message: 'Contact added successfully',
            contactList: currentContacts.map(contact => ({
                ...contact,
                createdAt: contact.createdAt ? contact.createdAt.toDate().toISOString() : new Date().toISOString()
            })),
            remainingContacts: userData.plan === 'free' ? 
                FREE_PLAN_CONTACT_LIMIT - currentContacts.length : 
                'unlimited'
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).send({ 
            success: false,
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
});

// Profile image endpoint - public
app.get('/profile-image/:userId/:cardIndex', async (req, res) => {
    const { userId, cardIndex } = req.params;
    
    console.log(`Profile image requested for user: ${userId}, card: ${cardIndex}`);
    
    try {
        // Validate parameters
        if (!userId || cardIndex === undefined) {
            return res.status(400).send({
                success: false,
                message: 'User ID and card index are required'
            });
        }

        const cardIndexNum = parseInt(cardIndex);
        if (isNaN(cardIndexNum) || cardIndexNum < 0) {
            return res.status(400).send({
                success: false,
                message: 'Card index must be a non-negative number'
            });
        }

        // Generate the profile image URL
        const { getCardProfileImageUrl } = require('./utils/contactLinking');
        const profileImageUrl = getCardProfileImageUrl(userId, cardIndexNum);
        
        console.log(`Generated profile image URL: ${profileImageUrl}`);
        
        // Return the URL - the frontend can handle checking if the image actually exists
        res.status(200).send({
            success: true,
            userId: userId,
            cardIndex: cardIndexNum,
            profileImageUrl: profileImageUrl
        });

    } catch (error) {
        console.error('Error getting profile image URL:', error);
        res.status(500).send({
            success: false,
            message: 'Failed to get profile image URL',
            error: error.message
        });
    }
});

// Public routes - must be before authentication middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', paymentRoutes); // Add this line before protected routes
app.use('/', subscriptionRoutes); // Add subscription routes
app.use('/api/revenuecat', revenueCatRoutes); // Add RevenueCat routes
app.use('/', apkRoutes); // Add APK routes for public download
app.use('/', eventRoutes); // Move event routes to public section for /api/events/public
app.use('/', userRoutes); // Move user routes to public section so SignIn works
app.use('/', contactRoutes); // Move contact routes to public section to keep save contact public
app.use('/api', contactRequestRoutes); // Add contact request routes
app.use('/api', eventOrganiserRoutes); // Add event organiser routes
app.use('/api', bulkRegistrationRoutes); // Add bulk registration routes
app.use('/api', testRoutes); // Add test routes for debugging



// Add new contact saving endpoint
app.post('/saveContact', async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ message: 'User ID and contact info are required' });
    }

    try {
        // Save contact to database
        const contactsRef = db.collection('contacts').doc(userId);
        const contactsDoc = await contactsRef.get();

        let contactList = contactsDoc.exists ? (contactsDoc.data().contactList || []) : [];
        if (!Array.isArray(contactList)) contactList = [];

        // Add new contact with Firestore Timestamp
        contactList.push({
            name: contactInfo.name,
            surname: contactInfo.surname,
            phone: contactInfo.phone,
            howWeMet: contactInfo.howWeMet,
            createdAt: admin.firestore.Timestamp.now()
        });

        await contactsRef.set({
            contactList: contactList
        }, { merge: true });

        // Send email notification
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (userData && userData.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userData.email,
                subject: 'Someone Saved Your Contact Information',
                html: `
                    <h2>New Contact Added</h2>
                    <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Contact Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Name:</strong> ${contactInfo.name}</li>
                            <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                            <li><strong>Phone Number:</strong> ${contactInfo.phone}</li>
                            <li><strong>How You Met:</strong> ${contactInfo.howWeMet}</li>
                        </ul>
                    </div>
                    <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
                `
            };

            const mailResult = await sendMailWithStatus(mailOptions);
            console.log('Email sending result:', mailResult);

            if (!mailResult.success) {
                console.error('Failed to send email:', mailResult.error);
            }
        }

        // Send success response
        res.status(200).send({ 
            success: true,
            message: 'Contact saved successfully',
            contact: contactList[contactList.length - 1],
            emailSent: userData?.email ? true : false
        });

    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).send({ 
            success: false,
            message: 'Failed to save contact',
            error: error.message 
        });
    }
});





// Data migration endpoint - run once to initialize scans field for existing cards
app.post('/migrate-scans', async (req, res) => {
    try {
        console.log('Starting scans migration for existing cards...');
        
        const cardsRef = db.collection('cards');
        const snapshot = await cardsRef.get();
        
        if (snapshot.empty) {
            return res.status(200).send({
                success: true,
                message: 'No cards found to migrate'
            });
        }

        let migratedUsers = 0;
        let migratedCards = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.cards && Array.isArray(userData.cards)) {
                let needsUpdate = false;
                const updatedCards = userData.cards.map(card => {
                    if (card.scans === undefined || card.scans === null) {
                        needsUpdate = true;
                        migratedCards++;
                        return {
                            ...card,
                            scans: 0
                        };
                    }
                    return card;
                });

                if (needsUpdate) {
                    batch.update(doc.ref, { cards: updatedCards });
                    migratedUsers++;
                }
            }
        });

        // Commit all updates
        await batch.commit();

        console.log(`Migration completed: ${migratedUsers} users, ${migratedCards} cards updated`);

        res.status(200).send({
            success: true,
            message: 'Migration completed successfully',
            stats: {
                usersUpdated: migratedUsers,
                cardsUpdated: migratedCards,
                totalUsersScanned: snapshot.size
            }
        });

    } catch (error) {
        console.error('Error during migration:', error);
        res.status(500).send({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    }
});

// Test endpoint to verify scan tracking (development only)
app.get('/test-scan-tracking/:userId/:cardIndex?', async (req, res) => {
    const { userId } = req.params;
    const cardIndex = parseInt(req.params.cardIndex) || 0;
    
    try {
        // Get current card data
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();
        
        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }
        
        const cardsData = doc.data();
        if (!cardsData.cards || cardIndex >= cardsData.cards.length) {
            return res.status(404).send({ message: 'Card not found' });
        }
        
        const card = cardsData.cards[cardIndex];
        const totalScans = cardsData.cards.reduce((sum, c) => sum + (c.scans || 0), 0);
        
        res.status(200).send({
            success: true,
            userId: userId,
            cardIndex: cardIndex,
            currentScans: card.scans || 0,
            totalScans: totalScans,
            cardInfo: {
                name: `${card.name} ${card.surname}`,
                company: card.company
            }
        });
        
    } catch (error) {
        console.error('Error in test endpoint:', error);
        res.status(500).send({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add a new endpoint to handle app requests
app.post('/app-request', async (req, res) => {
  try {
    const { email, userId, source } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Create a timestamp
    const timestamp = new Date().toISOString();
    
    // Create a reference to the app-requests collection
    const appRequestsRef = admin.firestore().collection('app-requests');
    
    // Save the request
    await appRequestsRef.add({
      email,
      userId: userId || null,
      source: source || 'unknown',
      platform: req.headers['user-agent'] || 'unknown',
      status: 'pending',
      timestamp
    });
    
    // Optional: Add to mailing list collection if exists
    try {
      const mailingListRef = admin.firestore().collection('mailing-list');
      
      // Check if email already exists
      const emailSnapshot = await mailingListRef
        .where('email', '==', email)
        .limit(1)
        .get();
        
      if (emailSnapshot.empty) {
        await mailingListRef.add({
          email,
          subscribed: true,
          source: 'app_request',
          timestamp
        });
      }
    } catch (mailingListError) {
      console.error('Error adding to mailing list:', mailingListError);
      // Continue execution - this should not fail the main request
    }
    
    res.status(200).json({ success: true, message: 'App request received' });
    
  } catch (error) {
    console.error('Error processing app request:', error);
    res.status(500).json({ error: 'Failed to process app request' });
  }
});

// Protected routes - after public routes
app.use('/', cardRoutes);
app.use('/', meetingRoutes);
app.use('/', paymentRoutes);
app.use('/api/tickets', ticketRoutes);

// Modify the user creation route to handle file upload
app.post('/api/users', handleSingleUpload('profileImage'), (req, res, next) => {
  if (req.file && req.file.firebaseUrl) {
    req.body.profileImage = req.file.firebaseUrl;
  }
  next();
});

// Example usage in a route:
app.post('/send-email', async (req, res) => {
  try {
    console.log('Received email request:', req.body);
    
    if (!req.body.to || !req.body.subject) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (to, subject)',
      });
    }

    const mailOptions = {
      to: req.body.to,
      subject: req.body.subject,
      text: req.body.text || '',
      html: req.body.html || ''
    };

    const result = await sendMailWithStatus(mailOptions);
    console.log('Email send attempt completed:', result);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        details: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        details: result
      });
    }
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({
      success: false,
      message: 'Email sending failed',
      error: {
        message: error.message,
        code: error.code,
        command: error.command
      }
    });
  }
});

/**
 * Check if IP is rate limited for captcha attempts
 * @param {string} ip - The client IP address
 * @returns {boolean} - Whether the IP is rate limited
 */
const isRateLimited = (ip) => {
  const now = Date.now();
  const attempts = failedCaptchaAttempts.get(ip) || [];
  
  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(timestamp => 
    now - timestamp < CAPTCHA_RATE_LIMIT.windowMs
  );
  
  // Update attempts for this IP
  failedCaptchaAttempts.set(ip, recentAttempts);
  
  return recentAttempts.length >= CAPTCHA_RATE_LIMIT.maxAttempts;
};

/**
 * Record a failed captcha attempt
 * @param {string} ip - The client IP address
 */
const recordFailedAttempt = (ip) => {
  const now = Date.now();
  const attempts = failedCaptchaAttempts.get(ip) || [];
  attempts.push(now);
  failedCaptchaAttempts.set(ip, attempts);
};

/**
 * Verify hCaptcha token
 * @param {string} token - The hCaptcha token from the frontend
 * @param {string} ip - The client IP address for rate limiting
 * @returns {Promise<boolean>} - Whether the captcha is valid
 */
const verifyHCaptcha = async (token, ip) => {
  try {
    // Check rate limiting first
    if (isRateLimited(ip)) {
      console.log(`IP ${ip} is rate limited for captcha attempts`);
      return false;
    }

    if (!token) {
      console.log('No hCaptcha token provided');
      recordFailedAttempt(ip);
      return false;
    }

    const secretKey = process.env.HCAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error('HCAPTCHA_SECRET_KEY not configured');
      return false;
    }
    
    console.log('Using hCaptcha secret key:', secretKey.substring(0, 10) + '...');
    console.log('Verifying token:', token.substring(0, 20) + '...');

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const response = await axios.post('https://hcaptcha.com/siteverify', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('hCaptcha verification response:', response.data);
    
    if (response.data.success !== true) {
      recordFailedAttempt(ip);
    }
    
    return response.data.success === true;
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    recordFailedAttempt(ip);
    return false;
  }
};

// Cleanup expired blacklisted tokens every 24 hours
setInterval(async () => {
    try {
        const blacklistRef = db.collection('tokenBlacklist');
        const now = new Date();
        const snapshot = await blacklistRef
            .where('expiresAt', '<=', now)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error('Error cleaning up token blacklist:', error);
    }
}, 10 * 60 * 1000);

// Import jobs
const jobs = require('./jobs');

// Error handler
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).send({
        message: 'Internal Server Error',
        error: {
            code: error.code || 500,
            message: error.message,
            details: error.details || error.toString()
        }
    });
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`XS Card Server is running on http://localhost:${port}`);
    console.log(`API Documentation available at http://localhost:${port}/docs`);
    
    // Validate RevenueCat configuration
    const { validateConfig } = require('./config/revenueCatConfig');
    console.log('\n🔧 Validating RevenueCat configuration...');
    validateConfig();
    console.log('');
    
    // Start all scheduled jobs
    jobs.startAllJobs(db);
});

// Initialize WebSocket Service (Phase 2)
const SocketService = require('./services/socketService');
const socketService = new SocketService(server);

// Make socket service available globally for event broadcasting
global.socketService = socketService;

console.log('🚀 WebSocket service initialized and ready for Phase 2 event broadcasting');

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
