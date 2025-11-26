const { db, admin } = require('../firebase.js');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const config = require('../config/config');
const { formatDate } = require('../utils/dateFormatter');
const { normalizePhone, ensurePhoneAvailable, PHONE_ERROR_CODE } = require('../utils/phoneUtils');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Shared error response helper
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        message,
        ...(error && { error: error.message })
    });
};

// Shared validation helper
const validateUserAccess = async (userId, userUid) => {
    if (userUid !== userId) {
        throw new Error('Unauthorized access');
    }
};

// Add this function at the top with other helper functions
const logPasscreatorConfig = () => {
  console.log('=== Passcreator Configuration ===');
  console.log('PASSCREATOR_BASE_URL:', process.env.PASSCREATOR_BASE_URL || 'Not set');
  console.log('PASSCREATOR_TEMPLATE_ID:', process.env.PASSCREATOR_TEMPLATE_ID || 'Not set');
  console.log('PASSCREATOR_API_KEY:', process.env.PASSCREATOR_API_KEY ? '✓ Present' : '✗ Missing');
  console.log('PASSCREATOR_PUBLIC_URL:', config.PASSCREATOR_PUBLIC_URL || 'Not set');
  console.log('==============================');
};

exports.getAllCards = async (req, res) => {
    try {
        console.log('Fetching all cards...');
        const cardsRef = db.collection('cards');
        const snapshot = await cardsRef.get();
        
        if (snapshot.empty) {
            console.log('No cards found in collection');
            return res.status(404).send({ message: 'No cards found' });
        }

        const cards = [];
        snapshot.forEach(doc => {
            cards.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Found ${cards.length} cards`);
        res.status(200).send(cards);
    } catch (error) {
        sendError(res, 500, 'Error fetching cards', error);
    }
};

exports.getCardById = async (req, res) => {
    const { id } = req.params;
    try {
        // Get the card document
        const cardRef = db.collection('cards').doc(id);
        const doc = await cardRef.get();
        
        if (!doc.exists || !doc.data().cards) {
            return res.status(404).send({ message: 'No cards found for this user' });
        }

        // Convert Firestore timestamps to readable dates
        const data = doc.data();
        let cards = [];
        
        if (data.cards) {
            cards = data.cards.map(card => ({
                ...card,
                createdAt: formatDate(card.createdAt), // Format for display
                scans: card.scans || 0 // Initialize scans field if missing
            }));
        }
        
        // Calculate total scans across all cards
        const totalScans = cards.reduce((sum, card) => sum + (card.scans || 0), 0);
        
        // Check user's subscription plan
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Only check if the plan is free, ignore subscription status
            const isFreePlan = userData.plan === 'free';
            
            if (isFreePlan && cards.length > 1) {
                // For free users, only return the first card but still calculate total scans from visible card
                const visibleCards = [cards[0]];
                const visibleTotalScans = visibleCards.reduce((sum, card) => sum + (card.scans || 0), 0);
                
                // Include analytics summary for free users
                return res.status(200).send({
                    cards: visibleCards,
                    analytics: {
                        totalScans: visibleTotalScans,
                        cardsVisible: 1,
                        cardsTotal: cards.length
                    }
                });
            }
        }
        
        // For premium users or users with only one card, return all cards with full analytics
        res.status(200).send({
            cards: cards,
            analytics: {
                totalScans: totalScans,
                cardsVisible: cards.length,
                cardsTotal: cards.length,
                averageScansPerCard: cards.length > 0 ? Math.round(totalScans / cards.length) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching card:', error);
        res.status(500).send({ message: 'Error fetching card', error: error.message });
    }
};

exports.addCard = async (req, res) => {
    try {
        const userId = req.user.uid;
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized access - no user ID' 
            });
        }

        // Enhanced debug logging
        console.log('Request headers:', req.headers);
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);
        console.log('Firebase Storage URLs:', req.firebaseStorageUrls);

        const { 
            company, 
            email, 
            phone, 
            title, 
            name,
            surname
        } = req.body;

        // Validate fields are not only present but also have values
        const requiredFields = ['company', 'email', 'phone', 'title'];
        const missingFields = requiredFields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || value === '';
        });
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields', 
                missingFields,
                receivedFields: req.body // Add this to see what fields were actually received
            });
        }

        const normalizedPhone = normalizePhone(phone);
        await ensurePhoneAvailable(db, normalizedPhone, userId);

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        // Handle file URLs from Firebase Storage
        let profileImageUrl = null;
        let companyLogoUrl = null;

        if (req.firebaseStorageUrls) {
            profileImageUrl = req.firebaseStorageUrls.profileImage || null;
            companyLogoUrl = req.firebaseStorageUrls.companyLogo || null;
        }

        const newCard = {
            company,
            email,
            phone: normalizedPhone,
            phoneNormalized: normalizedPhone,
            occupation: title,
            name: name || '',
            surname: surname || '',
            socials: {},
            colorScheme: '#1B2B5B',
            createdAt: admin.firestore.Timestamp.now(), // Store as Firestore Timestamp
            profileImage: profileImageUrl,
            companyLogo: companyLogoUrl
        };

        console.log('Creating new card:', newCard); // Debug log

        if (cardDoc.exists) {
            await cardRef.update({
                cards: admin.firestore.FieldValue.arrayUnion(newCard)
            });
        } else {
            await cardRef.set({
                cards: [newCard]
            });
        }
        
        // Format the response
        const responseCard = {
            ...newCard,
            createdAt: formatDate(newCard.createdAt) // Format for display
        };
        
        res.status(201).json({ 
            success: true,
            message: 'Card added successfully',
            cardData: responseCard
        });
    } catch (error) {
        console.error('Error in addCard:', error); // Debug log

        if (error.code === PHONE_ERROR_CODE) {
            return res.status(error.status || 409).json({
                success: false,
                message: error.message,
                code: error.code,
                conflictUserId: error.conflictUserId || null
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error adding card',
            error: error.message
        });
    }
};

// Update the updateCard function to handle both JSON and multipart/form-data
exports.updateCard = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex = 0 } = req.query;

    try {
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        let updateData = {};

        // Handle file upload using Firebase Storage
        if (req.file && req.file.firebaseUrl) {
            if (req.body.imageType === 'profileImage') {
                updateData.profileImage = req.file.firebaseUrl;
            } else if (req.body.imageType === 'companyLogo') {
                updateData.companyLogo = req.file.firebaseUrl;
            }
        } else if (req.body) {
            // If no file but has body data, it's a regular update
            updateData = JSON.parse(JSON.stringify(req.body));
        }

        if (updateData.phone) {
            const normalizedPhone = normalizePhone(updateData.phone);
            await ensurePhoneAvailable(db, normalizedPhone, userId);
            updateData.phone = normalizedPhone;
            updateData.phoneNormalized = normalizedPhone;
        }

        // Update the specific card in the array
        const updatedCards = [...cardsData.cards];
        updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            ...updateData
        };

        // Update the document
        await cardRef.update({
            cards: updatedCards
        });

        res.status(200).send({ 
            message: 'Card updated successfully',
            updatedCard: updatedCards[cardIndex]
        });
    } catch (error) {
        console.error('Update card error:', error);

        if (error.code === PHONE_ERROR_CODE) {
            return res.status(error.status || 409).send({
                message: error.message,
                code: error.code,
                conflictUserId: error.conflictUserId || null
            });
        }

        res.status(500).send({
            message: 'Failed to update card',
            error: error.message
        });
    }
};

exports.deleteCard = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex } = req.query;
    
    try {
        console.log('Delete request received:', { userId, cardIndex }); // Debug log

        // Ensure proper content type is set
        res.setHeader('Content-Type', 'application/json');

        // Validate cardIndex
        const parsedIndex = parseInt(cardIndex);
        if (isNaN(parsedIndex)) {
            console.log('Invalid card index:', cardIndex); // Debug log
            return res.status(400).json({ 
                success: false,
                message: 'Invalid card index'
            });
        }

        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();
        
        if (!doc.exists) {
            console.log('User cards not found for:', userId); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'User cards not found' 
            });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !Array.isArray(cardsData.cards)) {
            console.log('No cards array found for user:', userId); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'No cards found for user' 
            });
        }

        if (parsedIndex < 0 || parsedIndex >= cardsData.cards.length) {
            console.log('Card index out of range:', { parsedIndex, totalCards: cardsData.cards.length }); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'Card index out of range' 
            });
        }

        // Remove the card at the specified index
        const updatedCards = cardsData.cards.filter((_, index) => index !== parsedIndex);

        // Update the document with the modified array
        await cardRef.update({
            cards: updatedCards
        });

        // Format the cards before sending
        const formattedCards = updatedCards.map(card => ({
            ...card,
            createdAt: {
                _seconds: card.createdAt?._seconds || 0,
                _nanoseconds: card.createdAt?._nanoseconds || 0
            }
        }));

        console.log('Card deleted successfully:', { userId, cardIndex, remainingCards: updatedCards.length }); // Debug log

        // Return success response with formatted cards array
        const response = {
            success: true,
            message: 'Card deleted successfully',
            cards: formattedCards,
            deletedCardIndex: parsedIndex
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Delete card error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete card',
            error: error.message
        });
    }
};

exports.generateQR = async (req, res) => {
    const { userId, cardIndex } = req.params;
    
    try {
        await validateUserAccess(userId, req.user.uid);

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();
        
        if (!cardDoc.exists) {
            return sendError(res, 404, 'User cards not found');
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return sendError(res, 404, 'Card not found at specified index');
        }

        // Create URL with both userId and cardIndex
        const redirectUrl = `${req.protocol}://${req.get('host')}/saveContact?userId=${userId}&cardIndex=${cardIndex}`;
        
        // Generate QR code with better quality settings
        const qrCodeBuffer = await QRCode.toBuffer(redirectUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.setHeader('Content-Type', 'image/png');
        res.status(200).send(qrCodeBuffer);
    } catch (error) {
        sendError(res, error.message === 'Unauthorized access' ? 403 : 500, 
            'Failed to generate QR code', error);
    }
};

exports.updateCardColor = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex } = req.query;
    const { color } = req.body;
    
    if (!cardIndex && cardIndex !== 0) {
        return res.status(400).send({ message: 'Card index is required' });
    }

    if (!color) {
        return res.status(400).send({ message: 'Color is required' });
    }

    try {
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        // Update the color of the specific card
        const updatedCards = [...cardsData.cards];
        updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            colorScheme: color
        };

        // Update the document with the modified array
        await cardRef.update({
            cards: updatedCards
        });

        res.status(200).send({ 
            message: 'Card color updated successfully',
            color,
            cardIndex: cardIndex
        });
    } catch (error) {
        sendError(res, 500, 'Failed to update card color', error);
    }
};

exports.createWalletPass = async (req, res) => {
    const { userId, cardIndex = 0 } = req.params;
    const { skipImages } = req.query;

    try {
        // Log configuration before making the request
        logPasscreatorConfig();
        console.log('\nCreating wallet pass for:', { userId, cardIndex });

        // Validate required environment variables
        if (!process.env.PASSCREATOR_BASE_URL || 
            !process.env.PASSCREATOR_TEMPLATE_ID || 
            !process.env.PASSCREATOR_API_KEY || 
            !config.PASSCREATOR_PUBLIC_URL) {
            throw new Error('Missing required Passcreator configuration');
        }

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        if (!cardDoc.exists) {
            console.log('Card document not found for userId:', userId);
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            console.log('Card not found at index:', cardIndex);
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        const card = cardsData.cards[cardIndex];
        
        // Check if we should skip images
        const isLocalIp = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(config.PASSCREATOR_PUBLIC_URL);
        const shouldSkipImages = skipImages === 'true' || isLocalIp;
        
        // Prepare pass data
        const passData = {
            name: `${card.name} ${card.surname}`,
            company: card.company,
            jobTitle: card.occupation,
            barcodeValue: `${config.PASSCREATOR_PUBLIC_URL}/saveContact?userId=${userId}&cardIndex=${cardIndex}`
        };

        // Add images only if we shouldn't skip them
        if (!shouldSkipImages) {
            if (card.profileImage) {
                passData.urlToThumbnail = card.profileImage;
            }
            if (card.companyLogo) {
                passData.urlToLogo = card.companyLogo;
            }
        }

        // Make a single API call with the correct data
        const response = await axios.post(
            `${process.env.PASSCREATOR_BASE_URL}/api/pass?passtemplate=${process.env.PASSCREATOR_TEMPLATE_ID}&zapierStyle=true`,
            passData,
            {
                headers: {
                    'Authorization': process.env.PASSCREATOR_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Passcreator API Response:', {
            uri: response.data.uri,
            fileUrl: response.data.linkToPassFile,
            pageUrl: response.data.linkToPassPage,
            identifier: response.data.identifier
        });

        res.status(200).send({
            message: 'Wallet pass created successfully',
            passUri: response.data.uri,
            passFileUrl: response.data.linkToPassFile,
            passPageUrl: response.data.linkToPassPage,
            identifier: response.data.identifier,
            cardIndex: cardIndex,
            imagesIncluded: !shouldSkipImages,
            warning: shouldSkipImages ? 'Images were skipped due to local development environment or query parameter.' : null
        });

    } catch (error) {
        console.error('Error creating wallet pass:', {
            message: error.message,
            response: error.response?.data,
            config: error.config
        });

        // Check if error is due to image access issue
        if (error.response?.data?.ErrorMessage === 'Thumbnail could not be imported from given URL') {
            try {
                // Try again without images
                console.log('Retrying without images...');
                
                const card = (await db.collection('cards').doc(userId).get()).data().cards[cardIndex];
                
                const passData = {
                    name: `${card.name} ${card.surname}`,
                    company: card.company,
                    jobTitle: card.occupation,
                    barcodeValue: `${config.PASSCREATOR_PUBLIC_URL}/saveContact?userId=${userId}&cardIndex=${cardIndex}`
                };
                
                const response = await axios.post(
                    `${process.env.PASSCREATOR_BASE_URL}/api/pass?passtemplate=${process.env.PASSCREATOR_TEMPLATE_ID}&zapierStyle=true`,
                    passData,
                    {
                        headers: {
                            'Authorization': process.env.PASSCREATOR_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                return res.status(200).send({
                    message: 'Wallet pass created successfully without images',
                    passUri: response.data.uri,
                    passFileUrl: response.data.linkToPassFile,
                    passPageUrl: response.data.linkToPassPage,
                    identifier: response.data.identifier,
                    cardIndex: cardIndex,
                    imagesIncluded: false,
                    warning: 'Images could not be accessed by the wallet service and were omitted.'
                });
                
            } catch (retryError) {
                console.error('Error retrying without images:', retryError);
                return res.status(500).send({
                    message: 'Failed to create wallet pass after retrying without images',
                    error: retryError.message,
                    details: 'Please try again later or contact support.'
                });
            }
        }

        // Extract specific error message if available
        let errorMessage = 'Failed to create wallet pass';
        let detailedError = 'No additional details available';
        
        if (error.response?.data) {
            if (error.response.data.ErrorMessage) {
                errorMessage = error.response.data.ErrorMessage;
                detailedError = 'Please try again or contact support.';
            } else {
                detailedError = JSON.stringify(error.response.data);
            }
        }

        // Send a more user-friendly error response
        res.status(500).send({
            message: errorMessage,
            error: error.message,
            details: detailedError
        });
    }
};
