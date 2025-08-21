import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService, { EventNotification, SocketServiceConfig } from '../services/socketService';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../utils/api';
import { EventPreferences } from '../types/events';
import { toastService } from '../hooks/useToast';

interface EventNotificationContextType {
  // Notification state
  notifications: EventNotification[];
  unreadCount: number;
  connected: boolean;
  
  // Actions
  markAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
  connectToSocket: () => Promise<boolean>;
  disconnectFromSocket: () => void;
  
  // Preferences
  preferences: EventPreferences | null;
  updatePreferences: (preferences: Partial<EventPreferences>) => Promise<boolean>;
  loadPreferences: () => Promise<void>;
}

const EventNotificationContext = createContext<EventNotificationContextType | undefined>(undefined);

interface EventNotificationProviderProps {
  children: ReactNode;
}

export function EventNotificationProvider({ children }: EventNotificationProviderProps) {
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [preferences, setPreferences] = useState<EventPreferences | null>(null);
  const notificationIdCounter = useRef(0);

  // Initialize socket service and load preferences on mount
  useEffect(() => {
    initializeNotificationService();
    loadPreferences();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  /**
   * Initialize the notification service with socket configuration
   */
  const initializeNotificationService = async () => {
    console.log('[EventNotifications] Initializing notification service...');

    const socketConfig: SocketServiceConfig = {
      onEventNotification: handleNewNotification,
      onConnectionChange: (isConnected) => {
        console.log('[EventNotifications] Connection status changed:', isConnected);
        setConnected(isConnected);
      },
      onError: (error) => {
        console.error('[EventNotifications] Socket error:', error);
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          // Only show critical errors to users
          if (error.includes('Authentication failed')) {
            toastService.error('Connection Error', 'Failed to connect to real-time updates. Please restart the app.');
          }
        }
      }
    };

    socketService.initialize(socketConfig);

    // Auto-connect if user has notifications enabled
    const shouldAutoConnect = await checkAutoConnectPreference();
    if (shouldAutoConnect) {
      setTimeout(() => {
        connectToSocket();
      }, 1000); // Delay to ensure app is fully loaded
    }
  };

  /**
   * Check if we should auto-connect based on user preferences
   */
  const checkAutoConnectPreference = async (): Promise<boolean> => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) return false;

      // Check if user has event notifications enabled
      const user = JSON.parse(userData);
      const userPrefs = user.eventPreferences;
      
      return userPrefs?.receiveEventNotifications !== false; // Default to true
    } catch (error) {
      console.error('[EventNotifications] Error checking auto-connect preference:', error);
      return true; // Default to auto-connect
    }
  };

  /**
   * Handle new notification from socket
   */
  const handleNewNotification = (notification: EventNotification) => {
    console.log('[EventNotifications] Received notification:', notification.type);

    // Add unique ID to notification
    const notificationWithId = {
      ...notification,
      id: `notification_${Date.now()}_${notificationIdCounter.current++}`,
      read: false
    };

    // Add to notifications list
    setNotifications(prev => [notificationWithId, ...prev].slice(0, 50)); // Keep max 50 notifications

    // Update unread count
    setUnreadCount(prev => prev + 1);

    // Show toast notification
    showToastNotification(notificationWithId);

    // Store in local storage for persistence
    storeNotification(notificationWithId);
  };

  /**
   * Show toast notification to user
   */
  const showToastNotification = (notification: EventNotification & { id: string }) => {
    const title = getNotificationTitle(notification.type);
    
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Show all event notifications as toasts instead of disruptive alerts
      const toastType = notification.type === 'event_cancelled' ? 'error' : 
                       notification.type === 'new_event' ? 'success' : 'info';
      
      toastService.show(title, notification.message || notification.event?.title, { 
        type: toastType,
        duration: 5000 // Show for 5 seconds
      });
    }
  };

  /**
   * Get notification title based on type
   */
  const getNotificationTitle = (type: EventNotification['type']): string => {
    switch (type) {
      case 'new_event': return '📅 New Event';
      case 'event_update': return '📝 Event Updated';
      case 'event_cancelled': return '❌ Event Cancelled';
      case 'new_registration': return '👤 New Registration';
      case 'event_unregistration': return '👋 Unregistration';
      default: return '🔔 Notification';
    }
  };

  /**
   * Store notification in local storage
   */
  const storeNotification = async (notification: EventNotification & { id: string }) => {
    try {
      const stored = await AsyncStorage.getItem('eventNotifications');
      const existingNotifications = stored ? JSON.parse(stored) : [];
      const updatedNotifications = [notification, ...existingNotifications].slice(0, 100); // Keep max 100
      await AsyncStorage.setItem('eventNotifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('[EventNotifications] Error storing notification:', error);
    }
  };

  /**
   * Load stored notifications
   */
  const loadStoredNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem('eventNotifications');
      if (stored) {
        const storedNotifications = JSON.parse(stored);
        setNotifications(storedNotifications);
        
        // Count unread
        const unread = storedNotifications.filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('[EventNotifications] Error loading stored notifications:', error);
    }
  };

  /**
   * Connect to socket service
   */
  const connectToSocket = async (): Promise<boolean> => {
    console.log('[EventNotifications] Connecting to socket...');
    
    // Load stored notifications first
    await loadStoredNotifications();
    
    // Connect to socket
    const success = await socketService.connect();
    if (success) {
      console.log('[EventNotifications] Successfully connected to real-time service');
    } else {
      console.log('[EventNotifications] Failed to connect to real-time service');
    }
    
    return success;
  };

  /**
   * Disconnect from socket service
   */
  const disconnectFromSocket = () => {
    console.log('[EventNotifications] Disconnecting from socket...');
    socketService.disconnect();
    setConnected(false);
  };

  /**
   * Mark notification as read
   */
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        (n as any).id === notificationId ? { ...n, read: true } : n
      )
    );
    
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Update storage
    updateStoredNotifications();
  };

  /**
   * Clear all notifications
   */
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    AsyncStorage.removeItem('eventNotifications');
  };

  /**
   * Update stored notifications
   */
  const updateStoredNotifications = async () => {
    try {
      await AsyncStorage.setItem('eventNotifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('[EventNotifications] Error updating stored notifications:', error);
    }
  };

  /**
   * Load user event preferences
   */
  const loadPreferences = async () => {
    try {
      console.log('[EventNotifications] Loading event preferences...');
      
      // First try to get from AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.eventPreferences) {
          setPreferences(user.eventPreferences);
          console.log('[EventNotifications] Loaded preferences from cache');
          return;
        }
      }

      // If not in cache, fetch from backend
      try {
        const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_EVENT_PREFERENCES, {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.preferences) {
            setPreferences(data.preferences);
            console.log('[EventNotifications] Loaded preferences from backend');
          }
        } else {
          // If preferences don't exist, initialize with defaults
          console.log('[EventNotifications] No preferences found, using defaults');
          const defaultPreferences: EventPreferences = {
            receiveEventNotifications: true,
            receiveNewEventBroadcasts: true,
            receiveEventUpdates: true,
            receiveEventReminders: true,
            preferredCategories: [],
            locationRadius: 50,
            preferredLocation: undefined,
            eventTypePreference: undefined,
            priceRange: undefined,
          };
          setPreferences(defaultPreferences);
        }
      } catch (error) {
        console.error('[EventNotifications] Error fetching preferences from backend:', error);
        // Use defaults if backend fails
        const defaultPreferences: EventPreferences = {
          receiveEventNotifications: true,
          receiveNewEventBroadcasts: true,
          receiveEventUpdates: true,
          receiveEventReminders: true,
          preferredCategories: [],
          locationRadius: 50,
        };
        setPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('[EventNotifications] Error loading preferences:', error);
    }
  };

  /**
   * Update user event preferences
   */
  const updatePreferences = async (newPreferences: Partial<EventPreferences>): Promise<boolean> => {
    try {
      console.log('[EventNotifications] Updating preferences:', newPreferences);

      const updatedPreferences = { ...preferences, ...newPreferences } as EventPreferences;

      // Update backend
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.UPDATE_EVENT_PREFERENCES, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventPreferences: updatedPreferences
        }),
      });

      if (response.ok) {
        setPreferences(updatedPreferences);
        
        // Update local storage
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          user.eventPreferences = updatedPreferences;
          await AsyncStorage.setItem('userData', JSON.stringify(user));
        }

        // Handle connection based on notification preference
        if (!updatedPreferences.receiveEventNotifications) {
          disconnectFromSocket();
        } else if (!connected) {
          connectToSocket();
        }

        console.log('[EventNotifications] Preferences updated successfully');
        return true;
      } else {
        console.error('[EventNotifications] Failed to update preferences');
        return false;
      }
    } catch (error) {
      console.error('[EventNotifications] Error updating preferences:', error);
      return false;
    }
  };

  const contextValue: EventNotificationContextType = {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    clearAllNotifications,
    connectToSocket,
    disconnectFromSocket,
    preferences,
    updatePreferences,
    loadPreferences,
  };

  return (
    <EventNotificationContext.Provider value={contextValue}>
      {children}
    </EventNotificationContext.Provider>
  );
}

export function useEventNotifications() {
  const context = useContext(EventNotificationContext);
  if (context === undefined) {
    throw new Error('useEventNotifications must be used within an EventNotificationProvider');
  }
  return context;
}

export default EventNotificationContext; 