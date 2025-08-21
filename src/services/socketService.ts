import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../utils/api';

export interface EventNotification {
  type: 'new_event' | 'event_update' | 'event_cancelled' | 'new_registration' | 'event_unregistration';
  event: any;
  message?: string;
  timestamp: string;
  registration?: any;
  unregistration?: any;
}

export interface SocketServiceConfig {
  onEventNotification?: (notification: EventNotification) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private config: SocketServiceConfig = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds
  private isConnecting = false;
  private isAuthenticated = false;

  /**
   * Initialize the socket service with configuration
   */
  initialize(config: SocketServiceConfig) {
    this.config = config;
    console.log('[SocketService] Initialized with config');
  }

  /**
   * Connect to the WebSocket server with authentication
   */
  async connect(): Promise<boolean> {
    if (this.isConnecting || (this.socket && this.socket.connected)) {
      console.log('[SocketService] Already connecting or connected');
      return true;
    }

    try {
      this.isConnecting = true;
      console.log('[SocketService] Starting connection...');

      // Get authentication token
      const token = await AsyncStorage.getItem('userToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (!token || !userData) {
        console.log('[SocketService] No authentication token or user data found');
        this.isConnecting = false;
        return false;
      }

      const user = JSON.parse(userData);
      
      // Create socket connection with authentication
      this.socket = io(API_BASE_URL, {
        auth: {
          token: token.replace('Bearer ', ''), // Remove Bearer prefix
          userId: user.id,
          userName: `${user.name} ${user.surname}`.trim()
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      // Set up event listeners
      this.setupEventListeners();

      // Wait for connection
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[SocketService] Connection timeout');
          this.isConnecting = false;
          resolve(false);
        }, 10000);

        this.socket?.on('connect', () => {
          console.log('[SocketService] Connected successfully');
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isAuthenticated = true;
          this.reconnectAttempts = 0;
          this.config.onConnectionChange?.(true);
          resolve(true);
        });

        this.socket?.on('connect_error', (error) => {
          console.error('[SocketService] Connection error:', error.message);
          clearTimeout(timeout);
          this.isConnecting = false;
          this.config.onError?.(`Connection failed: ${error.message}`);
          resolve(false);
        });
      });

    } catch (error) {
      console.error('[SocketService] Error during connection:', error);
      this.isConnecting = false;
      this.config.onError?.('Failed to connect to real-time service');
      return false;
    }
  }

  /**
   * Set up all socket event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', reason);
      this.isAuthenticated = false;
      this.config.onConnectionChange?.(false);
      
      // Auto-reconnect unless it was a manual disconnect
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('reconnect', () => {
      console.log('[SocketService] Reconnected');
      this.isAuthenticated = true;
      this.reconnectAttempts = 0;
      this.config.onConnectionChange?.(true);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[SocketService] Reconnection error:', error);
      this.scheduleReconnect();
    });

    // Authentication events
    this.socket.on('authenticated', (data) => {
      console.log('[SocketService] Authenticated successfully:', data);
      this.isAuthenticated = true;
    });

    this.socket.on('authentication_error', (error) => {
      console.error('[SocketService] Authentication error:', error);
      this.isAuthenticated = false;
      this.config.onError?.('Authentication failed');
    });

    // Event notification listeners
    this.socket.on('new_event', (data) => {
      console.log('[SocketService] New event notification:', data);
      this.handleEventNotification({
        type: 'new_event',
        event: data.event,
        message: `New ${data.event.category} event: ${data.event.title}`,
        timestamp: data.timestamp
      });
    });

    this.socket.on('event_update', (data) => {
      console.log('[SocketService] Event update notification:', data);
      this.handleEventNotification({
        type: 'event_update',
        event: data.event,
        message: data.message || `Event "${data.event.title}" has been updated`,
        timestamp: data.timestamp
      });
    });

    this.socket.on('event_cancelled', (data) => {
      console.log('[SocketService] Event cancelled notification:', data);
      this.handleEventNotification({
        type: 'event_cancelled',
        event: data.event,
        message: `Event "${data.event.title}" has been cancelled`,
        timestamp: data.timestamp
      });
    });

    this.socket.on('new_registration', (data) => {
      console.log('[SocketService] New registration notification:', data);
      this.handleEventNotification({
        type: 'new_registration',
        event: data.event,
        registration: data.registration,
        message: `${data.registration.userName} registered for your event "${data.event.title}"`,
        timestamp: data.timestamp
      });
    });

    this.socket.on('event_unregistration', (data) => {
      console.log('[SocketService] Unregistration notification:', data);
      this.handleEventNotification({
        type: 'event_unregistration',
        event: data.event,
        unregistration: data.unregistration,
        message: `${data.unregistration.userName} unregistered from your event "${data.event.title}"`,
        timestamp: data.timestamp
      });
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('[SocketService] Socket error:', error);
      this.config.onError?.(`Socket error: ${error.message || error}`);
    });
  }

  /**
   * Handle incoming event notifications
   */
  private handleEventNotification(notification: EventNotification) {
    console.log('[SocketService] Processing notification:', notification.type);
    this.config.onEventNotification?.(notification);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[SocketService] Max reconnection attempts reached');
      this.config.onError?.('Connection lost. Please restart the app to reconnect.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[SocketService] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      if (!this.socket?.connected) {
        console.log(`[SocketService] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect();
      }
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  /**
   * Disconnect from the socket server
   */
  disconnect() {
    if (this.socket) {
      console.log('[SocketService] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
      this.reconnectAttempts = 0;
      this.config.onConnectionChange?.(false);
    }
  }

  /**
   * Check if socket is connected and authenticated
   */
  isConnected(): boolean {
    return this.socket?.connected === true && this.isAuthenticated;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.socket?.connected || false,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Join a specific room (for targeted notifications)
   */
  joinRoom(room: string) {
    if (this.isConnected()) {
      console.log(`[SocketService] Joining room: ${room}`);
      this.socket?.emit('join_room', room);
    }
  }

  /**
   * Leave a specific room
   */
  leaveRoom(room: string) {
    if (this.isConnected()) {
      console.log(`[SocketService] Leaving room: ${room}`);
      this.socket?.emit('leave_room', room);
    }
  }

  /**
   * Send a custom event to the server
   */
  emit(event: string, data: any) {
    if (this.isConnected()) {
      this.socket?.emit(event, data);
    } else {
      console.warn('[SocketService] Cannot emit - not connected');
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService; 