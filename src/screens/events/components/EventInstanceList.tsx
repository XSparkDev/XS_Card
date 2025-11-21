import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { EventInstance } from '../../../types/events';
import { getEventInstances } from '../../../utils/api';
import { formatInstanceDate } from '../../../utils/eventsRecurrence';

interface EventInstanceListProps {
  eventId: string;
  onSelectInstance: (instance: EventInstance) => void;
  selectedInstanceId?: string | null;
  maxAttendees: number;
}

interface GroupedInstances {
  month: string;
  instances: EventInstance[];
}

export default function EventInstanceList({ 
  eventId, 
  onSelectInstance, 
  selectedInstanceId,
  maxAttendees 
}: EventInstanceListProps) {
  const [instances, setInstances] = useState<EventInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(12);

  useEffect(() => {
    loadInstances();
  }, [eventId]);

  const loadInstances = async (refresh: boolean = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setCurrentLimit(12);
      } else {
        setLoading(true);
      }

      const response = await getEventInstances(eventId, { limit: currentLimit });
      
      if (response.success) {
        setInstances(response.data.instances || []);
        setHasMore(response.data.hasMore || false);
      }
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const newLimit = currentLimit + 12;
      
      const response = await getEventInstances(eventId, { limit: newLimit });
      
      if (response.success) {
        setInstances(response.data.instances || []);
        setHasMore(response.data.hasMore || false);
        setCurrentLimit(newLimit);
      }
    } catch (error) {
      console.error('Error loading more instances:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Group instances by month
  const groupInstancesByMonth = (): GroupedInstances[] => {
    const grouped: { [key: string]: EventInstance[] } = {};
    
    instances.forEach(instance => {
      const date = new Date(instance.date);
      const monthKey = date.toLocaleDateString([], { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(instance);
    });
    
    return Object.entries(grouped).map(([month, instances]) => ({
      month,
      instances
    }));
  };

  const renderInstance = (instance: EventInstance) => {
    const isSelected = selectedInstanceId === instance.instanceId;
    const spotsLeft = maxAttendees - (instance.attendeeCount || 0);
    const isFull = maxAttendees > 0 && spotsLeft <= 0;
    const isAlmostFull = maxAttendees > 0 && spotsLeft <= 5 && spotsLeft > 0;
    
    return (
      <TouchableOpacity
        key={instance.instanceId}
        style={[
          styles.instanceCard,
          isSelected && styles.instanceCardSelected,
          isFull && styles.instanceCardDisabled
        ]}
        onPress={() => !isFull && onSelectInstance(instance)}
        disabled={isFull}
      >
        <View style={styles.instanceHeader}>
          <View style={styles.instanceDateContainer}>
            <MaterialIcons 
              name="event" 
              size={20} 
              color={isSelected ? COLORS.primary : COLORS.gray} 
            />
            <View style={styles.instanceDateText}>
              <Text style={[
                styles.instanceDayOfWeek,
                isSelected && styles.instanceTextSelected
              ]}>
                {instance.dayOfWeek}
              </Text>
              <Text style={[
                styles.instanceDate,
                isSelected && styles.instanceTextSelected,
                isFull && styles.instanceTextDisabled
              ]}>
                {formatInstanceDate(instance.instanceId, instance.localTime)}
              </Text>
            </View>
          </View>
          
          {isSelected && (
            <View style={styles.selectedBadge}>
              <MaterialIcons name="check-circle" size={20} color={COLORS.primary} />
            </View>
          )}
        </View>
        
        <View style={styles.instanceFooter}>
          <View style={styles.attendeeInfo}>
            <MaterialIcons 
              name="people" 
              size={16} 
              color={isFull ? COLORS.error : isAlmostFull ? '#FF8C00' : COLORS.gray} 
            />
            <Text style={[
              styles.attendeeText,
              isFull && { color: COLORS.error },
              isAlmostFull && { color: '#FF8C00' }
            ]}>
              {isFull ? 'FULL' : maxAttendees > 0 ? `${spotsLeft} spots left` : `${instance.attendeeCount || 0} attending`}
            </Text>
          </View>
          
          {!isFull && !isSelected && (
            <Text style={styles.selectText}>Tap to select</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMonthGroup = ({ item }: { item: GroupedInstances }) => (
    <View style={styles.monthGroup}>
      <Text style={styles.monthHeader}>{item.month}</Text>
      {item.instances.map(instance => renderInstance(instance))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading available dates...</Text>
      </View>
    );
  }

  if (instances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="event-busy" size={48} color={COLORS.gray} />
        <Text style={styles.emptyText}>No upcoming occurrences available</Text>
      </View>
    );
  }

  const groupedInstances = groupInstancesByMonth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select an occurrence</Text>
        <Text style={styles.subtitle}>Choose a date and time to attend</Text>
      </View>
      
      <FlatList
        data={groupedInstances}
        renderItem={renderMonthGroup}
        keyExtractor={(item) => item.month}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInstances(true)}
            colors={[COLORS.primary]}
          />
        }
        ListFooterComponent={() => (
          hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialIcons name="expand-more" size={20} color={COLORS.primary} />
                  <Text style={styles.loadMoreText}>Load 12 more dates</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  monthGroup: {
    marginBottom: 16,
  },
  monthHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  instanceCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },
  instanceCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E3F2FD',
  },
  instanceCardDisabled: {
    opacity: 0.5,
  },
  instanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  instanceDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instanceDateText: {
    flex: 1,
  },
  instanceDayOfWeek: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  instanceDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  instanceTextSelected: {
    color: COLORS.primary,
  },
  instanceTextDisabled: {
    color: COLORS.gray,
  },
  selectedBadge: {
    marginLeft: 8,
  },
  instanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendeeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  selectText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.gray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
  },
});

