import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useColorScheme } from '../context/ColorSchemeContext';
import { EventNotification } from '../services/socketService';

interface EventNotificationToastProps {
  notification: EventNotification;
  onPress?: () => void;
  onDismiss?: () => void;
  duration?: number;
}

export default function EventNotificationToast({
  notification,
  onPress,
  onDismiss,
  duration = 4000
}: EventNotificationToastProps) {
  const { colorScheme } = useColorScheme();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handlePress = () => {
    onPress?.();
    dismiss();
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'new_event':
        return 'event';
      case 'event_update':
        return 'edit';
      case 'event_cancelled':
        return 'cancel';
      case 'new_registration':
        return 'person-add';
      case 'event_unregistration':
        return 'person-remove';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = () => {
    switch (notification.type) {
      case 'new_event':
        return '#4CAF50';
      case 'event_update':
        return '#2196F3';
      case 'event_cancelled':
        return '#F44336';
      case 'new_registration':
        return '#FF9800';
      case 'event_unregistration':
        return '#9E9E9E';
      default:
        return colorScheme;
    }
  };

  const getNotificationTitle = () => {
    switch (notification.type) {
      case 'new_event':
        return 'New Event';
      case 'event_update':
        return 'Event Updated';
      case 'event_cancelled':
        return 'Event Cancelled';
      case 'new_registration':
        return 'New Registration';
      case 'event_unregistration':
        return 'Unregistration';
      default:
        return 'Notification';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: getNotificationColor() }]}>
            <MaterialIcons
              name={getNotificationIcon() as any}
              size={24}
              color={COLORS.white}
            />
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {getNotificationTitle()}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {notification.message || 'New notification'}
            </Text>
            {notification.event?.title && (
              <Text style={styles.eventTitle} numberOfLines={1}>
                {notification.event.title}
              </Text>
            )}
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40, // Account for status bar
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  touchable: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 18,
  },
  eventTitle: {
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '500',
    marginTop: 2,
  },
  dismissButton: {
    padding: 4,
  },
});

// Toast Manager Component
interface EventNotificationToastManagerProps {
  children: React.ReactNode;
}

export function EventNotificationToastManager({ children }: EventNotificationToastManagerProps) {
  const [activeNotification, setActiveNotification] = useState<EventNotification | null>(null);

  useEffect(() => {
    // This would be connected to the notification context
    // For now, it's just a placeholder
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {activeNotification && (
        <EventNotificationToast
          notification={activeNotification}
          onDismiss={() => setActiveNotification(null)}
          onPress={() => {
            // Handle notification press - navigate to event details
            console.log('Notification pressed:', activeNotification);
          }}
        />
      )}
    </View>
  );
} 