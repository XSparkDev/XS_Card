import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { authenticatedFetchWithRefresh, ENDPOINTS, getEventInstances, endRecurringSeries } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { Event, EventInstance } from '../../types/events';
import EventInstanceList from '../../components/events/EventInstanceList';

type RootStackParamList = {
  RecurringSeriesManagement: { eventId: string; event?: Event };
  EditEvent: { eventId: string; event?: Event };
  MyEvents: undefined;
};

type RecurringSeriesManagementRouteProp = RouteProp<RootStackParamList, 'RecurringSeriesManagement'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RecurringSeriesManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RecurringSeriesManagementRouteProp>();
  const toast = useToast();

  const { eventId, event: passedEvent } = route.params;

  const [event, setEvent] = useState<Event | null>(passedEvent || null);
  const [loading, setLoading] = useState(!passedEvent);
  const [instances, setInstances] = useState<EventInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [hasMoreInstances, setHasMoreInstances] = useState(false);

  useEffect(() => {
    if (!passedEvent) {
      loadEventDetails();
    } else {
      loadEventInstances();
    }
  }, [eventId, passedEvent]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.GET_EVENT_DETAILS.replace(':eventId', eventId),
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to load event details');
      }

      const data = await response.json();
      if (data.success && data.data.event) {
        setEvent(data.data.event);
        loadEventInstances();
      } else {
        throw new Error('Event not found');
      }
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Error', 'Failed to load event details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadEventInstances = async (loadMore = false) => {
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
      console.error('Error loading instances:', error);
      toast.error('Error', 'Failed to load event instances');
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleEndSeries = async () => {
    if (!event) return;

    Alert.alert(
      'End Recurring Series',
      'This will end all future instances of this recurring event series. This action cannot be undone. Continue?',
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
              navigation.goBack();
            } catch (error) {
              console.error('Error ending series:', error);
              toast.error('Error', 'Failed to end series. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditSeries = () => {
    if (!event) return;

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
            navigation.navigate('EditEvent', { eventId: event.id, event });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <EventHeader title="Manage Series" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading series details...</Text>
        </View>
      </View>
    );
  }

  if (!event || !event.isRecurring) {
    return (
      <View style={styles.container}>
        <EventHeader title="Manage Series" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>This event is not a recurring series</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalRegistrations = instances.reduce((sum, instance) => sum + instance.attendeeCount, 0);
  const upcomingInstances = instances.filter(i => new Date(i.eventDate) >= new Date());

  return (
    <View style={styles.container}>
      <EventHeader title="Manage Series" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Series Overview */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Series Overview</Text>
          
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <MaterialIcons name="repeat" size={20} color={COLORS.primary} />
              <View style={styles.overviewContent}>
                <Text style={styles.overviewLabel}>Recurrence Pattern</Text>
                <Text style={styles.overviewValue}>
                  {event.recurrenceDisplayText || event.displayText || 'Recurring event series'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{upcomingInstances.length}</Text>
              <Text style={styles.statLabel}>Upcoming Instances</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalRegistrations}</Text>
              <Text style={styles.statLabel}>Total Registrations</Text>
            </View>
            {event.recurrencePattern?.endDate ? (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {new Date(event.recurrencePattern.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.statLabel}>Ends On</Text>
              </View>
            ) : (
              <View style={styles.statCard}>
                <MaterialIcons name="all-inclusive" size={24} color={COLORS.primary} />
                <Text style={styles.statLabel}>Never Ends</Text>
              </View>
            )}
          </View>
        </View>

        {/* Series Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Series Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEditSeries}
          >
            <MaterialIcons name="edit" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Edit Series</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={handleEndSeries}
          >
            <MaterialIcons name="stop" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>End Series</Text>
          </TouchableOpacity>
        </View>

        {/* Instance List */}
        <View style={styles.instancesSection}>
          <Text style={styles.sectionTitle}>All Instances</Text>
          <EventInstanceList
            eventId={event.id}
            instances={instances}
            isOrganizer={true}
            loading={loadingInstances}
            hasMore={hasMoreInstances}
            onLoadMore={() => loadEventInstances(true)}
          />
        </View>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  overviewSection: {
    padding: 16,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
  },
  overviewCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewContent: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  actionsSection: {
    padding: 16,
    paddingTop: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: COLORS.primary,
  },
  endButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  instancesSection: {
    padding: 16,
    paddingTop: 0,
  },
});






