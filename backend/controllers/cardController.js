const { db, admin } = require('../firebase.js');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const config = require('../config/config');
const { formatDate } = require('../utils/dateFormatter');

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
            phone,
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
    const { platform, templateId = 'basic' } = req.query;

    try {
        console.log('Creating wallet pass for:', { userId, cardIndex, platform, templateId });

        // Import wallet pass service
        const WalletPassService = require('../services/walletPassService');
        const walletService = new WalletPassService();

        // Get card data from Firestore
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

        // Get user's subscription plan for template selection
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userPlan = userDoc.exists ? (userDoc.data().plan || 'free') : 'free';

        // Create save contact URL
        const saveContactUrl = `${req.protocol}://${req.get('host')}/saveContact?userId=${userId}&cardIndex=${cardIndex}`;

        // Detect platform if not specified
        let detectedPlatform = platform;
        if (!detectedPlatform) {
            const userAgent = req.get('User-Agent') || '';
            if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
                detectedPlatform = 'ios';
            } else if (userAgent.includes('Android')) {
                detectedPlatform = 'android';
            } else {
                // Default to iOS for unknown platforms
                detectedPlatform = 'ios';
            }
        }

        console.log('Detected platform:', detectedPlatform);

        // Generate wallet pass
        const passResult = await walletService.generatePass(
            detectedPlatform,
            card,
            userId,
            parseInt(cardIndex),
            userPlan,
            templateId,
            saveContactUrl
        );

        // Add mock mode header if applicable
        if (passResult.mockMode) {
            res.setHeader('X-Mock-Mode', 'true');
            console.log('[Mock Mode] Sending mock wallet pass');
        }

        // Handle platform-specific responses
        if (detectedPlatform === 'ios') {
            // Return .pkpass file directly
            res.setHeader('Content-Type', passResult.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${passResult.filename}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.status(200).send(passResult.data);
        } else if (detectedPlatform === 'android') {
            // Check if it's mock mode (JSON) or production (URL)
            if (passResult.mockMode) {
                // Return JSON file for mock mode
                res.setHeader('Content-Type', passResult.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${passResult.filename}"`);
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.status(200).send(passResult.data);
            } else {
                // Return Google Wallet save URL for production
                res.status(200).send({
                    message: 'Google Wallet pass created successfully',
                    saveUrl: passResult.data,
                    platform: 'android',
                    cardIndex: cardIndex,
                    templateId: templateId,
                    mockMode: false
                });
            }
        } else {
            throw new Error(`Unsupported platform: ${detectedPlatform}`);
        }

    } catch (error) {
        console.error('Error creating wallet pass:', error);

        // Handle specific error types
        if (error.message.includes('certificates not properly configured')) {
            return res.status(500).send({
                message: 'Apple Wallet certificates not configured',
                error: 'Please contact support to configure Apple Wallet certificates',
                details: 'Apple Wallet requires valid certificates for pass signing'
            });
        }

        if (error.message.includes('service account not properly configured')) {
            return res.status(500).send({
                message: 'Google Wallet service account not configured',
                error: 'Please contact support to configure Google Wallet service account',
                details: 'Google Wallet requires a valid service account for API access'
            });
        }

        // Generic error response
        res.status(500).send({
            message: 'Failed to create wallet pass',
            error: error.message,
            details: 'Please try again later or contact support if the issue persists'
        });
    }
};

exports.previewWalletPass = async (req, res) => {
    const { userId, cardIndex = 0 } = req.params;

    try {
        console.log('Generating wallet pass preview for:', { userId, cardIndex });

        // Get card data from Firestore
        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        if (!cardDoc.exists) {
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        const card = cardsData.cards[cardIndex];

        // Get user's subscription plan
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userPlan = userDoc.exists ? (userDoc.data().plan || 'free') : 'free';

        // Create save contact URL
        const saveContactUrl = `${req.protocol}://${req.get('host')}/saveContact?userId=${userId}&cardIndex=${cardIndex}`;

        // Generate QR code data URL
        const QRCode = require('qrcode');
        const qrCodeDataUrl = await QRCode.toDataURL(saveContactUrl);

        // Build preview data with direct field mapping (no template dependency)
        const previewData = {
            mockMode: process.env.WALLET_MOCK_MODE === 'true',
            cardData: {
                name: card.name,
                surname: card.surname,
                company: card.company,
                occupation: card.occupation,
                email: card.email,
                phone: card.phone,
                profileImage: card.profileImage,
                companyLogo: card.companyLogo,
                colorScheme: card.colorScheme || '#1B2B5B'
            },
            passStructure: {
                primary: [
                    {
                        label: 'Name',
                        value: `${card.name || ''} ${card.surname || ''}`.trim()
                    },
                    {
                        label: 'Title',
                        value: card.occupation || 'N/A'
                    },
                    {
                        label: 'Company',
                        value: card.company || 'N/A'
                    },
                    {
                        label: 'Email',
                        value: card.email || 'N/A'
                    },
                    {
                        label: 'Phone',
                        value: card.phone || 'N/A'
                    }
                ]
            },
            barcode: {
                type: 'QR_CODE',
                value: saveContactUrl,
                dataUrl: qrCodeDataUrl
            },
            template: {
                id: 'basic',
                name: 'Basic Template',
                backgroundColor: card.colorScheme || '#1B2B5B',
                foregroundColor: '#ffffff'
            },
            userPlan: userPlan,
            availableTemplates: ['basic']
        };

        res.status(200).send(previewData);

    } catch (error) {
        console.error('Error generating wallet pass preview:', error);
        res.status(500).send({
            message: 'Failed to generate preview',
            error: error.message
        });
    }
};
