import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { 
  getEventAttendees, 
  getCheckInStats, 
  exportAttendeesToCSV,
  getEventDetails 
} from '../../services/eventService';
import { useToast } from '../../hooks/useToast';
import { 
  Event, 
  EventAttendee, 
  CheckInStatsResponse,
  AttendeesResponse 
} from '../../types/events';
import { COLORS } from '../../constants/colors';

interface CheckInDashboardProps {
  route: {
    params: {
      event: Event;
    };
  };
}

type RootStackParamList = {
  QRScanner: { event: Event };
  CheckInDashboard: { event: Event };
  EventAnalytics: { event: Event };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: COLORS.primary,
  },
};

// Helper function to safely format dates
const formatDate = (dateString: string | undefined | null, isoDateString?: string): string => {
  try {
    if (!dateString && !isoDateString) {
      return 'Date not available';
    }

    const rawDate = isoDateString || dateString;
    if (!rawDate) {
      return 'Date not available';
    }

    // Check if it's already a formatted string (contains "at")
    if (rawDate.includes(' at ')) {
      return rawDate; // Return as-is if already formatted
    }

    let date: Date;
    
    // Try to parse as a proper date
    if (isoDateString) {
      date = new Date(isoDateString);
    } else {
      date = new Date(dateString!);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', { dateString, isoDateString });
      return rawDate; // Return original string if we can't parse it
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString || 'Invalid date';
  }
};

const formatDateTime = (dateString: string | undefined | null, isoDateString?: string): string => {
  try {
    if (!dateString && !isoDateString) {
      return 'Date not available';
    }

    const rawDate = isoDateString || dateString;
    if (!rawDate) {
      return 'Date not available';
    }

    // Check if it's already a formatted string (contains "at")
    if (rawDate.includes(' at ')) {
      return rawDate; // Return as-is if already formatted
    }

    let date: Date;
    
    // Try to parse as a proper date
    if (isoDateString) {
      date = new Date(isoDateString);
    } else {
      date = new Date(dateString!);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', { dateString, isoDateString });
      return rawDate; // Return original string if we can't parse it
    }

    return date.toLocaleString();
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return dateString || 'Invalid date';
  }
};

const formatTime = (dateString: string | undefined | null): string => {
  try {
    if (!dateString) {
      return 'Time not available';
    }

    // Check if it's already a formatted string (contains "at")
    if (dateString.includes(' at ')) {
      // Extract time part from formatted string like "July 7 2025 at 12:21:20 PM GMT+2"
      const parts = dateString.split(' at ');
      if (parts.length > 1) {
        return parts[1]; // Return the time part
      }
      return dateString; // Return as-is if we can't split
    }

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid time string:', dateString);
      return dateString; // Return original string if we can't parse it
    }

    return date.toLocaleTimeString();
  } catch (error) {
    console.error('Error formatting time:', error);
    return dateString || 'Invalid time';
  }
};

export const CheckInDashboard: React.FC = () => {
  const route = useRoute() as CheckInDashboardProps['route'];
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { event: initialEvent } = route.params;

  const [event, setEvent] = useState<Event>(initialEvent);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [filteredAttendees, setFilteredAttendees] = useState<EventAttendee[]>([]);
  const [stats, setStats] = useState<CheckInStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<EventAttendee | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'checked-in' | 'pending'>('all');
  const [silentRefreshTimer, setSilentRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      
      // Set up auto-refresh for real-time updates
      const interval = setInterval(() => {
        loadDashboardData(true); // Silent refresh
      }, 30000); // Refresh every 30 seconds
      
      setSilentRefreshTimer(interval);
      
      return () => {
        clearInterval(interval);
        if (silentRefreshTimer) {
          clearInterval(silentRefreshTimer);
        }
      };
    }, [])
  );

  // Cleanup timer when component unmounts
  useEffect(() => {
    return () => {
      if (silentRefreshTimer) {
        clearInterval(silentRefreshTimer);
      }
    };
  }, [silentRefreshTimer]);

  // Filter attendees based on search and status
  useEffect(() => {
    let filtered = attendees;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(attendee => {
        const searchTerm = searchQuery.toLowerCase();
        return (
          attendee.userData?.name?.toLowerCase().includes(searchTerm) ||
          attendee.userData?.email?.toLowerCase().includes(searchTerm) ||
          attendee.userData?.company?.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(attendee => {
        if (filterStatus === 'checked-in') {
          return attendee.checkedIn;
        } else if (filterStatus === 'pending') {
          return !attendee.checkedIn;
        }
        return true;
      });
    }

    setFilteredAttendees(filtered);
  }, [attendees, searchQuery, filterStatus]);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      await Promise.all([
        loadEventDetails(),
        loadAttendees(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showError('Failed to load dashboard data');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadEventDetails = async () => {
    try {
      const response = await getEventDetails(event.id);
      if (response.success) {
        setEvent(response.data.event);
      }
    } catch (error) {
      console.error('Error loading event details:', error);
    }
  };

  const loadAttendees = async () => {
    try {
      const response: AttendeesResponse = await getEventAttendees(event.id);
      if (response.success) {
        setAttendees(response.attendees);
      }
    } catch (error) {
      console.error('Error loading attendees:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response: CheckInStatsResponse = await getCheckInStats(event.id);
      if (response.success) {
        setStats(response);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const openQRScanner = () => {
    navigation.navigate('QRScanner', { event });
  };

  const exportAttendees = async () => {
    try {
      setExporting(true);
      
      // Check if we have attendees data
      if (!attendees || attendees.length === 0) {
        showError('No attendees to export');
        return;
      }

      const result = await exportAttendeesToCSV(event.id, attendees, event.title);
      
      if (result.success) {
        success('Attendees exported successfully');
      } else {
        // Don't show error for user cancellation
        if (result.message && result.message.includes('cancelled by user')) {
          // User cancelled, no need to show error
          return;
        }
        showError(result.message || 'Failed to export attendees');
      }
    } catch (error) {
      console.error('Export error:', error);
      showError('Unable to export attendee list. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const showAttendeeDetails = (attendee: EventAttendee) => {
    setSelectedAttendee(attendee);
    setModalVisible(true);
  };

  const renderCheckInChart = () => {
    // Charts moved to Analytics screen
    return null;
  };

  const renderStatusPieChart = () => {
    // Charts moved to Analytics screen  
    return null;
  };

  const renderAttendeeItem = ({ item }: { item: EventAttendee }) => (
    <TouchableOpacity 
      style={styles.attendeeItem}
      onPress={() => showAttendeeDetails(item)}
    >
      <View style={styles.attendeeInfo}>
        <Text style={styles.attendeeName}>
          {item.userData?.name || 'Unknown Attendee'}
        </Text>
        <Text style={styles.attendeeEmail}>
          {item.userData?.email || ''}
        </Text>
        {item.userData?.company && (
          <Text style={styles.attendeeCompany}>{item.userData.company}</Text>
        )}
      </View>
      <View style={styles.attendeeStatus}>
        <MaterialIcons
          name={item.checkedIn ? 'check-circle' : 'schedule'}
          size={20}
          color={item.checkedIn ? COLORS.success : COLORS.warning}
        />
        <Text style={[
          styles.statusText,
          { color: item.checkedIn ? COLORS.success : COLORS.warning }
        ]}>
          {item.checkedIn ? 'Checked In' : 'Pending'}
        </Text>
        {item.checkedIn && item.checkedInAt && (
          <Text style={styles.checkInTime}>
            {formatTime(item.checkedInAt)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check-in Dashboard</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>
            {(() => {
              const dateStr = event.eventDateISO || event.eventDate;
              // If date already contains "at", display as-is
              if (dateStr && dateStr.includes(' at ')) {
                return dateStr;
              }
              // Otherwise, format date and time separately
              return `${formatDate(event.eventDate, event.eventDateISO)} at ${formatTime(event.eventDateISO || event.eventDate)}`;
            })()}
          </Text>
          <Text style={styles.eventLocation}>{event.location.venue}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={openQRScanner}>
            <MaterialIcons name="qr-code-scanner" size={18} color="white" />
            <Text style={styles.buttonText}>Scan QR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('EventAnalytics', { event })}
          >
            <MaterialIcons name="analytics" size={18} color="white" />
            <Text style={styles.buttonText}>Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.secondaryButton, exporting && styles.disabledButton]}
            onPress={exportAttendees}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="download" size={18} color="white" />
            )}
            <Text style={styles.buttonText}>
              {exporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Attendees List */}
        <View style={styles.attendeesSection}>
          <Text style={styles.sectionTitle}>Attendees ({attendees.length})</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search attendees..."
                placeholderTextColor={COLORS.gray}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={20} color={COLORS.gray} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterStatus === 'all' && styles.filterButtonActive
              ]}
              onPress={() => setFilterStatus('all')}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'all' && styles.filterButtonTextActive
              ]}>
                All ({attendees.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filterStatus === 'checked-in' && styles.filterButtonActive
              ]}
              onPress={() => setFilterStatus('checked-in')}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'checked-in' && styles.filterButtonTextActive
              ]}>
                Checked In ({attendees.filter(a => a.checkedIn).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filterStatus === 'pending' && styles.filterButtonActive
              ]}
              onPress={() => setFilterStatus('pending')}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === 'pending' && styles.filterButtonTextActive
              ]}>
                Pending ({attendees.filter(a => !a.checkedIn).length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results Count */}
          {filteredAttendees.length !== attendees.length && (
            <Text style={styles.resultsText}>
              Showing {filteredAttendees.length} of {attendees.length} attendees
            </Text>
          )}

          <FlatList
            data={filteredAttendees}
            renderItem={renderAttendeeItem}
            keyExtractor={(item) => item.ticketId}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="people" size={48} color={COLORS.gray} />
                <Text style={styles.emptyStateText}>
                  {searchQuery || filterStatus !== 'all' 
                    ? 'No attendees match your filters'
                    : 'No attendees registered yet'
                  }
                </Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      {/* Attendee Details Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendee Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedAttendee && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAttendee.userData?.name || 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAttendee.userData?.email || 'N/A'}
                  </Text>
                </View>

                {selectedAttendee.userData?.company && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Company:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAttendee.userData.company}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ticket ID:</Text>
                  <Text style={styles.detailValue}>{selectedAttendee.ticketId}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Registered:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(selectedAttendee.registeredAt)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={styles.statusBadge}>
                    <MaterialIcons
                      name={selectedAttendee.checkedIn ? 'check-circle' : 'schedule'}
                      size={16}
                      color={selectedAttendee.checkedIn ? COLORS.success : COLORS.warning}
                    />
                    <Text style={[
                      styles.statusBadgeText,
                      { color: selectedAttendee.checkedIn ? COLORS.success : COLORS.warning }
                    ]}>
                      {selectedAttendee.checkedIn ? 'Checked In' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {selectedAttendee.checkedIn && selectedAttendee.checkedInAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Checked In:</Text>
                    <Text style={styles.detailValue}>
                      {formatDateTime(selectedAttendee.checkedInAt)}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  eventInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  eventDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  eventLocation: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  attendeesSection: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 10,
    borderRadius: 8,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  attendeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  attendeeEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  attendeeCompany: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  attendeeStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  checkInTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.black,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  resultsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default CheckInDashboard;
