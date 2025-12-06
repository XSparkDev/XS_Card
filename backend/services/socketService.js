const { Server } = require('socket.io');
const { db } = require('../firebase');
const SocketAuth = require('../middleware/socketAuth');

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*", // Configure this properly for production
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'] // Allow both for maximum compatibility
    });

    this.connectedUsers = new Map(); // userId -> { socketId, userInfo, connectedAt }
    this.isInitialized = false;
    
    this.setupAuthentication();
    this.setupConnectionHandlers();
    
    console.log('✅ SocketService initialized with authentication');
  }

  /**
   * Setup Socket.io authentication middleware
   */
  setupAuthentication() {
    // Apply authentication middleware to all connections
    this.io.use(SocketAuth.middleware());
    console.log('🔐 Socket authentication middleware applied');
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection (authenticated users only)
   * @param {Object} socket - Authenticated socket instance
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const userInfo = socket.user;

    console.log(`🔌 User connected: ${userId} (${userInfo.email || 'no email'})`);

    // Store user connection
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      userInfo: userInfo,
      connectedAt: new Date().toISOString(),
      socket: socket // Keep reference for direct messaging
    });

    // Setup socket event handlers
    this.setupSocketEvents(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Send welcome message
    socket.emit('connection_confirmed', {
      message: 'Successfully connected to XS Card Events',
      userId: userId,
      connectedAt: new Date().toISOString(),
      connectedUsers: this.getConnectedUsersCount()
    });

    console.log(`📊 Total connected users: ${this.getConnectedUsersCount()}`);
  }

  /**
   * Setup individual socket event handlers
   * @param {Object} socket - Socket instance
   */
  setupSocketEvents(socket) {
    // Heartbeat/ping handler
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // User status update handler
    socket.on('update_status', (status) => {
      const userId = socket.userId;
      const userConnection = this.connectedUsers.get(userId);
      
      if (userConnection) {
        userConnection.status = status;
        console.log(`📱 User ${userId} status updated: ${status}`);
      }
    });

    // Test message handler (for development)
    socket.on('test_message', (data) => {
      console.log(`💬 Test message from ${socket.userId}:`, data);
      socket.emit('test_response', {
        message: 'Message received',
        echo: data,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   * @param {String} reason - Disconnection reason
   */
  handleDisconnection(socket, reason) {
    const userId = socket.userId;
    
    console.log(`🔌 User disconnected: ${userId} (reason: ${reason})`);
    
    // Remove from connected users
    this.connectedUsers.delete(userId);
    
    console.log(`📊 Total connected users: ${this.getConnectedUsersCount()}`);
  }

  /**
   * Get count of connected users
   * @returns {Number} Number of connected users
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get list of connected user IDs
   * @returns {Array} Array of user IDs
   */
  getConnectedUserIds() {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Check if user is connected
   * @param {String} userId - User ID to check
   * @returns {Boolean} True if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Send message to specific user (if connected)
   * @param {String} userId - Target user ID
   * @param {String} event - Event name
   * @param {Object} data - Message data
   * @returns {Boolean} True if message was sent
   */
  sendToUser(userId, event, data) {
    const userConnection = this.connectedUsers.get(userId);
    
    if (userConnection) {
      userConnection.socket.emit(event, data);
      console.log(`📤 Message sent to user ${userId}: ${event}`);
      return true;
    } else {
      console.log(`📪 User ${userId} not connected, message not sent: ${event}`);
      return false;
    }
  }

  /**
   * Broadcast message to all connected users
   * @param {String} event - Event name
   * @param {Object} data - Message data
   */
  broadcastToAll(event, data) {
    this.io.emit(event, data);
    console.log(`📢 Broadcast sent: ${event} to ${this.getConnectedUsersCount()} users`);
  }

  // Phase 2 Event Broadcasting Methods (Placeholders for now)

  /**
   * Broadcast new event to relevant users
   * @param {Object} eventData - Event data
   */
  async broadcastNewEvent(eventData) {
    console.log('🎪 Broadcasting new event:', eventData.id);
    
    // TODO: Implement user preference filtering
    // TODO: Implement location-based filtering
    // TODO: Implement category-based filtering
    
    // For now, just broadcast to all connected users
    this.broadcastToAll('new_event', {
      type: 'new_event',
      event: eventData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast event update to relevant users
   * @param {Object} eventData - Updated event data
   * @param {String} updateType - Type of update (event_update, event_cancelled, etc.)
   */
  async broadcastEventUpdate(eventData, updateType = 'event_update') {
    console.log(`🔄 Broadcasting event update: ${eventData.id} (${updateType})`);
    
    // TODO: Implement filtering for registered users
    // TODO: Implement organizer notifications
    
    // For now, just broadcast to all connected users
    this.broadcastToAll('event_update', {
      type: updateType,
      event: eventData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast new registration to event organizer
   * @param {string} organizerId - The organizer's user ID
   * @param {Object} eventData - Event information
   * @param {Object} registrationData - Registration information
   */
  async broadcastNewRegistration(organizerId, eventData, registrationData) {
    console.log(`👤 Broadcasting new registration to organizer ${organizerId} for event ${eventData.id}`);
    
    const organizerConnection = this.connectedUsers.get(organizerId);
    if (organizerConnection) {
      organizerConnection.socket.emit('new_registration', {
        event: eventData,
        registration: {
          userId: registrationData.userId,
          userName: registrationData.userInfo.name,
          userEmail: registrationData.userInfo.email,
          registeredAt: registrationData.registeredAt,
          specialRequests: registrationData.specialRequests
        },
        timestamp: new Date().toISOString()
      });
      console.log(`✅ Registration notification sent to organizer ${organizerId}`);
    } else {
      console.log(`⚠️ Organizer ${organizerId} not connected, registration notification not sent`);
    }
  }

  /**
   * Broadcast unregistration to event organizer
   * @param {string} organizerId - The organizer's user ID
   * @param {Object} eventData - Event information
   * @param {Object} unregistrationData - Unregistration information
   */
  async broadcastUnregistration(organizerId, eventData, unregistrationData) {
    console.log(`👋 Broadcasting unregistration to organizer ${organizerId} for event ${eventData.id}`);
    
    const organizerConnection = this.connectedUsers.get(organizerId);
    if (organizerConnection) {
      organizerConnection.socket.emit('event_unregistration', {
        event: eventData,
        unregistration: {
          userId: unregistrationData.userId,
          userName: unregistrationData.userName,
          unregisteredAt: unregistrationData.unregisteredAt
        },
        timestamp: new Date().toISOString()
      });
      console.log(`✅ Unregistration notification sent to organizer ${organizerId}`);
    } else {
      console.log(`⚠️ Organizer ${organizerId} not connected, unregistration notification not sent`);
    }
  }

  /**
   * Get service health/status information
   * @returns {Object} Service status
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      connectedUsers: this.getConnectedUsersCount(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = SocketService;