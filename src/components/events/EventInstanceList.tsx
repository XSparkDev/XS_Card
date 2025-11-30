import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { EventInstance } from '../../types/events';

interface EventInstanceListProps {
  eventId: string;
  instances: EventInstance[];
  onInstanceSelect?: (instance: EventInstance) => void;
  onRegister?: (instanceId: string) => void;
  isOrganizer?: boolean;
  userRegistrations?: string[]; // Array of instanceIds user is registered for
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

interface GroupedInstances {
  [monthKey: string]: EventInstance[];
}

export default function EventInstanceList({
  eventId,
  instances,
  onInstanceSelect,
  onRegister,
  isOrganizer = false,
  userRegistrations = [],
  loading = false,
  hasMore = false,
  onLoadMore,
}: EventInstanceListProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  const groupInstancesByMonth = (): GroupedInstances => {
    const grouped: GroupedInstances = {};
    
    instances.forEach((instance) => {
      const date = new Date(instance.eventDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(instance);
    });

    // Sort instances within each month
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => 
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );
    });

    return grouped;
  };

  const formatMonthHeader = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getInstanceStatus = (instance: EventInstance): {
    status: 'available' | 'full' | 'past' | 'cancelled';
    color: string;
    text: string;
  } => {
    const now = new Date();
    const instanceDate = new Date(instance.eventDate);
    
    if (instance.isCancelled) {
      return {
        status: 'cancelled',
        color: COLORS.gray,
        text: 'Cancelled',
      };
    }
    
    if (instanceDate < now) {
      return {
        status: 'past',
        color: COLORS.gray,
        text: 'Past',
      };
    }
    
    if (instance.maxAttendees > 0 && instance.attendeeCount >= instance.maxAttendees) {
      return {
        status: 'full',
        color: COLORS.error,
        text: 'Full',
      };
    }
    
    return {
      status: 'available',
      color: '#4CAF50',
      text: 'Available',
    };
  };

  const getAvailabilityText = (instance: EventInstance): string => {
    if (instance.maxAttendees === 0 || instance.maxAttendees === -1) {
      return 'Unlimited';
    }
    const remaining = instance.maxAttendees - instance.attendeeCount;
    return `${remaining} / ${instance.maxAttendees} spots available`;
  };

  const handleInstancePress = (instance: EventInstance) => {
    setSelectedInstanceId(instance.instanceId);
    if (onInstanceSelect) {
      onInstanceSelect(instance);
    }
  };

  const handleRegister = (instance: EventInstance) => {
    if (onRegister) {
      onRegister(instance.instanceId);
    }
  };

  const groupedInstances = groupInstancesByMonth();
  const monthKeys = Object.keys(groupedInstances).sort();

  if (loading && instances.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading instances...</Text>
      </View>
    );
  }

  if (instances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="event-busy" size={48} color={COLORS.gray} />
        <Text style={styles.emptyText}>No instances available</Text>
        <Text style={styles.emptySubtext}>
          This recurring event series may have ended or all instances have been cancelled.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {monthKeys.map((monthKey) => {
          const monthInstances = groupedInstances[monthKey];
          const isExpanded = expandedMonths.has(monthKey);
          
          return (
            <View key={monthKey} style={styles.monthSection}>
              <TouchableOpacity
                style={styles.monthHeader}
                onPress={() => toggleMonth(monthKey)}
              >
                <Text style={styles.monthHeaderText}>{formatMonthHeader(monthKey)}</Text>
                <Text style={styles.monthCountText}>({monthInstances.length})</Text>
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={COLORS.gray}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.instancesContainer}>
                  {monthInstances.map((instance) => {
                    const status = getInstanceStatus(instance);
                    const isSelected = selectedInstanceId === instance.instanceId;
                    const isRegistered = userRegistrations.includes(instance.instanceId);
                    const canRegister = status.status === 'available' && !isRegistered && !isOrganizer;
                    
                    return (
                      <TouchableOpacity
                        key={instance.instanceId}
                        style={[
                          styles.instanceCard,
                          isSelected && styles.instanceCardSelected,
                          status.status === 'cancelled' && styles.instanceCardCancelled,
                        ]}
                        onPress={() => handleInstancePress(instance)}
                        disabled={status.status === 'past' || status.status === 'cancelled'}
                      >
                        <View style={styles.instanceHeader}>
                          <View style={styles.instanceDateContainer}>
                            <Text style={styles.instanceDay}>{instance.dayOfWeek}</Text>
                            <Text style={styles.instanceDate}>{instance.date}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                            <Text style={styles.statusText}>{status.text}</Text>
                          </View>
                        </View>

                        <View style={styles.instanceDetails}>
                          <View style={styles.instanceDetailRow}>
                            <MaterialIcons name="access-time" size={16} color={COLORS.gray} />
                            <Text style={styles.instanceDetailText}>
                              {instance.localTimeFormatted} {instance.timezoneAbbr}
                            </Text>
                          </View>
                          <View style={styles.instanceDetailRow}>
                            <MaterialIcons name="people" size={16} color={COLORS.gray} />
                            <Text style={styles.instanceDetailText}>
                              {getAvailabilityText(instance)}
                            </Text>
                          </View>
                        </View>

                        {canRegister && (
                          <TouchableOpacity
                            style={styles.registerButton}
                            onPress={() => handleRegister(instance)}
                          >
                            <Text style={styles.registerButtonText}>Register</Text>
                          </TouchableOpacity>
                        )}

                        {isRegistered && (
                          <View style={styles.registeredBadge}>
                            <MaterialIcons name="check-circle" size={16} color={COLORS.primary} />
                            <Text style={styles.registeredText}>Registered</Text>
                          </View>
                        )}

                        {isOrganizer && (
                          <View style={styles.organizerActions}>
                            <Text style={styles.organizerText}>
                              {instance.attendeeCount} registered
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {hasMore && onLoadMore && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Text style={styles.loadMoreText}>Load 12 more</Text>
                <MaterialIcons name="expand-more" size={20} color={COLORS.primary} />
              </>
            )}
          </TouchableOpacity>
        )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  monthSection: {
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '20',
  },
  monthHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    flex: 1,
  },
  monthCountText: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  instancesContainer: {
    padding: 8,
  },
  instanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.gray + '30',
  },
  instanceCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primary + '10',
  },
  instanceCardCancelled: {
    opacity: 0.5,
  },
  instanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instanceDateContainer: {
    flex: 1,
  },
  instanceDay: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  instanceDate: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  instanceDetails: {
    marginBottom: 12,
  },
  instanceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  instanceDetailText: {
    fontSize: 14,
    color: COLORS.black,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
  },
  registeredText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  organizerActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
  },
  organizerText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});





