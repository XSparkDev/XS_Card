import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { addToRecentEvents } from '../../utils/recentEvents';
import {
  Event,
  EventDetailsResponse,
  EventRegistration,
  EventRegistrationResponse,
  EventInstance,
} from '../../types/events';
import { enhanceEventsWithOrganizerInfo, publishEvent } from '../../services/eventService';
import { canBulkRegister } from '../../utils/bulkRegistrationUtils';
import BulkRegistrationModal from '../../components/bulk/BulkRegistrationModal';
import { getEventInstances } from '../../utils/api';
import EventInstanceList from '../../components/events/EventInstanceList';

// Navigation types
type RootStackParamList = {
  EventDetails: { eventId: string; event?: Event; paymentCompleted?: boolean; registrationId?: string; published?: boolean };
  Events: undefined;
  EventTicket: { event: Event; ticket?: any };
  QRScanner: { event: Event };
  CheckInDashboard: { event: Event };
  CreateEvent: { editEvent?: Event };
  EditEvent: { eventId: string; event?: Event };
  EventAnalytics: { event: Event };
  PaymentPending: { eventId: string; paymentUrl?: string; paymentReference?: string; paymentType?: string; registrationId?: string };
  RecurringSeriesManagement: { eventId: string; event?: Event };
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, 'EventDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EventDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EventDetailsRouteProp>();
  const toast = useToast();

  const { eventId, event: passedEvent, paymentCompleted, registrationId } = route.params;

  // State management
  const [event, setEvent] = useState<Event | null>(passedEvent || null);
  const [loading, setLoading] = useState(!passedEvent);
  const [registering, setRegistering] = useState(false);
  const [userRegistration, setUserRegistration] = useState<EventRegistration | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [checkingPendingPayment, setCheckingPendingPayment] = useState(false);
  const [showBulkRegistration, setShowBulkRegistration] = useState(false);
  // Recurring events state
  const [instances, setInstances] = useState<EventInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [hasMoreInstances, setHasMoreInstances] = useState(false);

  // Load event details
  useEffect(() => {
    if (!passedEvent) {
      loadEventDetails();
    } else {
      // If we have passed event data, still load full details
      loadEventDetails();
    }
    
    // If payment was just completed, show success message
    if (paymentCompleted) {
      if (registrationId) {
        // Registration payment completed
        toast.success(
          'Registration Complete!',
          'Your payment was successful and you are now registered for this event.'
        );
      } else {
        // Publishing payment completed
        toast.success(
          'Event Published!',
          'Your payment was successful and your event is now published.'
        );
      }
    }
  }, [eventId, paymentCompleted, registrationId]);

  // Force refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('EventDetailsScreen focused - forcing refresh');
      // Always reload event details when screen comes into focus
      loadEventDetails();
      
      // Check for pending payment registrations when returning to this screen
      checkPendingPaymentRegistration();
      
      // Force a clean state when returning to this screen
      return () => {
        // Clean up any pending operations when leaving the screen
        console.log('EventDetailsScreen unfocused - cleaning up');
      };
    }, [eventId])
  );

  // Function to check if user has a pending payment registration
  const checkPendingPaymentRegistration = async () => {
    if (!eventId) return;
    
    try {
      setCheckingPendingPayment(true);
      
      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.GET_EVENT_DETAILS.replace(':eventId', eventId),
        { method: 'GET' }
      );
      
      if (!response.ok) {
        console.error('Failed to check pending registrations');
        return;
      }
      
      const data: EventDetailsResponse = await response.json();
      
      if (data.success && data.data.userRegistration) {
        const registration = data.data.userRegistration;
        
        // If registration exists but is in pending_payment status, handle it
        if (registration.status === 'pending_payment') {
          // Ask user if they want to complete payment or cancel registration
          Alert.alert(
            'Payment Required',
            'You have a pending payment for this event registration. Would you like to complete the payment or cancel the registration?',
            [
              {
                text: 'Complete Payment',
                onPress: () => {
                  // Navigate to payment screen
                  navigation.navigate('PaymentPending', {
                    eventId,
                    paymentType: 'event_registration',
                    registrationId: registration.id,
                    paymentReference: registration.paymentReference || undefined
                  });
                }
              },
              {
                text: 'Cancel Registration',
                style: 'destructive',
                onPress: async () => {
                  // Cancel the registration
                  try {
                    setCheckingPendingPayment(true);
                    const cancelResponse = await authenticatedFetchWithRefresh(
                      ENDPOINTS.UNREGISTER_EVENT.replace(':eventId', eventId),
                      { 
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        }
                      }
                    );
                    
                    if (cancelResponse.ok) {
                      const responseData = await cancelResponse.json();
                      console.log('Cancellation response:', responseData);
                      
                      toast.success(
                        'Registration Cancelled',
                        'Your pending registration has been cancelled.'
                      );
                      // Reload event details to update UI
                      loadEventDetails();
                    } else {
                      let errorMessage = 'Failed to cancel registration. Please try again.';
                      try {
                        const errorData = await cancelResponse.json();
                        if (errorData && errorData.message) {
                          errorMessage = errorData.message;
                        }
                      } catch (parseError) {
                        console.error('Error parsing cancellation error response:', parseError);
                      }
                      
                      console.error('Cancellation error:', cancelResponse.status, errorMessage);
                      toast.error(
                        'Error',
                        errorMessage
                      );
                    }
                  } catch (error) {
                    console.error('Error cancelling registration:', error);
                    toast.error(
                      'Error',
                      'Failed to cancel registration. Please try again.'
                    );
                  } finally {
                    setCheckingPendingPayment(false);
                  }
                }
              },
              {
                text: 'Decide Later',
                style: 'cancel'
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error checking pending payment registration:', error);
    } finally {
      setCheckingPendingPayment(false);
    }
  };

  const loadEventDetails = async () => {
    try {
      setLoading(true);

      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.GET_EVENT_DETAILS.replace(':eventId', eventId),
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to load event details: ${response.status}`);
      }

      const data: EventDetailsResponse = await response.json();

      if (data.success) {
        let eventData = data.data.event;
        
        // Enhance event with correct organizer information
        const enhancedEvents = await enhanceEventsWithOrganizerInfo([eventData]);
        eventData = enhancedEvents[0];
        
        setEvent(eventData);
        setUserRegistration(data.data.userRegistration || null);
        setIsOrganizer(data.data.isOrganizer);
        addToRecentEvents(eventData);

        // Load instances if recurring event
        if (eventData.isRecurring && eventData.recurrencePattern) {
          loadEventInstances(eventData.id);
        }
      } else {
        throw new Error('Failed to load event details');
      }
    } catch (error) {
      console.error('Error loading event details:', error);
      toast.error(
        'Error loading event details', 
        'Failed to load event details. Please try again.'
      );
      // Automatically go back after showing error
      setTimeout(() => navigation.goBack(), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Load event instances for recurring events
  const loadEventInstances = async (eventId: string, loadMore = false) => {
    try {
      setLoadingInstances(true);
      const limit = 12;
      const startIndex = loadMore ? instances.length : 0;
      
      const fetchedInstances = await getEventInstances(eventId, {
        limit,
        startDate: new Date().toISOString().split('T')[0],
      });

      if (loadMore) {
        setInstances(prev => [...prev, ...fetchedInstances]);
      } else {
        setInstances(fetchedInstances);
      }
      
      setHasMoreInstances(fetchedInstances.length >= limit);
    } catch (error) {
      console.error('Error loading event instances:', error);
      toast.error('Error', 'Failed to load event instances');
    } finally {
      setLoadingInstances(false);
    }
  };

  // Handle event registration
  const handleRegister = async () => {
    if (!event) return;

    // For recurring events, require instance selection
    if (event.isRecurring && !selectedInstanceId) {
      toast.warning('Select Instance', 'Please select an instance to register for.');
      return;
    }

    try {
      setRegistering(true);

      // Check if event is full (0 means unlimited)
      if (event.maxAttendees > 0 && event.currentAttendees >= event.maxAttendees) {
        toast.warning('Event Full', 'This event is at full capacity.');
        return;
      }

      // For recurring events, check instance availability
      if (event.isRecurring && selectedInstanceId) {
        const selectedInstance = instances.find(i => i.instanceId === selectedInstanceId);
        if (selectedInstance) {
          if (selectedInstance.maxAttendees > 0 && selectedInstance.attendeeCount >= selectedInstance.maxAttendees) {
            toast.warning('Instance Full', 'This instance is at full capacity.');
            return;
          }
        }
      }

      const requestBody: any = {
        specialRequests: '',
      };

      // Include instanceId for recurring events
      if (event.isRecurring && selectedInstanceId) {
        requestBody.instanceId = selectedInstanceId;
      }

      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.REGISTER_EVENT.replace(':eventId', eventId),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Registration failed: ${response.status}`);
      }

      const data: EventRegistrationResponse = await response.json();

      if (data.success) {
        // Check if payment is required
        if (data.paymentRequired && data.paymentUrl) {
          // For paid events, don't update the UI yet
          // The registration is in pending_payment status
          // Navigate to payment pending screen
          navigation.navigate('PaymentPending', {
            eventId,
            paymentUrl: data.paymentUrl,
            paymentReference: data.paymentReference,
            paymentType: 'event_registration',
            registrationId: data.registration.id
          });
          return;
        }

        // No payment required (free event), complete registration
        setUserRegistration({
          ...data.registration,
          status: data.registration.status as 'registered' | 'pending_payment' | 'cancelled',
          userInfo: {
            name: '',
            email: '',
            phone: ''
          }
        });
        
        // Update event attendance count for free events
        setEvent(prev => prev ? {
          ...prev,
          currentAttendees: prev.currentAttendees + 1
        } : null);

        const instanceInfo = event.isRecurring && selectedInstanceId
          ? instances.find(i => i.instanceId === selectedInstanceId)
          : null;
        
        const successMessage = instanceInfo
          ? `You've successfully registered for ${event.title} on ${instanceInfo.date} at ${instanceInfo.localTimeFormatted}.`
          : `You've successfully registered for ${event.title}. You should receive a confirmation email shortly.`;

        toast.success('Registration Successful!', successMessage);
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error registering for event:', error);
      toast.error(
        'Registration Failed',
        error instanceof Error ? error.message : 'Failed to register for event. Please try again.'
      );
    } finally {
      setRegistering(false);
    }
  };

  // Handle event unregistration
  const handleUnregister = async () => {
    if (!event || !userRegistration) return;

    Alert.alert(
      'Unregister from Event',
      `Are you sure you want to unregister from ${event.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unregister',
          style: 'destructive',
          onPress: async () => {
            try {
              setRegistering(true);

              const response = await authenticatedFetchWithRefresh(
                ENDPOINTS.UNREGISTER_EVENT.replace(':eventId', eventId),
                { method: 'POST' }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Handle specific case when user has been checked in
                if (response.status === 400 && errorData.checkedIn) {
                  const checkedInDate = errorData.checkedInAt 
                    ? new Date(errorData.checkedInAt).toLocaleDateString()
                    : 'unknown date';
                  
                  toast.error(
                    'Cannot Unregister',
                    `You cannot unregister from this event because you have already been checked in on ${checkedInDate}. Please contact the event organizer for assistance.`
                  );
                  return;
                }
                
                throw new Error(errorData.message || `Unregistration failed: ${response.status}`);
              }

              const responseData = await response.json();
              console.log('Unregister response:', responseData);

              setUserRegistration(null);
              
              // Only update event attendance count if it wasn't a pending payment
              if (!responseData.wasPendingPayment) {
              setEvent(prev => prev ? {
                ...prev,
                currentAttendees: Math.max(0, prev.currentAttendees - 1)
              } : null);
              }

              toast.success('Unregistered', responseData.message || 'You have been unregistered from this event.');
            } catch (error) {
              console.error('Error unregistering from event:', error);
              toast.error('Error', 'Failed to unregister from event. Please try again.');
            } finally {
              setRegistering(false);
            }
          },
        },
      ]
    );
  };

  const handlePublishOrPay = async () => {
    if (!event) return;

    try {
      if (event.status === 'pending_payment') {
        navigation.navigate('PaymentPending', { eventId: event.id });
        return;
      }

      setPublishing(true);
      const result = await publishEvent(event.id);

      if (result.paymentRequired) {
        // Check if this is a new payment or existing pending payment
        if (result.paymentStatus === 'pending') {
          // There's already a pending payment - go to payment pending screen
          navigation.navigate('PaymentPending', { 
            eventId: event.id,
            paymentUrl: result.paymentUrl,
            paymentReference: result.paymentReference
          });
        } else {
          // New payment required - show alert and navigate to payment
          Alert.alert(
            'Payment Required',
            'You will be redirected to complete payment. After paying come back to this app.',
            [
              {
                text: 'Continue',
                onPress: async () => {
                  try {
                    await Linking.openURL(result.paymentUrl);
                  } catch (err) {
                    console.warn('Could not open payment URL', err);
                  }
                  navigation.navigate('PaymentPending', { eventId: event.id });
                },
              },
            ],
          );
        }
      } else if (result.success) {
        toast.success('Event Published', 'Your event is now live.');
        // Refresh details
        loadEventDetails();
      } else {
        toast.error('Publish Failed', result.message || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error publishing event:', error);
      toast.error('Error', error?.message || 'Failed to publish event');
    } finally {
      setPublishing(false);
    }
  };

  // Format date and time with better error handling
  const formatEventDateTime = (dateString: string, endDateString?: string, isoDateString?: string, isoEndDateString?: string) => {
    try {
      // Check if start date is already formatted
      const startDateStr = isoDateString || dateString;
      if (startDateStr && startDateStr.includes(' at ')) {
        // If already formatted, try to extract just the date part for consistency
        const parts = startDateStr.split(' at ');
        return {
          date: parts[0] || startDateStr,
          time: parts[1] || 'Time not available',
        };
      }

      let startDate: Date;
      let endDate: Date | null = null;

      // Use ISO string if available (more reliable)
      if (isoDateString) {
        startDate = new Date(isoDateString);
      } else {
        startDate = new Date(dateString);
      }

      if (endDateString) {
        // Check if end date is already formatted
        const endDateStr = isoEndDateString || endDateString;
        if (endDateStr && endDateStr.includes(' at ')) {
          // Skip end date processing if it's already formatted
          // We'll just use the start date
        } else {
          if (isoEndDateString) {
            endDate = new Date(isoEndDateString);
          } else {
            endDate = new Date(endDateString);
          }
        }
      }

      // Validate dates
      if (isNaN(startDate.getTime())) {
        console.error('Invalid start date:', { dateString, isoDateString });
        return {
          date: startDateStr || 'Invalid date',
          time: 'Invalid time',
        };
      }

      if (endDate && isNaN(endDate.getTime())) {
        console.error('Invalid end date:', { endDateString, isoEndDateString });
        endDate = null; // Continue without end date rather than failing
      }

      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };

      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
      };

      const formattedDate = startDate.toLocaleDateString([], dateOptions);
      const startTime = startDate.toLocaleTimeString([], timeOptions);
      const endTime = endDate ? endDate.toLocaleTimeString([], timeOptions) : null;

      return {
        date: formattedDate,
        time: endTime ? `${startTime} - ${endTime}` : startTime,
      };
    } catch (error) {
      console.error('Error formatting event date time:', error);
      return {
        date: dateString || 'Invalid date',
        time: 'Invalid time',
      };
    }
  };

  // Open location in maps
  const openInMaps = () => {
    if (!event) return;
    
    const { venue, address, city } = event.location;
    const query = encodeURIComponent(`${venue}, ${address}, ${city}`);
    const url = `https://maps.google.com/?q=${query}`;
    
    Linking.openURL(url).catch(() => {
      toast.error('Error', 'Could not open maps application.');
    });
  };

  // Handle image press to open modal
  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  };

  // Get all event images (banner + additional images)
  const getAllEventImages = () => {
    const images: string[] = [];
    if (event?.bannerImage) {
      images.push(event.bannerImage);
    }
    if (event?.images && event.images.length > 0) {
      // Add non-banner images (avoid duplicates)
      event.images.forEach(img => {
        if (img !== event.bannerImage) {
          images.push(img);
        }
      });
    }
    return images;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <EventHeader title="Event Details" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <EventHeader title="Event Details" />
        <View style={styles.error}>
          <MaterialIcons name="error" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>Event not found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const dateTime = formatEventDateTime(event.eventDate, event.endDate, event.eventDateISO, event.endDateISO);
  const isEventFull = event.maxAttendees !== -1 && event.currentAttendees >= event.maxAttendees;
  const canRegister = !userRegistration && !isEventFull && event.status === 'published';

  // Debug logging for bulk registration
  console.log('🔍 Bulk Registration Debug:');
  console.log('  - Event ID:', event.id);
  console.log('  - Event Title:', event.title);
  console.log('  - Event Status:', event.status);
  console.log('  - Max Attendees:', event.maxAttendees);
  console.log('  - Current Attendees:', event.currentAttendees);
  console.log('  - Is Event Full:', isEventFull);
  console.log('  - User Registration:', userRegistration);
  console.log('  - Can Register:', canRegister);
  console.log('  - Allow Bulk Registrations:', event.allowBulkRegistrations);
  console.log('  - Can Bulk Register:', canBulkRegister(event, event.currentAttendees || 0));

  const allImages = getAllEventImages();

  return (
    <View style={styles.container}>
      <EventHeader 
        title="Event Details"
        rightIcon={
          isOrganizer ? (
            <TouchableOpacity onPress={() => navigation.navigate('EditEvent', { eventId: event.id, event: event })}>
              <MaterialIcons name="edit" size={24} color={COLORS.white} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Event Image(s) */}
        {allImages.length > 0 ? (
          <View style={styles.imageSection}>
            {/* Main Banner Image */}
            <TouchableOpacity onPress={() => handleImagePress(0)}>
              <Image
                source={{ uri: allImages[0] }}
                style={styles.eventImage}
                resizeMode="cover"
              />
              {allImages.length > 1 && (
                <View style={styles.imageCountBadge}>
                  <MaterialIcons name="photo-library" size={16} color={COLORS.white} />
                  <Text style={styles.imageCountText}>{allImages.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Additional Images Thumbnail Row */}
            {allImages.length > 1 && (
              <View style={styles.thumbnailContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbnailScroll}
                >
                  {allImages.slice(1, 4).map((imageUri, index) => (
                    <TouchableOpacity
                      key={index + 1}
                      onPress={() => handleImagePress(index + 1)}
                      style={styles.thumbnailWrapper}
                    >
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                      {index === 2 && allImages.length > 4 && (
                        <View style={styles.moreImagesOverlay}>
                          <Text style={styles.moreImagesText}>+{allImages.length - 4}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  {allImages.length > 4 && (
                    <TouchableOpacity
                      onPress={() => handleImagePress(4)}
                      style={styles.viewAllButton}
                    >
                      <MaterialIcons name="grid-view" size={20} color={COLORS.primary} />
                      <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: COLORS.primary }]}>
            <MaterialIcons name="event" size={48} color={COLORS.white} />
          </View>
        )}

        <View style={styles.content}>
          {/* Title and Price */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{event.title}</Text>
            <View style={[
              styles.priceBadge,
              { backgroundColor: event.eventType === 'free' ? '#4CAF50' : COLORS.primary }
            ]}>
              <Text style={styles.priceText}>
                {event.eventType === 'free' ? 'FREE' : `R${event.ticketPrice}`}
              </Text>
            </View>
          </View>

          {/* Category */}
          <View style={styles.categorySection}>
            <Text style={styles.categoryText}>
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {/* Recurrence Info */}
          {event.isRecurring && event.recurrencePattern && (
            <View style={styles.section}>
              <View style={styles.infoRow}>
                <MaterialIcons name="repeat" size={24} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Recurring Event</Text>
                  <Text style={styles.infoText}>
                    {event.recurrenceDisplayText || event.displayText || 'Recurring event series'}
                  </Text>
                  {isOrganizer && (
                    <TouchableOpacity
                      style={styles.manageSeriesButton}
                      onPress={() => {
                        navigation.navigate('RecurringSeriesManagement', {
                          eventId: event.id,
                          event: event,
                        });
                      }}
                    >
                      <Text style={styles.manageSeriesText}>Manage Series</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Date and Time */}
          <View style={styles.section}>
            {event.isRecurring ? (
              <View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="schedule" size={24} color={COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Select Instance</Text>
                    <Text style={styles.infoSubtext}>
                      Choose a date and time to register for
                    </Text>
                  </View>
                </View>
                <EventInstanceList
                  eventId={event.id}
                  instances={instances}
                  onInstanceSelect={(instance) => setSelectedInstanceId(instance.instanceId)}
                  onRegister={handleRegister}
                  isOrganizer={isOrganizer}
                  userRegistrations={userRegistration?.instanceId ? [userRegistration.instanceId] : []}
                  loading={loadingInstances}
                  hasMore={hasMoreInstances}
                  onLoadMore={() => loadEventInstances(event.id, true)}
                />
                {selectedInstanceId && (
                  <View style={styles.selectedInstanceContainer}>
                    <MaterialIcons name="check-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.selectedInstanceText}>
                      Selected: {instances.find(i => i.instanceId === selectedInstanceId)?.date} at{' '}
                      {instances.find(i => i.instanceId === selectedInstanceId)?.localTimeFormatted}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={24} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Date & Time</Text>
                  <Text style={styles.infoText}>{dateTime.date}</Text>
                  <Text style={styles.infoSubtext}>{dateTime.time}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Location */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.infoRow} onPress={openInMaps}>
              <MaterialIcons name="location-on" size={24} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Location</Text>
                <Text style={styles.infoText}>{event.location.venue}</Text>
                <Text style={styles.infoSubtext}>
                  {event.location.address}, {event.location.city}
                </Text>
              </View>
              <MaterialIcons name="launch" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Organizer */}
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={24} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Organized by</Text>
                <Text style={styles.infoText}>{event.organizerInfo.name}</Text>
                {event.organizerInfo.company && (
                  <Text style={styles.infoSubtext}>{event.organizerInfo.company}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Attendance */}
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <MaterialIcons name="people" size={24} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Attendance</Text>
                <Text style={styles.infoText}>
                  {event.maxAttendees === -1 
                    ? `${event.currentAttendees} attending`
                    : `${event.currentAttendees} / ${event.maxAttendees} attending`
                  }
                </Text>
                {isEventFull && (
                  <Text style={[styles.infoSubtext, { color: COLORS.error }]}>
                    Event is full
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Registration Status */}
          {userRegistration && (
            <View style={styles.registrationStatus}>
              <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.registrationText}>
                You're registered for this event!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {isOrganizer ? (
          <View style={styles.buttonRow}>
            {/* Publish button if draft or pending payment */}
            {(event.status === 'draft' || event.status === 'pending_payment') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton, { flex: 1, marginRight: 8 }]}
                onPress={handlePublishOrPay}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <MaterialIcons name="publish" size={20} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>
                      {event.status === 'pending_payment' ? 'Complete Payment' : 'Publish Event'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Existing organizer buttons */}
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { flex: 1, marginRight: 8 }]}
              onPress={() => navigation.navigate('QRScanner', { event })}
            >
              <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Scan QR</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { flex: 1, marginLeft: 8 }]}
              onPress={() => navigation.navigate('CheckInDashboard', { event })}
            >
              <MaterialIcons name="dashboard" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : userRegistration ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { flex: 1, marginRight: 8 }]}
              onPress={() => navigation.navigate('EventTicket', { event, ticket: userRegistration })}
            >
              <MaterialIcons name="qr-code" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>View Ticket</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.unregisterButton, { flex: 1, marginLeft: 8 }]}
              onPress={handleUnregister}
              disabled={registering}
            >
              {registering ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="cancel" size={20} color={COLORS.white} />
                  <Text style={styles.actionButtonText}>Unregister</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : canRegister ? (
          <View style={styles.registrationButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.primaryButton,
                { flex: 1, marginRight: 8 },
                event.isRecurring && !selectedInstanceId && styles.actionButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={registering || (event.isRecurring && !selectedInstanceId)}
            >
              {registering ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="event-available" size={20} color={COLORS.white} />
                  <Text style={styles.actionButtonText}>
                    {event.isRecurring && selectedInstanceId
                      ? `Register for ${instances.find(i => i.instanceId === selectedInstanceId)?.date}`
                      : 'Register'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {canBulkRegister(event, event.currentAttendees || 0) && (
              <TouchableOpacity
                style={[styles.actionButton, styles.bulkButton, { flex: 1, marginLeft: 8 }]}
                onPress={() => setShowBulkRegistration(true)}
                disabled={registering}
              >
                <MaterialIcons name="group-add" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Register Multiple</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.actionButton, styles.disabledButton]}>
            <Text style={[styles.actionButtonText, { color: COLORS.gray }]}>
              {isEventFull ? 'Event Full' : 'Registration Closed'}
            </Text>
          </View>
        )}
      </View>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setImageModalVisible(false)}
          >
            <MaterialIcons name="close" size={30} color={COLORS.white} />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageModalScroll}
            contentOffset={{ x: selectedImageIndex * Dimensions.get('window').width, y: 0 }}
          >
            {allImages.map((imageUri, index) => (
              <View key={index} style={styles.modalImageContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.imageModalFooter}>
            <Text style={styles.imageModalCounter}>
              {selectedImageIndex + 1} of {allImages.length}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Bulk Registration Modal */}
      {event && (
        <BulkRegistrationModal
          visible={showBulkRegistration}
          onClose={() => setShowBulkRegistration(false)}
          event={event}
          onSuccess={(bulkRegistrationId) => {
            setShowBulkRegistration(false);
            toast.success(
              'Bulk Registration Complete!',
              `Successfully registered ${(event as any).quantity || 2} people for ${event.title}`
            );
            // Refresh event details to show updated registration status
            loadEventDetails();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  eventImage: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 16,
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  priceText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryText: {
    fontSize: 16,
    color: COLORS.gray,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: COLORS.black,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 14,
    color: COLORS.gray,
  },
  registrationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  registrationText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  actionContainer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unregisterButton: {
    backgroundColor: COLORS.error,
  },
  disabledButton: {
    backgroundColor: COLORS.background,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
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
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.error,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registrationButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  bulkButton: {
    backgroundColor: '#4CAF50', // Success green for bulk registration
  },
  imageSection: {
    marginBottom: 24,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 4,
    borderRadius: 12,
  },
  imageCountText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  thumbnailContainer: {
    marginTop: 12,
  },
  thumbnailScroll: {
    padding: 4,
  },
  thumbnailWrapper: {
    width: 100,
    height: 100,
    marginRight: 8,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  moreImagesText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewAllButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  closeModalButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    zIndex: 1,
  },
  imageModalScroll: {
    flex: 1,
  },
  modalImageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  imageModalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  imageModalCounter: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manageSeriesButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  manageSeriesText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  selectedInstanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
  },
  selectedInstanceText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
}); 