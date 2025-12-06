import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { useEventNotifications } from '../../context/EventNotificationContext';
import { authenticatedFetchWithRefresh, ENDPOINTS, endRecurringSeries } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { Event, UserEventsResponse } from '../../types/events';
import { checkEventPaymentStatus } from '../../services/eventService';

// Helper function to safely parse dates
const parseEventDate = (dateString: string, isoDateString?: string): Date => {
  try {
    // Prefer ISO string if available (more reliable)
    if (isoDateString) {
      const date = new Date(isoDateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Fallback to formatted date string
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // If both fail, return current date as fallback
    console.error('Failed to parse date:', { dateString, isoDateString });
    return new Date();
  } catch (error) {
    console.error('Error parsing event date:', error);
    return new Date();
  }
};

type NavigationProp = NativeStackNavigationProp<any>;

interface EventStats {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalRegistrations: number;
  totalViews: number;
}

interface EventActionModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onAction: (action: string, eventId: string) => void;
}

export default function MyEventsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const toast = useToast();
  const { notifications } = useEventNotifications();

  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [lastProcessedNotificationId, setLastProcessedNotificationId] = useState<string | null>(null);
  const [stats, setStats] = useState<EventStats>({
    totalEvents: 0,
    publishedEvents: 0,
    draftEvents: 0,
    totalRegistrations: 0,
    totalViews: 0,
  });
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'cancelled'>('all');
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Load user events when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadMyEvents();
    }, [filter])
  );

  // Load user's events
  const loadMyEvents = async () => {
    try {
      setLoading(true);

      const statusFilter = filter === 'all' ? '' : `?status=${filter}`;
      const response = await authenticatedFetchWithRefresh(
        `${ENDPOINTS.GET_USER_EVENTS}${statusFilter}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to load events: ${response.status}`);
      }

      const data: UserEventsResponse = await response.json();

      if (data.success) {
        setEvents(data.data.events);
        calculateStats(data.data.events);
      } else {
        throw new Error('Failed to load events');
      }
    } catch (error) {
      console.error('Error loading my events:', error);
      toast.error('Error', 'Failed to load your events. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate dashboard statistics
  const calculateStats = (eventList: Event[]) => {
    const newStats: EventStats = {
      totalEvents: eventList.length,
      publishedEvents: eventList.filter(e => e.status === 'published').length,
      draftEvents: eventList.filter(e => e.status === 'draft').length,
      totalRegistrations: eventList.reduce((sum, e) => sum + (e.currentAttendees || 0), 0),
      totalViews: 0, // Would need to implement view tracking
    };
    setStats(newStats);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadMyEvents();
  };

  // Handle duplicate event
  const handleDuplicateEvent = async (eventId: string) => {
    try {
      const eventToDuplicate = events.find(e => e.id === eventId);
      if (!eventToDuplicate) {
        toast.error('Error', 'Event not found');
        return;
      }

      // Create duplicate data with proper date handling
      let eventDateISO: string;
      let endDateISO: string | null = null;

      // Use ISO dates if available, otherwise try to convert formatted dates
      if (eventToDuplicate.eventDateISO) {
        eventDateISO = eventToDuplicate.eventDateISO;
      } else {
        try {
          eventDateISO = new Date(eventToDuplicate.eventDate).toISOString();
        } catch (error) {
          console.error('Error parsing event date:', error);
          toast.error('Error', 'Invalid event date format');
          return;
        }
      }

      if (eventToDuplicate.endDate) {
        if (eventToDuplicate.endDateISO) {
          endDateISO = eventToDuplicate.endDateISO;
        } else {
          try {
            endDateISO = new Date(eventToDuplicate.endDate).toISOString();
          } catch (error) {
            console.error('Error parsing end date:', error);
            // Continue without end date rather than failing
            endDateISO = null;
          }
        }
      }

      const duplicateData = {
        title: `${eventToDuplicate.title} (Copy)`,
        description: eventToDuplicate.description,
        eventDate: eventDateISO,
        endDate: endDateISO,
        category: eventToDuplicate.category,
        eventType: eventToDuplicate.eventType,
        ticketPrice: eventToDuplicate.ticketPrice,
        maxAttendees: eventToDuplicate.maxAttendees,
        visibility: eventToDuplicate.visibility, // Keep same visibility
        location: eventToDuplicate.location,
        images: eventToDuplicate.images || [],
        tags: eventToDuplicate.tags || [],
      };

      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.CREATE_EVENT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(duplicateData),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Success', 'Event duplicated successfully');
          loadMyEvents(); // Refresh the list
        } else {
          throw new Error(data.message || 'Failed to duplicate event');
        }
      } else {
        throw new Error(`Failed to duplicate event: ${response.status}`);
      }
    } catch (error) {
      console.error('Error duplicating event:', error);
      toast.error('Error', 'Failed to duplicate event. Please try again.');
    }
  };

  // Handle event actions
  const handleEventAction = async (action: string, eventId: string) => {
    try {
      let response: Response;
      let successMessage = '';

      switch (action) {
        case 'edit':
          // Navigate to edit screen
          const eventToEdit = events.find(e => e.id === eventId);
          navigation.navigate('EditEvent', { eventId, event: eventToEdit });
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        case 'publish':
          response = await authenticatedFetchWithRefresh(
            ENDPOINTS.PUBLISH_EVENT.replace(':eventId', eventId),
            { method: 'POST' }
          );
          
          if (response.ok) {
            const publishData = await response.json();
            
            if (publishData.paymentRequired) {
              // Check if this is an existing pending payment or new payment
              if (publishData.paymentStatus === 'pending') {
                // There's already a pending payment - go to payment pending screen
                toast.info('Pending Payment', 'You have a pending payment for this event. Please complete it to publish your event.');
                
                navigation.navigate('PaymentPending', { 
                  eventId,
                  paymentUrl: publishData.paymentUrl,
                  paymentReference: publishData.paymentReference,
                  paymentType: 'event_publishing'
                });
              } else {
                // New payment required - navigate to PaymentPendingScreen
                toast.success('Payment Required', 'You will be redirected to the payment screen.');
                  
                navigation.navigate('PaymentPending', { 
                  eventId,
                  paymentUrl: publishData.paymentUrl,
                  paymentReference: publishData.reference,
                  paymentType: 'event_publishing'
                });
              }
              
              // Close the action modal
              setActionModalVisible(false);
              setSelectedEvent(null);
              return;
            } else {
              // Event published successfully without payment
              successMessage = 'Event published successfully';
            }
          } else {
            // Handle server error response
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to publish event: ${response.status}`);
          }
          break;

        case 'duplicate':
          // Implement duplication logic
          await handleDuplicateEvent(eventId);
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        case 'complete_payment':
          // Retry publishing the event to create a fresh payment session
          if (!selectedEvent) {
            toast.error('Error', 'Event not found. Please try again.');
            setActionModalVisible(false);
            return;
          }
          
          try {
            // Call the publish endpoint to create a new payment session
            const response = await authenticatedFetchWithRefresh(
              ENDPOINTS.PUBLISH_EVENT.replace(':eventId', eventId),
              { method: 'POST' }
            );

            const data = await response.json();

            if (data.success && data.paymentRequired && data.paymentUrl) {
              // Fresh payment session created - open payment URL directly!
              toast.success('Payment Ready', 'Payment page is opening. Complete payment and your event will be published automatically.');
              
              // Open payment URL immediately
              await Linking.openURL(data.paymentUrl);
              
              // Refresh events list to show updated status
              loadMyEvents();
              
            } else if (data.success && !data.paymentRequired) {
              // Event was published without payment (credit used)
              toast.success('🎉 Event Published!', data.message || 'Event published successfully!');
              loadMyEvents(); // Refresh the events list
            } else {
              toast.error('Error', data.message || 'Unable to create payment session.');
            }
          } catch (error) {
            console.error('Error retrying event publish:', error);
            toast.error('Error', 'Unable to retry payment. Please try again.');
          }
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        case 'delete':
          response = await authenticatedFetchWithRefresh(
            ENDPOINTS.DELETE_EVENT.replace(':eventId', eventId),
            { method: 'DELETE' }
          );
          successMessage = 'Event cancelled successfully';
          break;

        case 'view_instances':
          const eventForInstances = events.find(e => e.id === eventId);
          if (eventForInstances?.isRecurring) {
            navigation.navigate('RecurringSeriesManagement', {
              eventId: eventForInstances.id,
              event: eventForInstances,
            });
          }
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        case 'end_series':
          const eventToEnd = events.find(e => e.id === eventId);
          if (!eventToEnd?.isRecurring) {
            toast.error('Error', 'This event is not a recurring series');
            setActionModalVisible(false);
            setSelectedEvent(null);
            return;
          }
          
          Alert.alert(
            'End Recurring Series',
            'This will end all future instances of this recurring event series. Continue?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'End Series',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await endRecurringSeries(eventId);
                    toast.success('Success', 'Recurring series ended successfully');
                    loadMyEvents();
                  } catch (error) {
                    console.error('Error ending series:', error);
                    toast.error('Error', 'Failed to end series. Please try again.');
                  }
                },
              },
            ]
          );
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        case 'edit_series':
          const eventToEditSeries = events.find(e => e.id === eventId);
          if (eventToEditSeries?.isRecurring) {
            Alert.alert(
              'Edit Recurring Series',
              'Editing this series will affect all future instances. Continue?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Edit Series',
                  onPress: () => {
                    navigation.navigate('EditEvent', { eventId, event: eventToEditSeries });
                  },
                },
              ]
            );
          }
          setActionModalVisible(false);
          setSelectedEvent(null);
          return;

        default:
          return;
      }

      if (response.ok) {
        toast.success('Success', successMessage);
        loadMyEvents(); // Refresh the list
      } else {
        throw new Error(`Failed to ${action} event`);
      }
    } catch (error) {
      console.error(`Error ${action} event:`, error);
      toast.error('Error', `Failed to ${action} event. Please try again.`);
    }

    setActionModalVisible(false);
    setSelectedEvent(null);
  };

  // Duplicate event function
  const duplicateEvent = async (eventId: string): Promise<Response> => {
    const eventToDuplicate = events.find(e => e.id === eventId);
    if (!eventToDuplicate) {
      throw new Error('Event not found');
    }

    // Create a new event based on the existing one
    const duplicateData = {
      title: `${eventToDuplicate.title} (Copy)`,
      description: eventToDuplicate.description,
      eventDate: eventToDuplicate.eventDate,
      endDate: eventToDuplicate.endDate,
      location: eventToDuplicate.location,
      category: eventToDuplicate.category,
      eventType: eventToDuplicate.eventType,
      ticketPrice: eventToDuplicate.ticketPrice,
      maxAttendees: eventToDuplicate.maxAttendees,
      visibility: eventToDuplicate.visibility,
      images: eventToDuplicate.images || [],
      tags: eventToDuplicate.tags || [],
    };

    return await authenticatedFetchWithRefresh(
      ENDPOINTS.CREATE_EVENT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateData),
      }
    );
  };

  // Render stats cards
  const renderStatsCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsContent}>
        <MaterialIcons name={icon as any} size={24} color={color} />
        <View>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );

  // Render event item
  const renderEventItem = ({ item }: { item: Event }) => {
    const isSelected = selectedEvents.includes(item.id);
    
    return (
      <TouchableOpacity style={[styles.eventCard, isSelected && styles.eventCardSelected]}>
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.badgesContainer}>
              {item.isRecurring && (
                <View style={styles.seriesBadge}>
                  <MaterialIcons name="repeat" size={12} color={COLORS.white} />
                  <Text style={styles.seriesBadgeText}>Series</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={16} color={COLORS.gray} />
              <Text style={styles.metaText}>
                {parseEventDate(item.eventDate, item.eventDateISO).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={16} color={COLORS.gray} />
              <Text style={styles.metaText}>{item.location.city}</Text>
            </View>
          </View>

          <View style={styles.eventStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="people" size={16} color={COLORS.gray} />
              <Text style={styles.statText}>
                {item.currentAttendees || 0}
                {item.maxAttendees > 0 && `/${item.maxAttendees}`} attendees
              </Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="attach-money" size={16} color={COLORS.gray} />
              <Text style={styles.statText}>
                {item.eventType === 'free' ? 'Free' : `R${item.ticketPrice}`}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedEvent(item);
            setActionModalVisible(true);
          }}
        >
          <MaterialIcons name="more-vert" size={24} color={COLORS.gray} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="event-note" size={64} color={COLORS.gray} />
      <Text style={styles.emptyTitle}>No Events Yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first event to start building your audience and managing attendees.
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: COLORS.primary }]}
        onPress={() => navigation.navigate('CreateEvent')}
      >
        <MaterialIcons name="add" size={20} color={COLORS.white} />
        <Text style={styles.createButtonText}>Create Your First Event</Text>
      </TouchableOpacity>
    </View>
  );

  // Listen for real-time registration notifications (for organizers)
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Only process the latest notification if it's new
      const latestNotification = notifications[0];
      const notificationId = (latestNotification as any).id;
      
      // Skip if we've already processed this notification
      if (notificationId && notificationId === lastProcessedNotificationId) {
        return;
      }
      
      // Update the last processed notification ID
      if (notificationId) {
        setLastProcessedNotificationId(notificationId);
      }
      
      // Handle organizer notifications for registrations
      if (latestNotification.type === 'new_registration') {
        console.log('[MyEventsScreen] Received new registration notification');
        toast.success(
          '👤 New Registration',
          `${latestNotification.registration?.userName} registered for your event "${latestNotification.event?.title}"`
        );
        // Refresh the events list to update registration counts
        loadMyEvents();
      }
      
      if (latestNotification.type === 'event_unregistration') {
        console.log('[MyEventsScreen] Received unregistration notification');
        toast.info(
          '👋 Unregistration',
          `${latestNotification.unregistration?.userName} unregistered from your event "${latestNotification.event?.title}"`
        );
        // Refresh the events list to update registration counts
        loadMyEvents();
      }
    }
  }, [notifications, lastProcessedNotificationId]);

  return (
    <View style={styles.container}>
      <EventHeader 
        title="My Events" 
        rightIcon={
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
            <MaterialIcons name="add" size={24} color={COLORS.black} />
          </TouchableOpacity>
        }
      />

      {/* Stats Dashboard */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          {renderStatsCard('Total Events', stats.totalEvents, 'event', COLORS.primary)}
          {renderStatsCard('Published', stats.publishedEvents, 'publish', '#4CAF50')}
        </View>
        <View style={styles.statsRow}>
          {renderStatsCard('Registrations', stats.totalRegistrations, 'people', '#2196F3')}
          {renderStatsCard('Drafts', stats.draftEvents, 'edit', '#FF9800')}
        </View>
      </View>

      {/* Events List */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your events...</Text>
        </View>
      ) : events.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      {/* Event Action Modal */}
      <EventActionModal
        visible={actionModalVisible}
        event={selectedEvent}
        onClose={() => {
          setActionModalVisible(false);
          setSelectedEvent(null);
        }}
        onAction={handleEventAction}
      />
    </View>
  );
}

// Get status color helper function
const getStatusColor = (status: string) => {
  switch (status) {
    case 'published': return '#4CAF50';
    case 'draft': return '#FF9800';
    case 'pending_payment': return '#FF9800';
    case 'cancelled': return '#F44336';
    default: return COLORS.gray;
  }
};

// Event Action Modal Component
function EventActionModal({ visible, event, onClose, onAction }: EventActionModalProps) {
  if (!event) return null;

  const isEventPast = parseEventDate(event.eventDate, event.eventDateISO) < new Date();
  const isEventFuture = parseEventDate(event.eventDate, event.eventDateISO) > new Date();
  const isEventActive = event.status === 'published' && !isEventPast;

  const actions = [
    { 
      key: 'edit', 
      label: event.isRecurring ? 'Edit Series' : 'Edit Event', 
      icon: 'edit', 
      color: COLORS.primary,
      available: event.status !== 'cancelled' && !isEventPast 
    },
    // Recurring event specific actions
    ...(event.isRecurring ? [
      {
        key: 'view_instances',
        label: 'View Instances',
        icon: 'list',
        color: '#2196F3',
        available: true,
      },
      {
        key: 'edit_series',
        label: 'Edit Series',
        icon: 'edit',
        color: COLORS.primary,
        available: event.status !== 'cancelled',
      },
      {
        key: 'end_series',
        label: 'End Series',
        icon: 'stop',
        color: '#F44336',
        available: event.status === 'published',
      },
    ] : []),
    { 
      key: 'publish', 
      label: event.status === 'published' ? 'Republish' : 'Publish Event', 
      icon: 'publish', 
      color: '#4CAF50',
      // Show republish for cancelled events or if event is past and was published
      available: event.status === 'cancelled' || 
                (event.status === 'draft') ||
                (event.status === 'published' && isEventPast)
    },
    { 
      key: 'duplicate', 
      label: 'Duplicate Event', 
      icon: 'content-copy', 
      color: '#2196F3',
      available: true // Always available
    },
    { 
      key: 'complete_payment', 
      label: 'Complete Payment', 
      icon: 'payment', 
      color: '#FF9800',
      available: event.status === 'pending_payment'
    },
    { 
      key: 'delete', 
      label: event.status === 'published' ? 'Cancel Event' : 'Delete Event', 
      icon: event.status === 'published' ? 'cancel' : 'delete', 
      color: '#F44336',
      available: event.status !== 'cancelled' && !event.isRecurring // Don't allow delete for recurring, use end_series instead
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event Actions</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
          
          {/* Event status info */}
          <View style={styles.eventStatusInfo}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
              <Text style={styles.statusText}>{event.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.eventDate}>
              {parseEventDate(event.eventDate, event.eventDateISO).toLocaleDateString()} 
              {isEventPast && ' (Past)'}
              {isEventActive && ' (Active)'}
              {isEventFuture && event.status === 'published' && ' (Upcoming)'}
            </Text>
          </View>

          <View style={styles.actionsList}>
            {actions.filter(action => action.available).map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionItem}
                onPress={() => onAction(action.key, event.id)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <MaterialIcons name={action.icon as any} size={20} color={COLORS.white} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.gray} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  statsTitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  eventCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F8FF',
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    flex: 1,
    marginRight: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  seriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  seriesBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  eventMeta: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  eventName: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 16,
  },
  eventStatusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  eventDate: {
    fontSize: 14,
    color: COLORS.gray,
  },
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
  },
});