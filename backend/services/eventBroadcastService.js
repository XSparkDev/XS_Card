const { db } = require('../firebase');

/**
 * Event Broadcasting Service - Safe WebSocket Integration
 * 
 * This service provides a non-invasive way to add real-time broadcasting
 * to existing event operations without risking existing functionality.
 * 
 * Key Safety Features:
 * - Never throws errors that could break HTTP responses
 * - Gracefully handles WebSocket service unavailability  
 * - Async/non-blocking broadcasts
 * - User preference filtering with safe fallbacks
 */
class EventBroadcastService {
    
    static broadcastFailureCount = 0;
    static MAX_FAILURES = 5;
    static CIRCUIT_BREAKER_RESET_TIME = 5 * 60 * 1000; // 5 minutes
    static lastFailureTime = null;

    /**
     * Safely broadcast new event to all relevant users
     * @param {Object} eventData - Event data to broadcast
     * @returns {Promise<boolean>} Success status (never throws)
     */
    static async broadcastNewEvent(eventData) {
        try {
            // Circuit breaker check
            if (this.isCircuitBreakerOpen()) {
                console.log('[EventBroadcast] Circuit breaker open, skipping broadcast');
                return false;
            }

            // Check if WebSocket service is available
            if (!global.socketService) {
                console.log('[EventBroadcast] WebSocket service not available, skipping broadcast');
                return false;
            }

            // Check if anyone is connected
            const connectedUsers = global.socketService.getConnectedUsersCount();
            if (connectedUsers === 0) {
                console.log('[EventBroadcast] No users connected, skipping broadcast');
                return true; // Not a failure, just no audience
            }

            console.log(`[EventBroadcast] Broadcasting new event "${eventData.title}" to ${connectedUsers} connected users`);

            // Broadcast with user preference filtering
            await this.broadcastWithPreferences('new_event', eventData);

            // Reset failure count on success
            this.broadcastFailureCount = 0;
            this.lastFailureTime = null;

            return true;

        } catch (error) {
            return this.handleBroadcastError('broadcastNewEvent', error);
        }
    }

    /**
     * Safely broadcast event update to relevant users
     * @param {Object} eventData - Updated event data
     * @param {string} updateType - Type of update (event_update, event_cancelled, etc.)
     * @returns {Promise<boolean>} Success status (never throws)
     */
    static async broadcastEventUpdate(eventData, updateType = 'event_update') {
        try {
            // Circuit breaker check
            if (this.isCircuitBreakerOpen()) {
                console.log('[EventBroadcast] Circuit breaker open, skipping update broadcast');
                return false;
            }

            // Check WebSocket service availability
            if (!global.socketService) {
                console.log('[EventBroadcast] WebSocket service not available, skipping update broadcast');
                return false;
            }

            const connectedUsers = global.socketService.getConnectedUsersCount();
            if (connectedUsers === 0) {
                console.log('[EventBroadcast] No users connected, skipping update broadcast');
                return true;
            }

            console.log(`[EventBroadcast] Broadcasting ${updateType} for event "${eventData.title}" to ${connectedUsers} connected users`);

            // For updates, we might want to notify only registered users
            if (updateType === 'event_update' || updateType === 'event_cancelled') {
                await this.broadcastToRegisteredUsers(updateType, eventData);
            } else {
                await this.broadcastWithPreferences(updateType, eventData);
            }

            // Reset failure count on success
            this.broadcastFailureCount = 0;
            this.lastFailureTime = null;

            return true;

        } catch (error) {
            return this.handleBroadcastError('broadcastEventUpdate', error);
        }
    }

    /**
     * Broadcast event registration updates
     * @param {Object} eventData - Event data
     * @param {Object} registrationData - Registration data
     * @returns {Promise<boolean>} Success status
     */
    static async broadcastRegistrationUpdate(eventData, registrationData) {
        try {
            if (!global.socketService || this.isCircuitBreakerOpen()) {
                return false;
            }

            const connectedUsers = global.socketService.getConnectedUsersCount();
            if (connectedUsers === 0) {
                console.log('[EventBroadcast] No users connected, skipping registration broadcast');
                return true;
            }

            console.log(`[EventBroadcast] Broadcasting registration update for event "${eventData.title}"`);

            // 1. Notify event organizer about new registration
            const organizerId = eventData.organizerId;
            if (global.socketService.isUserConnected(organizerId)) {
                await global.socketService.sendToUser(organizerId, 'new_registration', {
                    type: 'new_registration',
                    event: {
                        id: eventData.id,
                        title: eventData.title,
                        eventDate: eventData.eventDate,
                        currentAttendees: eventData.currentAttendees || 0,
                        maxAttendees: eventData.maxAttendees || -1
                    },
                    registration: {
                        id: registrationData.id,
                        userId: registrationData.userId,
                        userName: registrationData.userName || 'Unknown User',
                        registeredAt: registrationData.registeredAt || new Date().toISOString(),
                        status: registrationData.status || 'registered'
                    },
                    timestamp: new Date().toISOString()
                });
                
                console.log(`[EventBroadcast] Notified organizer ${organizerId} of new registration by ${registrationData.userName}`);
            }

            // 2. Broadcast general event update to interested users (updated attendee count)
            const eventUpdateData = {
                type: 'event_update',
                event: {
                    id: eventData.id,
                    title: eventData.title,
                    currentAttendees: eventData.currentAttendees || 0,
                    maxAttendees: eventData.maxAttendees || -1,
                    category: eventData.category,
                    eventType: eventData.eventType,
                    location: eventData.location
                },
                updateType: 'registration',
                message: `${registrationData.userName || 'Someone'} registered for this event`,
                timestamp: new Date().toISOString()
            };

            // Use preference-based broadcasting for the general update
            await this.broadcastWithPreferences('event_update', eventUpdateData.event, eventUpdateData);

            // Reset failure count on success
            this.broadcastFailureCount = 0;
            this.lastFailureTime = null;

            return true;

        } catch (error) {
            return this.handleBroadcastError('broadcastRegistrationUpdate', error);
        }
    }

    /**
     * Broadcast event unregistration updates
     * @param {Object} eventData - Event data
     * @param {Object} unregistrationData - Unregistration data
     * @returns {Promise<boolean>} Success status
     */
    static async broadcastUnregistrationUpdate(eventData, unregistrationData) {
        try {
            if (!global.socketService || this.isCircuitBreakerOpen()) {
                return false;
            }

            console.log(`[EventBroadcast] Broadcasting unregistration update for event "${eventData.title}"`);

            // 1. Notify event organizer about unregistration
            const organizerId = eventData.organizerId;
            if (global.socketService.isUserConnected(organizerId)) {
                await global.socketService.sendToUser(organizerId, 'event_unregistration', {
                    type: 'event_unregistration',
                    event: {
                        id: eventData.id,
                        title: eventData.title,
                        currentAttendees: eventData.currentAttendees || 0,
                        maxAttendees: eventData.maxAttendees || -1
                    },
                    unregistration: {
                        userId: unregistrationData.userId,
                        userName: unregistrationData.userName || 'Unknown User',
                        unregisteredAt: new Date().toISOString()
                    },
                    timestamp: new Date().toISOString()
                });
                
                console.log(`[EventBroadcast] Notified organizer ${organizerId} of unregistration by ${unregistrationData.userName}`);
            }

            // 2. Broadcast updated attendee count as event update
            const eventUpdateData = {
                type: 'event_update',
                event: {
                    id: eventData.id,
                    title: eventData.title,
                    currentAttendees: eventData.currentAttendees || 0,
                    maxAttendees: eventData.maxAttendees || -1,
                    category: eventData.category,
                    eventType: eventData.eventType,
                    location: eventData.location
                },
                updateType: 'unregistration',
                message: `${unregistrationData.userName || 'Someone'} unregistered from this event`,
                timestamp: new Date().toISOString()
            };

            await this.broadcastWithPreferences('event_update', eventUpdateData.event, eventUpdateData);

            return true;

        } catch (error) {
            return this.handleBroadcastError('broadcastUnregistrationUpdate', error);
        }
    }

    /**
     * Broadcast with user preference filtering
     * @private
     */
    static async broadcastWithPreferences(eventType, eventData, additionalData = null) {
        try {
            console.log(`[EventBroadcast] 📡 Starting preference-based broadcast for ${eventType}: "${eventData.title}"`);
            
            // Get all connected users
            const connectedUserIds = global.socketService.getConnectedUserIds();
            if (connectedUserIds.length === 0) {
                console.log('[EventBroadcast] No connected users for preference filtering');
                return;
            }

            console.log(`[EventBroadcast] 👥 Connected users: [${connectedUserIds.join(', ')}]`);
            console.log(`[EventBroadcast] 🔍 Filtering ${connectedUserIds.length} connected users by preferences`);

            // Get user preferences for all connected users
            const userPreferences = await this.getUserPreferencesForUsers(connectedUserIds);
            
            // Filter users based on preferences
            const eligibleUsers = await this.filterUsersByPreferences(connectedUserIds, userPreferences, eventData);
            
            console.log(`[EventBroadcast] 📊 ${eligibleUsers.length}/${connectedUserIds.length} users eligible for "${eventData.title}" notification`);
            console.log(`[EventBroadcast] 📤 Eligible users: [${eligibleUsers.join(', ')}]`);

            if (eligibleUsers.length === 0) {
                console.log('[EventBroadcast] ❌ No eligible users after preference filtering');
                return;
            }

            // Prepare broadcast data
            const broadcastData = additionalData || {
                type: eventType,
                event: {
                    id: eventData.id,
                    title: eventData.title,
                    description: eventData.description,
                    category: eventData.category,
                    eventDate: eventData.eventDate,
                    location: eventData.location,
                    organizerInfo: eventData.organizerInfo,
                    eventType: eventData.eventType,
                    ticketPrice: eventData.ticketPrice,
                    // Include image data for rich notifications
                    bannerImage: eventData.bannerImage,
                    images: eventData.images || [],
                    currentAttendees: eventData.currentAttendees || 0,
                    maxAttendees: eventData.maxAttendees || -1,
                    visibility: eventData.visibility || 'public'
                },
                timestamp: new Date().toISOString()
            };

            // Send to eligible users
            for (const userId of eligibleUsers) {
                if (global.socketService.isUserConnected(userId)) {
                    await global.socketService.sendToUser(userId, eventType, broadcastData);
                    console.log(`[EventBroadcast] ✅ Sent to user ${userId}`);
                } else {
                    console.log(`[EventBroadcast] ⚠️ User ${userId} no longer connected, skipping`);
                }
            }

            console.log(`[EventBroadcast] 🎉 Successfully sent ${eventType} notification to ${eligibleUsers.length} users`);

        } catch (error) {
            console.error('[EventBroadcast] 🚨 ERROR in preference-based broadcasting:', error);
            // Fallback to broadcasting to all users if preference filtering fails
            console.log('[EventBroadcast] 🔄 Falling back to broadcast to all connected users');
            await this.fallbackBroadcastToAll(eventType, eventData, additionalData);
        }
    }

    /**
     * Get user preferences for multiple users
     * @private
     */
    static async getUserPreferencesForUsers(userIds) {
        try {
            const userPreferences = new Map();
            const batchSize = 10; // Firestore batch limit

            // Process users in batches to avoid hitting Firestore limits
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const userDocs = await Promise.all(
                    batch.map(userId => db.collection('users').doc(userId).get())
                );

                userDocs.forEach((doc, index) => {
                    const userId = batch[index];
                    if (doc.exists) {
                        const userData = doc.data();
                        userPreferences.set(userId, {
                            eventPreferences: userData.eventPreferences || this.getDefaultPreferences(),
                            subscription: userData.plan || 'free'
                        });
                    } else {
                        // User not found, set default preferences
                        userPreferences.set(userId, {
                            eventPreferences: this.getDefaultPreferences(),
                            subscription: 'free'
                        });
                    }
                });
            }

            return userPreferences;

        } catch (error) {
            console.error('[EventBroadcast] Error fetching user preferences:', error);
            // Return default preferences for all users if there's an error
            const defaultPrefs = new Map();
            userIds.forEach(userId => {
                defaultPrefs.set(userId, {
                    eventPreferences: this.getDefaultPreferences(),
                    subscription: 'free'
                });
            });
            return defaultPrefs;
        }
    }

    /**
     * Filter users based on their preferences and subscription level
     * @private
     */
    static async filterUsersByPreferences(userIds, userPreferences, eventData) {
        const eligibleUsers = [];

        console.log(`[EventBroadcast] 🔍 Filtering for "${eventData.title}" (${eventData.category}, visibility: ${eventData.visibility})`);

        for (const userId of userIds) {
            const userPref = userPreferences.get(userId);
            if (!userPref) {
                console.log(`[EventBroadcast] ⚠️ No preferences found for user ${userId}, skipping`);
                continue;
            }

            const { eventPreferences, subscription } = userPref;
            
            console.log(`[EventBroadcast] 🧪 User ${userId}: ${subscription} plan`);

            // ✅ FIRST: Check event visibility permissions
            if (eventData.visibility === 'private') {
                // For private events, only broadcast to:
                // 1. The organizer
                // 2. Users who explicitly opted in to receive private event broadcasts
                if (eventData.organizerId === userId) {
                    console.log(`[EventBroadcast] ✅ Private event - user is the organizer`);
                } else if (eventPreferences.receivePrivateEventBroadcasts) {
                    console.log(`[EventBroadcast] ✅ Private event - user opted in to receive private broadcasts`);
                } else {
                    console.log(`[EventBroadcast] ❌ Private event - user has not opted in to receive private broadcasts`);
                    continue;
                }
            }

            if (eventData.visibility === 'invite-only') {
                // For invite-only events, only broadcast to:
                // 1. The organizer  
                // 2. Users in the attendeesList
                if (eventData.organizerId === userId) {
                    console.log(`[EventBroadcast] ✅ Invite-only event - user is the organizer`);
                } else if (eventData.attendeesList?.includes(userId)) {
                    console.log(`[EventBroadcast] ✅ Invite-only event - user is invited`);
                } else {
                    console.log(`[EventBroadcast] ❌ Invite-only event - user is not invited`);
                    continue;
                }
            }

            // ✅ SECOND: Apply standard notification preferences
            // Apply different filtering rules based on subscription level
            if (subscription === 'premium' || subscription === 'enterprise') {
                console.log(`[EventBroadcast] 🎯 PREMIUM user - applying smart filtering`);
                
                // 1. Check basic notification toggle for premium users
                if (!eventPreferences.receiveEventNotifications) {
                    console.log(`[EventBroadcast] ❌ Premium user has notifications disabled`);
                    continue;
                }

                // 2. Check specific notification type preferences for premium users  
                if (!eventPreferences.receiveNewEventBroadcasts) {
                    console.log(`[EventBroadcast] ❌ Premium user has event broadcasts disabled`);
                    continue;
                }

                // 3. Apply smart filtering for premium users
                if (!this.matchesUserPreferences(eventData, eventPreferences)) {
                    console.log(`[EventBroadcast] ❌ Event doesn't match premium user preferences`);
                    continue;
                }
                console.log(`[EventBroadcast] ✅ Premium user - event matches preferences`);
            } else {
                console.log(`[EventBroadcast] 🆓 FREE user - applying basic filtering`);
                
                // 1. Only respect the main notification toggle for free users
                // But allow them to get most events regardless of other toggles
                if (!eventPreferences.receiveEventNotifications) {
                    console.log(`[EventBroadcast] ❌ Free user has main notifications disabled`);
                    continue;
                }
                
                // 2. Free users get events regardless of receiveNewEventBroadcasts setting
                // This ensures they can't completely disable all event notifications
                console.log(`[EventBroadcast] ✅ Free user - basic filtering passed`);
            }

            eligibleUsers.push(userId);
        }

        console.log(`[EventBroadcast] 📊 Result: ${eligibleUsers.length}/${userIds.length} users eligible`);
        return eligibleUsers;
    }

    /**
     * Check if event matches user's detailed preferences
     * @private
     */
    static matchesUserPreferences(eventData, preferences) {
        // Category filtering
        if (preferences.preferredCategories && preferences.preferredCategories.length > 0) {
            const eventCategory = eventData.category?.toLowerCase();
            const preferredCategories = preferences.preferredCategories.map(cat => cat.toLowerCase());
            
            if (!preferredCategories.includes(eventCategory)) {
                console.log(`[EventBroadcast] ❌ Category mismatch: ${eventCategory} not in [${preferredCategories.join(', ')}]`);
                return false;
            } else {
                console.log(`[EventBroadcast] ✅ Category match: ${eventCategory}`);
            }
        }

        // Location filtering (city-based string matching)
        if (preferences.preferredLocation?.city && eventData.location?.city) {
            const userCity = preferences.preferredLocation.city.toLowerCase();
            const eventCity = eventData.location.city.toLowerCase();
            
            if (userCity !== eventCity) {
                console.log(`[EventBroadcast] ❌ Location mismatch: ${eventCity} != ${userCity}`);
                return false;
            } else {
                console.log(`[EventBroadcast] ✅ Location match: ${eventCity}`);
            }
        }

        // Event type filtering (free/paid)
        if (preferences.eventTypePreference) {
            const userPref = preferences.eventTypePreference.toLowerCase();
            const eventType = eventData.eventType?.toLowerCase();
            
            console.log(`[EventBroadcast] 🎫 Event type filtering: User wants "${userPref}", event is "${eventType}"`);
            
            if (userPref === 'free' && eventType !== 'free') {
                console.log(`[EventBroadcast] ❌ User wants free events only, event is ${eventType}`);
                return false;
            }
            if (userPref === 'paid' && eventType !== 'paid') {
                console.log(`[EventBroadcast] ❌ User wants paid events only, event is ${eventType}`);
                return false;
            }
            
            console.log(`[EventBroadcast] ✅ Event type match: ${eventType}`);
        }

        // Price range filtering  
        if (preferences.priceRange && eventData.ticketPrice !== undefined) {
            const { min = 0, max = 10000 } = preferences.priceRange;
            const eventPrice = eventData.ticketPrice || 0;
            
            console.log(`[EventBroadcast] 💰 Price filtering: Event R${eventPrice}, user range R${min}-R${max}`);
            
            if (eventPrice < min || eventPrice > max) {
                console.log(`[EventBroadcast] ❌ Price R${eventPrice} outside range R${min}-R${max}`);
                return false;
            }
            
            console.log(`[EventBroadcast] ✅ Price within range: R${eventPrice}`);
        }

        return true;
    }

    /**
     * Get default preferences structure
     * @private
     */
    static getDefaultPreferences() {
        return {
            receiveEventNotifications: true,
            receiveNewEventBroadcasts: true,
            receiveEventUpdates: true,
            receiveEventReminders: true,
            receivePrivateEventBroadcasts: false, // Disabled by default - users must opt in
            preferredCategories: [],
            locationRadius: 50,
            preferredLocation: null,
            eventTypePreference: null, // Phase 2B: free/paid preference
            priceRange: null // Phase 2B: min/max price range
        };
    }

    /**
     * Fallback broadcast when preference filtering fails
     * @private
     */
    static async fallbackBroadcastToAll(eventType, eventData, additionalData = null) {
        const broadcastData = additionalData || {
            type: eventType,
            event: {
                id: eventData.id,
                title: eventData.title,
                description: eventData.description,
                category: eventData.category,
                eventDate: eventData.eventDate,
                location: eventData.location,
                organizerInfo: eventData.organizerInfo,
                eventType: eventData.eventType,
                ticketPrice: eventData.ticketPrice,
                // Include image data for rich notifications
                bannerImage: eventData.bannerImage,
                images: eventData.images || [],
                currentAttendees: eventData.currentAttendees || 0,
                maxAttendees: eventData.maxAttendees || -1,
                visibility: eventData.visibility || 'public'
            },
            timestamp: new Date().toISOString()
        };

        await global.socketService.broadcastToAll(eventType, broadcastData);
        console.log('[EventBroadcast] Fallback broadcast completed');
    }

    /**
     * Broadcast to users registered for specific event
     * @private
     */
    static async broadcastToRegisteredUsers(eventType, eventData) {
        try {
            // Get registered users for this event
            const registrationsSnapshot = await db.collection('event_registrations')
                .where('eventId', '==', eventData.id)
                .where('status', '==', 'registered')
                .get();

            const registeredUserIds = [];
            registrationsSnapshot.forEach(doc => {
                registeredUserIds.push(doc.data().userId);
            });

            console.log(`[EventBroadcast] Notifying ${registeredUserIds.length} registered users about ${eventType}`);

            if (registeredUserIds.length > 0) {
                // Send to each registered user if they're connected
                const broadcastData = {
                    type: eventType,
                    event: eventData,
                    timestamp: new Date().toISOString()
                };

                registeredUserIds.forEach(userId => {
                    if (global.socketService.isUserConnected(userId)) {
                        global.socketService.sendToUser(userId, eventType, broadcastData);
                    }
                });
            } else {
                // No registered users, broadcast to all connected users instead
                console.log(`[EventBroadcast] No registered users found, broadcasting ${eventType} to all connected users`);
                await this.broadcastWithPreferences(eventType, eventData);
            }

        } catch (error) {
            console.warn('[EventBroadcast] Error getting registered users:', error.message);
            // Fallback to general broadcast
            await this.broadcastWithPreferences(eventType, eventData);
        }
    }

    /**
     * Check if circuit breaker is open
     * @private
     */
    static isCircuitBreakerOpen() {
        // Reset circuit breaker after timeout
        if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.CIRCUIT_BREAKER_RESET_TIME) {
            console.log('[EventBroadcast] Circuit breaker reset after timeout');
            this.broadcastFailureCount = 0;
            this.lastFailureTime = null;
            return false;
        }

        return this.broadcastFailureCount >= this.MAX_FAILURES;
    }

    /**
     * Handle broadcast errors safely
     * @private
     */
    static handleBroadcastError(operation, error) {
        this.broadcastFailureCount++;
        this.lastFailureTime = Date.now();

        console.warn(`[EventBroadcast] ${operation} failed (${this.broadcastFailureCount}/${this.MAX_FAILURES}):`, error.message);

        if (this.broadcastFailureCount >= this.MAX_FAILURES) {
            console.error('[EventBroadcast] Circuit breaker opened due to repeated failures');
        }

        // NEVER throw - this must not break HTTP responses
        return false;
    }

    /**
     * Get broadcasting service status
     * @returns {Object} Status information
     */
    static getStatus() {
        return {
            serviceName: 'EventBroadcastService',
            available: !!global.socketService,
            connectedUsers: global.socketService?.getConnectedUsersCount() || 0,
            circuitBreakerOpen: this.isCircuitBreakerOpen(),
            failureCount: this.broadcastFailureCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    /**
     * Reset circuit breaker manually (for admin/debugging)
     */
    static resetCircuitBreaker() {
        this.broadcastFailureCount = 0;
        this.lastFailureTime = null;
        console.log('[EventBroadcast] Circuit breaker manually reset');
    }
}

module.exports = EventBroadcastService; 