import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useColorScheme } from '../../context/ColorSchemeContext';
import { useEventNotifications } from '../../context/EventNotificationContext';
import { authenticatedFetchWithRefresh, ENDPOINTS, API_BASE_URL } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { getRecentEvents, RecentEvent } from '../../utils/recentEvents';
import {
  Event,
  EventListResponse,
  EventFilters,
  EVENT_CATEGORIES,
  EventCategory,
} from '../../types/events';
import { enhanceEventsWithOrganizerInfo } from '../../services/eventService';
import EventCard from './components/EventCard';
import EventFiltersComponent from './components/EventFilters';
import EventNotificationToast from '../../components/EventNotificationToast';

// Navigation types
type RootStackParamList = {
  EventDetails: { eventId: string; event?: Event };
  CreateEvent: undefined;
  MyEvents: undefined;
  EventRegistrations: undefined;
  EventPreferences: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EVENTS_ENDPOINT = '/events/public';

export default function EventsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme } = useColorScheme();
  const { connected, connectToSocket, notifications } = useEventNotifications();
  const toast = useToast();

  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({
    search: '',
    category: '',
    eventType: undefined,
    limit: 20,
    page: 1,
  });
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastProcessedNotificationId, setLastProcessedNotificationId] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  // Collapsible recently viewed section state
  const [isRecentEventsExpanded, setIsRecentEventsExpanded] = useState(true);
  const [recentEventsHeight] = useState(new Animated.Value(1)); // Start expanded
  const [recentEventsRotation] = useState(new Animated.Value(0)); // For chevron rotation

  // Load events when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      loadEvents(true);
      loadRecentEvents();
      
      // Auto-connect to real-time updates if not connected
      if (!connected) {
        console.log('[EventsScreen] Auto-connecting to real-time updates...');
        connectToSocket();
      }
    }, [filters, connected])
  );

  // Listen for real-time event notifications
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
      
      // Check for new event notifications and refresh list
      if (latestNotification.type === 'new_event' || latestNotification.type === 'event_update') {
        console.log('[EventsScreen] Received real-time event update, refreshing list...');
        loadEvents(true);
      }
      
      // Handle organizer notifications for registrations
      if (latestNotification.type === 'new_registration') {
        console.log('[EventsScreen] Received new registration notification for organizer');
        toast.success(
          '👤 New Registration',
          `${latestNotification.registration?.userName} registered for your event "${latestNotification.event?.title}"`
        );
      }
      
      if (latestNotification.type === 'event_unregistration') {
        console.log('[EventsScreen] Received unregistration notification for organizer');
        toast.info(
          '👋 Unregistration',
          `${latestNotification.unregistration?.userName} unregistered from your event "${latestNotification.event?.title}"`
        );
      }
    }
  }, [notifications, lastProcessedNotificationId]);

  // Load events function
  const loadEvents = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setEvents([]);
      }

      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('q', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.eventType) queryParams.append('eventType', filters.eventType);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      queryParams.append('limit', (filters.limit || 20).toString());
      queryParams.append('page', (filters.page || 1).toString());

      const endpoint = filters.search 
        ? `${ENDPOINTS.SEARCH_EVENTS}?${queryParams.toString()}`
        : `${ENDPOINTS.GET_PUBLIC_EVENTS}?${queryParams.toString()}`;

      // Prepare headers - include auth if available, but don't require it
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      try {
        // Try to add authentication headers if user is logged in
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          headers['Authorization'] = token;
          console.log('[EventsScreen] Using authenticated request for private event visibility');
        } else {
          console.log('[EventsScreen] Using anonymous request - only public events will be visible');
        }
      } catch (authError) {
        console.log('[EventsScreen] Could not get auth token, proceeding anonymously:', authError);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to load events: ${response.status} - ${errorText}`);
      }

      const data: EventListResponse = await response.json();

      if (data.success) {
        const newEvents = data.data.events;
        
        // Enhance events with correct organizer information
        const enhancedEvents = await enhanceEventsWithOrganizerInfo(newEvents);
        
        if (reset) {
          setEvents(enhancedEvents);
        } else {
          setEvents(prev => [...prev, ...enhancedEvents]);
        }

        // Check if there are more events to load
        const { currentPage, totalPages } = data.data.pagination;
        setHasMore(currentPage < totalPages);
      } else {
        throw new Error('Failed to load events');
      }
    } catch (error) {
      console.error('Error loading events:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        'Error loading events',
        `Failed to load events: ${errorMessage}. Please check your internet connection and try again.`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Load recent events
  const loadRecentEvents = async () => {
    try {
      const recents = await getRecentEvents();
      setRecentEvents(recents);
    } catch (error) {
      console.error('Error loading recent events:', error);
    }
  };

  // Load and save recent events collapse state
  useEffect(() => {
    loadRecentEventsState();
  }, []);

  const loadRecentEventsState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('recentEventsExpanded');
      if (savedState !== null) {
        const isExpanded = JSON.parse(savedState);
        setIsRecentEventsExpanded(isExpanded);
        // Set initial animation values
        recentEventsHeight.setValue(isExpanded ? 1 : 0);
        recentEventsRotation.setValue(isExpanded ? 0 : 1);
      }
    } catch (error) {
      console.error('Error loading recent events state:', error);
    }
  };

  const saveRecentEventsState = async (isExpanded: boolean) => {
    try {
      await AsyncStorage.setItem('recentEventsExpanded', JSON.stringify(isExpanded));
    } catch (error) {
      console.error('Error saving recent events state:', error);
    }
  };

  const toggleRecentEventsExpanded = () => {
    const newExpandedState = !isRecentEventsExpanded;
    setIsRecentEventsExpanded(newExpandedState);
    saveRecentEventsState(newExpandedState);

    // Animate height and rotation
    Animated.parallel([
      Animated.timing(recentEventsHeight, {
        toValue: newExpandedState ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(recentEventsRotation, {
        toValue: newExpandedState ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        search: text.trim(),
        page: 1,
      }));
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<EventFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1,
    }));
    setShowFilters(false);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setFilters(prev => ({ ...prev, page: 1 }));
    loadEvents(true);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setFilters(prev => ({
        ...prev,
        page: (prev.page || 1) + 1,
      }));
    }
  };

  // Handle event press
  const handleEventPress = (event: Event) => {
    navigation.navigate('EventDetails', { 
      eventId: event.id,
      event: event 
    });
  };

  // Handle recent event press
  const handleRecentEventPress = (recentEvent: RecentEvent) => {
    navigation.navigate('EventDetails', { 
      eventId: recentEvent.id
    });
  };

  // Load more events for pagination
  const loadMoreEvents = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = (filters.page || 1) + 1;
      const queryParams = new URLSearchParams({
        limit: filters.limit?.toString() || '20',
        page: nextPage.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.eventType && { eventType: filters.eventType }),
      });

      // Prepare headers - include auth if available, but don't require it
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      try {
        // Try to add authentication headers if user is logged in
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          headers['Authorization'] = token;
        }
      } catch (authError) {
        console.log('[EventsScreen] Could not get auth token for load more, proceeding anonymously:', authError);
      }

      const response = await fetch(`${API_BASE_URL}${EVENTS_ENDPOINT}?${queryParams}`, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load more events: ${response.status}`);
      }

      const data: EventListResponse = await response.json();

      if (data.success && data.data.events.length > 0) {
        // Enhance events with correct organizer information
        const enhancedEvents = await enhanceEventsWithOrganizerInfo(data.data.events);
        
        setEvents(prev => [...prev, ...enhancedEvents]);
        setFilters(prev => ({ ...prev, page: nextPage }));
        
        // Check if there are more pages
        if (nextPage >= data.data.pagination.totalPages) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more events:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        'Error loading more events',
        `Failed to load more events: ${errorMessage}`
      );
    } finally {
      setLoadingMore(false);
    }
  };

  // Render event item
  const renderEventItem = ({ item }: { item: Event }) => (
    <EventCard
      event={item}
      onPress={() => handleEventPress(item)}
    />
  );

  // Render recent events section
  const renderRecentEvents = () => {
    if (recentEvents.length === 0) return null;

    const chevronRotation = recentEventsRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    return (
      <View style={styles.recentSection}>
        {/* Collapsible Header */}
        <TouchableOpacity 
          style={styles.recentHeader}
          onPress={toggleRecentEventsExpanded}
          activeOpacity={0.7}
        >
          <View style={styles.recentHeaderContent}>
            <Text style={styles.recentTitle}>Recently Viewed</Text>
            <Text style={styles.recentCount}>({recentEvents.length})</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <MaterialIcons 
              name="expand-more" 
              size={24} 
              color={COLORS.gray} 
            />
          </Animated.View>
        </TouchableOpacity>

        {/* Collapsible Content */}
        <Animated.View
          style={[
            styles.recentContent,
            {
              opacity: recentEventsHeight,
              maxHeight: recentEventsHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 200], // Adjust based on your content height
              }),
              overflow: 'hidden',
            },
          ]}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.recentScroll}
            contentContainerStyle={styles.recentScrollContent}
          >
            {recentEvents.map((recentEvent) => (
              <TouchableOpacity
                key={recentEvent.id}
                style={styles.recentCard}
                onPress={() => handleRecentEventPress(recentEvent)}
              >
                {recentEvent.bannerImage ? (
                  <Image 
                    source={{ uri: recentEvent.bannerImage }} 
                    style={styles.recentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.recentImage, styles.recentImagePlaceholder]}>
                    <MaterialIcons name="event" size={24} color={COLORS.gray} />
                  </View>
                )}
                <View style={styles.recentInfo}>
                  <Text style={styles.recentEventTitle} numberOfLines={2}>
                    {recentEvent.title}
                  </Text>
                  <Text style={styles.recentEventVenue} numberOfLines={1}>
                    {recentEvent.location.venue}
                  </Text>
                  <Text style={styles.recentEventCity} numberOfLines={1}>
                    {recentEvent.location.city}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="event-busy" size={64} color={COLORS.gray} />
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || filters.category || filters.eventType
          ? 'Try adjusting your search or filters to find more events.'
          : 'Be the first to create an event in your area!'}
      </Text>
    </View>
  );

  // Render loading footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerText}>Loading more events...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Events" 
        rightIcon={
          <View style={styles.headerIcons}>
            {/* Connection Status Indicator */}
            <View style={[
              styles.connectionIndicator,
              { backgroundColor: connected ? '#4CAF50' : '#FF5722' }
            ]} />
            
            {/* Filter Button */}
            <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
              <MaterialIcons 
                name={showFilters ? "filter-list-off" : "filter-list"} 
                size={24} 
                color={COLORS.white} 
              />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor={COLORS.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch(searchQuery)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              handleSearch('');
            }}>
              <MaterialIcons name="close" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('MyEvents')}
          >
            <MaterialIcons name="event-note" size={20} color={COLORS.primary} />
            <Text style={styles.quickActionText}>My Events</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('EventPreferences')}
          >
            <MaterialIcons name="tune" size={20} color={COLORS.primary} />
            <Text style={styles.quickActionText}>Personalize</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <MaterialIcons name="add" size={20} color={COLORS.primary} />
            <Text style={styles.quickActionText}>New Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Status Banner */}
      {!connected && (
        <View style={styles.connectionBanner}>
          <MaterialIcons name="wifi-off" size={16} color={COLORS.white} />
          <Text style={styles.connectionBannerText}>
            Not connected to real-time updates
          </Text>
          <TouchableOpacity onPress={connectToSocket}>
            <Text style={styles.connectText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters */}
      {showFilters && (
        <EventFiltersComponent
          filters={filters}
          onFiltersChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Events List */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Discovering amazing events...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            events.length === 0 && styles.emptyListContainer
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          onEndReached={loadMoreEvents}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
        />
      )}

      {renderRecentEvents()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 120, // Account for header height
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
    paddingVertical: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Account for fab
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
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
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FF5722',
    borderTopWidth: 1,
    borderTopColor: '#FF5722',
  },
  connectionBannerText: {
    fontSize: 16,
    color: COLORS.white,
    marginRight: 8,
  },
  connectText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 16,
    color: COLORS.primary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minWidth: 100,
    flex: 1,
    maxWidth: '32%',
    gap: 4,
  },
  quickActionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  recentSection: {
    padding: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  recentHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  recentCount: {
    fontSize: 14,
    color: COLORS.gray,
  },
  recentContent: {
    padding: 8,
  },
  recentScroll: {
    padding: 8,
  },
  recentScrollContent: {
    gap: 12,
  },
  recentCard: {
    width: 140,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  recentImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.border,
  },
  recentInfo: {
    flex: 1,
  },
  recentEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  recentEventVenue: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  recentEventCity: {
    fontSize: 12,
    color: COLORS.gray,
  },
}); 