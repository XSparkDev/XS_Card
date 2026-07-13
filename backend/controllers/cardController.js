const { db, admin } = require('../firebase.js');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const config = require('../config/config');
const { formatDate } = require('../utils/dateFormatter');
const { normalizePhone, ensurePhoneAvailable, PHONE_ERROR_CODE } = require('../utils/phoneUtils');
const { getPublicBaseUrl } = require('../utils/publicBaseUrl');

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

const normalizeSpeakerCards = (cards = []) => {
    let speakerCardFound = false;
    let didNormalize = false;

    const normalizedCards = cards.map((card) => {
        const isSpeakerCard =
            card?.isSpeakerEngagementCard === true ||
            card?.isSpeakerEngagementCard === 'true';

        if (!isSpeakerCard) {
            if (card?.isSpeakerEngagementCard === 'false') {
                didNormalize = true;
                return {
                    ...card,
                    isSpeakerEngagementCard: false
                };
            }

            return card;
        }

        if (!speakerCardFound) {
            speakerCardFound = true;

            if (card?.isSpeakerEngagementCard !== true) {
                didNormalize = true;
                return {
                    ...card,
                    isSpeakerEngagementCard: true
                };
            }

            return card;
        }

        didNormalize = true;
        return {
            ...card,
            isSpeakerEngagementCard: false
        };
    });

    return {
        normalizedCards,
        didNormalize
    };
};

// Speaker & Engagement activity windows: record exactly when each card was an
// active speaker card. A window opens when the card becomes a speaker and
// closes when it stops. CSV export only counts contacts captured inside a
// window. Idempotent — safe to run on every card-array write, only acts on a
// real on/off transition. Shared by addCard (a card can start out as the
// speaker card from creation) and updateCard (the toggle endpoint) so neither
// path can leave a card's window state un-recorded.
const reconcileSpeakerWindow = (card, now) => {
    const isSpeaker = card.isSpeakerEngagementCard === true || card.isSpeakerEngagementCard === 'true';
    const windows = Array.isArray(card.speakerWindows) ? card.speakerWindows.map((w) => ({ ...w })) : [];
    const last = windows[windows.length - 1];
    const hasOpenWindow = last && (last.end === null || last.end === undefined);

    if (isSpeaker && !hasOpenWindow) {
        windows.push({ start: now, end: null });
        return { ...card, speakerWindows: windows };
    }
    if (!isSpeaker && hasOpenWindow) {
        windows[windows.length - 1] = { ...last, end: now };
        return { ...card, speakerWindows: windows };
    }
    return card;
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
        
        const { normalizedCards, didNormalize } = normalizeSpeakerCards(data.cards || []);

        // Self-heal missing speaker windows on read too, not just on save. A card
        // that was already marked as the speaker card before this windowing system
        // existed (or one whose isSpeakerEngagementCard was set by some other path)
        // would otherwise never get a window opened until the user happens to save
        // an edit — leaving its CSV export permanently empty in the meantime. Opening
        // the window the moment we observe it's missing means tracking starts now
        // (the earliest honest cutoff we can know), never a fabricated past date.
        const speakerWindowNow = new Date().toISOString();
        const reconciledCards = normalizedCards.map((card) => reconcileSpeakerWindow(card, speakerWindowNow));
        const windowsChanged = reconciledCards.some(
            (card, i) => card.speakerWindows !== normalizedCards[i].speakerWindows
        );

        if (didNormalize || windowsChanged) {
            await cardRef.update({
                cards: reconciledCards
            });
        }

        if (reconciledCards) {
            cards = reconciledCards.map(card => ({
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

        const userDoc = await db.collection('users').doc(userId).get();
        const userPlan = String(userDoc.data()?.plan || 'free').toLowerCase();
        const hasSpeakerCardAccess = ['premium', 'enterprise'].includes(userPlan);
        const hasAltNumberAccess = ['premium', 'enterprise'].includes(userPlan);

        // Enhanced debug logging
        console.log('Request headers:', req.headers);
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);
        console.log('Firebase Storage URLs:', req.firebaseStorageUrls);

        const {
            cardName,
            company,
            email,
            phone,
            title,
            name,
            surname,
            altNumber,
            altCountryCode,
            showAltNumber,
            // Salutation (Mr./Mrs./Dr./...) — named distinctly from `title` above,
            // which (confusingly, for historical reasons) carries the job title/occupation.
            salutation,
            qualification
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

        // Parse alt number fields from FormData (handle string 'true'/'false' for showAltNumber)
        const parsedShowAltNumber = showAltNumber === 'true' || showAltNumber === true;
        const enforcedShowAltNumber = hasAltNumberAccess ? parsedShowAltNumber : false;

        // Premium-only validation: showAltNumber requires altNumber
        if (hasAltNumberAccess && enforcedShowAltNumber) {
            const trimmedAlt = String(altNumber || '').trim();
            if (!trimmedAlt) {
                return res.status(400).json({
                    success: false,
                    message: 'Alternative number is required when showAltNumber is enabled.'
                });
            }
        }
        const isSpeakerEngagementCard =
            hasSpeakerCardAccess &&
            (req.body.isSpeakerEngagementCard === 'true' || req.body.isSpeakerEngagementCard === true);
        
        const newCard = {
            cardName: (cardName || '').trim(),
            company,
            email,
            phone: normalizedPhone,
            phoneNormalized: normalizedPhone,
            occupation: title,
            name: name || '',
            surname: surname || '',
            salutation: (salutation || '').trim(),
            qualification: (qualification || '').trim(),
            socials: {},
            colorScheme: '#1B2B5B',
            createdAt: admin.firestore.Timestamp.now(), // Store as Firestore Timestamp
            profileImage: profileImageUrl,
            companyLogo: companyLogoUrl,
            altNumber: hasAltNumberAccess ? (altNumber || '') : '',
            altCountryCode: hasAltNumberAccess ? (altCountryCode || '+27') : '+27',
            showAltNumber: enforcedShowAltNumber || false,
            isSpeakerEngagementCard
        };

        console.log('Creating new card:', newCard); // Debug log

        // Record the toggle-on cutoff for the new card if it's created as the speaker
        // card directly, and close out any existing card's window it displaces — a
        // card created already-active never had its own updateCard PATCH to open a
        // window, so without this the CSV export would have no window to match against
        // and would always come back empty even when there are genuine post-creation scans.
        const speakerWindowNow = new Date().toISOString();

        if (cardDoc.exists) {
            const existingCards = Array.isArray(cardDoc.data()?.cards) ? [...cardDoc.data().cards] : [];
            const { normalizedCards: sanitizedExistingCards } = normalizeSpeakerCards(existingCards);
            const normalizedCards = isSpeakerEngagementCard
                ? sanitizedExistingCards.map(card => ({ ...card, isSpeakerEngagementCard: false }))
                : sanitizedExistingCards;

            // Name, surname, salutation and qualification are canonical fields owned by
            // the primary card (index 0) — a new non-primary card always inherits them,
            // regardless of whatever was submitted for it.
            if (sanitizedExistingCards.length > 0) {
                const primaryCard = sanitizedExistingCards[0];
                newCard.name = primaryCard.name || '';
                newCard.surname = primaryCard.surname || '';
                newCard.salutation = primaryCard.salutation || '';
                newCard.qualification = primaryCard.qualification || '';
            }

            normalizedCards.push(newCard);

            const reconciledCards = normalizedCards.map((card) => reconcileSpeakerWindow(card, speakerWindowNow));

            await cardRef.update({
                cards: reconciledCards
            });
        } else {
            await cardRef.set({
                cards: [reconcileSpeakerWindow(newCard, speakerWindowNow)]
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

        const userDoc = await db.collection('users').doc(userId).get();
        const userPlan = String(userDoc.data()?.plan || 'free').toLowerCase();
        const hasSpeakerCardAccess = ['premium', 'enterprise'].includes(userPlan);
        const hasAltNumberAccess = ['premium', 'enterprise'].includes(userPlan);

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

        let phoneChangedForPrimaryCard = false;
        let newNormalizedPhone = null;
        if (Object.prototype.hasOwnProperty.call(updateData, 'phone')) {
            if (updateData.phone) {
                newNormalizedPhone = normalizePhone(updateData.phone);
                await ensurePhoneAvailable(db, newNormalizedPhone, userId);
                updateData.phone = newNormalizedPhone;
                updateData.phoneNormalized = newNormalizedPhone;
            } else {
                // Phone is being cleared
                updateData.phone = '';
                updateData.phoneNormalized = '';
                newNormalizedPhone = '';
            }
            // Sync users collection only for the primary card (index 0)
            if (Number(cardIndex) === 0) {
                phoneChangedForPrimaryCard = true;
            }
        }

        // ===== Name-change policy =====
        // First/last name may be changed ONLY on the primary card (index 0), and
        // at most once every 30 days. Enforced here authoritatively, independent
        // of the client. Non-primary card name edits are silently ignored.
        const NAME_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
        const existingCardForName = cardsData.cards[cardIndex] || {};
        const hasIncomingName = Object.prototype.hasOwnProperty.call(updateData, 'name');
        const hasIncomingSurname = Object.prototype.hasOwnProperty.call(updateData, 'surname');
        const incomingName = hasIncomingName ? String(updateData.name ?? '').trim() : undefined;
        const incomingSurname = hasIncomingSurname ? String(updateData.surname ?? '').trim() : undefined;
        const nameChanged =
            (incomingName !== undefined && incomingName !== String(existingCardForName.name ?? '').trim()) ||
            (incomingSurname !== undefined && incomingSurname !== String(existingCardForName.surname ?? '').trim());

        let stampNameChange = false;
        if (nameChanged) {
            if (Number(cardIndex) !== 0) {
                // Names are locked on non-primary cards — keep the existing values.
                delete updateData.name;
                delete updateData.surname;
            } else {
                const lastChanged = userDoc.data()?.nameLastChangedAt;
                const lastChangedMs =
                    lastChanged && typeof lastChanged.toMillis === 'function'
                        ? lastChanged.toMillis()
                        : (lastChanged ? new Date(lastChanged).getTime() : 0);
                const elapsed = Date.now() - lastChangedMs;

                if (lastChangedMs && elapsed < NAME_CHANGE_WINDOW_MS) {
                    const nextAllowedAt = new Date(lastChangedMs + NAME_CHANGE_WINDOW_MS);
                    const daysLeft = Math.max(1, Math.ceil((NAME_CHANGE_WINDOW_MS - elapsed) / (24 * 60 * 60 * 1000)));
                    return res.status(403).send({
                        message: `You can only change your name once every 30 days. Please try again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
                        code: 'NAME_CHANGE_TOO_SOON',
                        nextAllowedAt: nextAllowedAt.toISOString(),
                    });
                }
                stampNameChange = true;
            }
        }

        // Salutation (Mr./Mrs./Dr./...) and qualification are also canonical,
        // primary-card-only fields, but unlike name/surname they carry no 30-day
        // throttle — only the primary-card restriction applies.
        if (Number(cardIndex) !== 0) {
            delete updateData.salutation;
            delete updateData.qualification;
        }

        if (Object.prototype.hasOwnProperty.call(updateData, 'isSpeakerEngagementCard')) {
            if (hasSpeakerCardAccess) {
                updateData.isSpeakerEngagementCard =
                    updateData.isSpeakerEngagementCard === true ||
                    updateData.isSpeakerEngagementCard === 'true';
            } else {
                updateData.isSpeakerEngagementCard = Boolean(cardsData.cards[cardIndex].isSpeakerEngagementCard);
            }
        }

        // Alt number is Premium-only. For Free users: ignore altNumber/altCountryCode and force showAltNumber false.
        if (!hasAltNumberAccess) {
            if (Object.prototype.hasOwnProperty.call(updateData, 'altNumber')) {
                delete updateData.altNumber;
            }
            if (Object.prototype.hasOwnProperty.call(updateData, 'altCountryCode')) {
                delete updateData.altCountryCode;
            }
            updateData.showAltNumber = false;
        } else if (Object.prototype.hasOwnProperty.call(updateData, 'showAltNumber')) {
            updateData.showAltNumber =
                updateData.showAltNumber === true ||
                updateData.showAltNumber === 'true';
        }

        // Premium-only validation: if showAltNumber is true (incoming or existing), altNumber must be present.
        if (hasAltNumberAccess) {
            const nextShowAlt = Object.prototype.hasOwnProperty.call(updateData, 'showAltNumber')
                ? Boolean(updateData.showAltNumber)
                : Boolean(cardsData.cards[cardIndex]?.showAltNumber);

            if (nextShowAlt) {
                const nextAlt = Object.prototype.hasOwnProperty.call(updateData, 'altNumber')
                    ? String(updateData.altNumber || '').trim()
                    : String(cardsData.cards[cardIndex]?.altNumber || '').trim();

                if (!nextAlt) {
                    return res.status(400).send({
                        message: 'Alternative number is required when showAltNumber is enabled.'
                    });
                }
            }
        }

        // Update the specific card in the array
        const { normalizedCards: sanitizedExistingCards } = normalizeSpeakerCards(cardsData.cards || []);
        const updatedCards = [...sanitizedExistingCards];
        updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            ...updateData
        };

        if (updatedCards[cardIndex].isSpeakerEngagementCard) {
            for (let i = 0; i < updatedCards.length; i += 1) {
                if (i !== Number(cardIndex)) {
                    updatedCards[i] = {
                        ...updatedCards[i],
                        isSpeakerEngagementCard: false
                    };
                }
            }
        }

        // Name, surname, salutation and qualification are owned by the primary
        // card — mirror its current values onto every other card on every save
        // (not just when those fields were the ones being edited), so all cards
        // are always self-consistent regardless of which one triggered the write.
        const canonicalSource = updatedCards[0] || {};
        for (let i = 1; i < updatedCards.length; i += 1) {
            updatedCards[i] = {
                ...updatedCards[i],
                name: canonicalSource.name || '',
                surname: canonicalSource.surname || '',
                salutation: canonicalSource.salutation || '',
                qualification: canonicalSource.qualification || '',
            };
        }

        // Record the toggle-on/off cutoff for every card whose speaker status is
        // affected by this save (the edited card, plus any demoted on mutual-exclusivity).
        const speakerWindowNow = new Date().toISOString();
        for (let i = 0; i < updatedCards.length; i += 1) {
            updatedCards[i] = reconcileSpeakerWindow(updatedCards[i], speakerWindowNow);
        }

        // Update the document
        await cardRef.update({
            cards: updatedCards
        });

        // Sync users collection: phone (primary card) and/or name change stamp.
        // ensurePhoneAvailable queries users.phoneNormalized, so it must stay in
        // sync with the card — otherwise stale data lets another user claim a
        // number still in use, then blocks the original user from reclaiming it.
        if (phoneChangedForPrimaryCard || stampNameChange) {
            try {
                const usersUpdate = {};
                if (phoneChangedForPrimaryCard) {
                    usersUpdate.phone = newNormalizedPhone || '';
                    usersUpdate.phoneNormalized = newNormalizedPhone || '';
                }
                if (stampNameChange) {
                    usersUpdate.name = String(updatedCards[cardIndex].name ?? '');
                    usersUpdate.surname = String(updatedCards[cardIndex].surname ?? '');
                    usersUpdate.nameLastChangedAt = admin.firestore.Timestamp.now();
                }
                await db.collection('users').doc(userId).update(usersUpdate);
            } catch (userSyncError) {
                console.error('Failed to sync users collection after card update:', userSyncError);
            }
        }

        res.status(200).send({
            message: 'Card updated successfully',
            updatedCard: updatedCards[cardIndex],
            cards: updatedCards
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

// Restart the CSV lead list for a Speaker & Engagement Card. Premium-only.
// Closes whatever speaker window is currently open (if any) and opens a
// brand-new one starting now. CSV export only ever reads the LATEST window
// (see inCurrentSpeakerWindow on the client), so this makes every prior scan
// invisible to future exports without deleting any contact data, and without
// touching the card's QR code, isSpeakerEngagementCard flag, or anything else
// about the card. Future scans land in the new window and populate a fresh list.
exports.restartSpeakerWindow = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex = 0 } = req.query;

    try {
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = doc.data();
        const card = cardsData.cards && cardsData.cards[cardIndex];
        if (!card) {
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userPlan = String(userDoc.data()?.plan || 'free').toLowerCase();
        const hasSpeakerCardAccess = ['premium', 'enterprise'].includes(userPlan);

        if (!hasSpeakerCardAccess) {
            return res.status(403).send({
                message: 'Restarting the CSV list is a Premium feature',
                code: 'SPEAKER_CARD_PREMIUM_REQUIRED'
            });
        }

        const isSpeaker = card.isSpeakerEngagementCard === true || card.isSpeakerEngagementCard === 'true';
        if (!isSpeaker) {
            return res.status(400).send({ message: 'Card is not currently a Speaker & Engagement Card' });
        }

        const now = new Date().toISOString();
        const windows = Array.isArray(card.speakerWindows) ? card.speakerWindows.map((w) => ({ ...w })) : [];
        const last = windows[windows.length - 1];
        if (last && (last.end === null || last.end === undefined)) {
            windows[windows.length - 1] = { ...last, end: now };
        }
        windows.push({ start: now, end: null });

        const updatedCards = [...cardsData.cards];
        updatedCards[cardIndex] = {
            ...card,
            speakerWindows: windows
        };

        await cardRef.update({ cards: updatedCards });

        res.status(200).send({
            message: 'CSV list restarted — new scans will populate a fresh list',
            updatedCard: updatedCards[cardIndex],
            cards: updatedCards
        });
    } catch (error) {
        console.error('Restart speaker window error:', error);
        res.status(500).send({
            message: 'Failed to restart CSV list',
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
    const useNative = process.env.USE_NATIVE_WALLET === 'true';

    try {
        console.log('\nCreating wallet pass for:', { userId, cardIndex });

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

        // Detect platform from User-Agent.
        // Heuristic approach because React Native iOS requests often don't include 'iPhone'/'iPad'.
        const userAgent = (req.get('User-Agent') || req.headers['user-agent'] || '').toString();
        const uaLower = userAgent.toLowerCase();

        // Be conservative about classifying Android vs iOS.
        // React Native (especially iOS) can use HTTP clients that look like "okhttp"/"reactnative"
        // even on iOS, so treat as Android only when UA explicitly includes "android".
        const isAndroid = uaLower.includes('android');

        // Default to iOS when UA is missing/ambiguous to avoid misclassifying iOS as Android.
        const platform = isAndroid ? 'android' : 'ios';

        // Debug log to confirm platform detection during testing.
        console.log(
            '[WalletPass] User-Agent:',
            userAgent ? `${userAgent.slice(0, 160)}...` : '(empty)',
            '| isAndroid:',
            isAndroid,
            '| => platform:',
            platform
        );

        /*
        ========================================================================
          !!!  APPLE WALLET iOS — passPageUrl MUST STAY HTTPS + THIS PATH  !!!
        ========================================================================
          LOCKED: Non-aesthetic edits break Safari. passPageUrl must point at
          GET /wallet-passes/.../.pkpass (see server.js). Use getPublicBaseUrl.
          ONLY aesthetic: tweak success message strings, not URL shape or flow.
        ========================================================================
        */
        // iOS: native .pkpass URL (Passcreator removed).
        if (platform === 'ios') {
            // If the client requests it (e.g., local environment), omit image downloads during pass creation.
            const shouldSkipImages = skipImages === 'true';

            const base = getPublicBaseUrl(req);
            const passPageUrl = `${base}/wallet-passes/${encodeURIComponent(userId)}/${cardIndex}.pkpass` +
                (shouldSkipImages ? '?skipImages=true' : '');

            return res.status(200).send({
                message: 'Apple Wallet pass created successfully',
                passPageUrl,
                cardIndex: cardIndex,
                platform: 'ios',
                imagesIncluded: !shouldSkipImages,
                warning: shouldSkipImages ? 'Images were skipped due to local development environment or query parameter.' : null
            });
        }

        // Android: Google Wallet native only (no Passcreator fallback).
        if (!useNative) {
            return res.status(500).send({
                message: 'Google Wallet not enabled',
                details: 'Set USE_NATIVE_WALLET=true to create Android wallet passes.'
            });
        }

        try {
            const WalletPassService = require('../services/walletPassService');
            const walletService = new WalletPassService();

            const base = getPublicBaseUrl(req);
            const saveContactUrl = `${base}/saveContact?userId=${encodeURIComponent(userId)}&cardIndex=${cardIndex}`;
            const passResult = await walletService.generatePass(
                platform,
                card,
                userId,
                parseInt(cardIndex, 10),
                saveContactUrl
            );

            return res.status(200).send({
                message: 'Google Wallet pass created successfully',
                passPageUrl: passResult,
                cardIndex: cardIndex,
                platform: 'android'
            });
        } catch (nativeError) {
            console.error(`Error creating native ${platform} wallet pass:`, nativeError);

            // Return specific error messages for configuration issues
            if (nativeError.message.includes('service account not properly configured') ||
                nativeError.message.includes('certificates not properly configured')) {
                return res.status(500).send({
                    message: 'Google Wallet not configured',
                    error: nativeError.message
                });
            }

            return res.status(500).send({
                message: 'Failed to create Google Wallet pass',
                error: nativeError.message
            });
        }

    } catch (error) {
        console.error('Error creating wallet pass:', {
            message: error.message,
            response: error.response?.data,
            config: error.config
        });

        // Check if error is due to image access issue (Passcreator)
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
