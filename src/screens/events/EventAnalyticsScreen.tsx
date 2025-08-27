import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// Chart components temporarily disabled due to compatibility issues

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { Event } from '../../types/events';

// Navigation types
type RootStackParamList = {
  EventAnalytics: { event: Event };
  EventDetails: { eventId: string; event?: Event };
};

type EventAnalyticsRouteProp = RouteProp<RootStackParamList, 'EventAnalytics'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AnalyticsData {
  totalRegistrations: number;
  checkedInCount: number;
  attendanceRate: number;
  registrationTrend: Array<{ date: string; count: number }>;
  ticketTypes: Array<{ type: string; count: number; percentage: number }>;
  registrationsByDay: Array<{ day: string; count: number }>;
}

const screenWidth = Dimensions.get('window').width;

export default function EventAnalyticsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EventAnalyticsRouteProp>();
  const toast = useToast();

  const { event } = route.params;

  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [checkInStats, setCheckInStats] = useState<any>(null);
  const [silentRefreshTimer, setSilentRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [showSilentRefreshIndicator, setShowSilentRefreshIndicator] = useState(false);

  useEffect(() => {
    loadAnalytics();
    
    // Set up silent refresh timer
    const timer = setInterval(() => {
      loadAnalytics(true); // Silent refresh
    }, 30000); // Every 30 seconds
    
    setSilentRefreshTimer(timer);

    // Cleanup timer on unmount
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  // Cleanup timer when component unmounts
  useEffect(() => {
    return () => {
      if (silentRefreshTimer) {
        clearInterval(silentRefreshTimer);
      }
    };
  }, [silentRefreshTimer]);

  const loadAnalytics = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        // Show subtle indicator for silent refresh
        setShowSilentRefreshIndicator(true);
        setTimeout(() => setShowSilentRefreshIndicator(false), 2000);
      }

      // Load attendees data
      const attendeesResponse = await authenticatedFetchWithRefresh(
        ENDPOINTS.GET_EVENT_DETAILS.replace(':eventId', event.id) + '/attendees',
        { method: 'GET' }
      );

      if (attendeesResponse.ok) {
        const attendeesData = await attendeesResponse.json();
        setAttendees(attendeesData.attendees || []);
        
        // Load check-in stats
        const statsResponse = await authenticatedFetchWithRefresh(
          ENDPOINTS.GET_EVENT_DETAILS.replace(':eventId', event.id) + '/checkin/stats',
          { method: 'GET' }
        );

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setCheckInStats(statsData);
        }

        // Process analytics data
        const processedAnalytics = processAnalyticsData(attendeesData.attendees || []);
        setAnalytics(processedAnalytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processAnalyticsData = (attendeesList: any[]): AnalyticsData => {
    const totalRegistrations = attendeesList.length;
    const checkedInCount = attendeesList.filter(a => a.checkedIn).length;
    const attendanceRate = totalRegistrations > 0 ? (checkedInCount / totalRegistrations) * 100 : 0;

    // Group registrations by day
    const registrationsByDay = attendeesList.reduce((acc: any, attendee) => {
      const date = new Date(attendee.registeredAt);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      if (!acc[dayName]) {
        acc[dayName] = 0;
      }
      acc[dayName]++;
      return acc;
    }, {});

    // Convert to array format for chart
    const registrationsByDayArray = Object.entries(registrationsByDay).map(([day, count]) => ({
      day,
      count: count as number
    }));

    // Mock ticket types data (since we don't have this in current schema)
    const ticketTypes = [
      { type: 'General', count: totalRegistrations, percentage: 100 }
    ];

    // Registration trend (simplified)
    const registrationTrend = [
      { date: '7 days ago', count: Math.floor(totalRegistrations * 0.1) },
      { date: '6 days ago', count: Math.floor(totalRegistrations * 0.2) },
      { date: '5 days ago', count: Math.floor(totalRegistrations * 0.4) },
      { date: '4 days ago', count: Math.floor(totalRegistrations * 0.6) },
      { date: '3 days ago', count: Math.floor(totalRegistrations * 0.8) },
      { date: '2 days ago', count: Math.floor(totalRegistrations * 0.9) },
      { date: 'Today', count: totalRegistrations }
    ];

    return {
      totalRegistrations,
      checkedInCount,
      attendanceRate,
      registrationTrend,
      ticketTypes,
      registrationsByDay: registrationsByDayArray
    };
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics(false); // Manual refresh, show loading
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(27, 43, 91, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <EventHeader title="Event Analytics" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <EventHeader title="Event Analytics" />
        <View style={styles.error}>
          <MaterialIcons name="error" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadAnalytics(false)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <EventHeader title="Event Analytics" />
      
      {/* Silent Refresh Indicator */}
      {showSilentRefreshIndicator && (
        <View style={styles.silentRefreshIndicator}>
          <View style={styles.refreshDot} />
          <Text style={styles.refreshText}>Updated</Text>
        </View>
      )}
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Event Info Header */}
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>{event.eventDate}</Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <MaterialIcons name="people" size={32} color={COLORS.primary} />
              <Text style={styles.metricValue}>{analytics.totalRegistrations}</Text>
              <Text style={styles.metricLabel}>Total Registrations</Text>
            </View>

            <View style={styles.metricCard}>
              <MaterialIcons name="check-circle" size={32} color={COLORS.success} />
              <Text style={styles.metricValue}>{analytics.checkedInCount}</Text>
              <Text style={styles.metricLabel}>Checked In</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <MaterialIcons name="schedule" size={32} color={COLORS.warning} />
              <Text style={styles.metricValue}>{analytics.totalRegistrations - analytics.checkedInCount}</Text>
              <Text style={styles.metricLabel}>Pending</Text>
            </View>

            <View style={styles.metricCard}>
              <MaterialIcons name="trending-up" size={32} color={COLORS.secondary} />
              <Text style={styles.metricValue}>{Math.round(analytics.attendanceRate)}%</Text>
              <Text style={styles.metricLabel}>Check-in Rate</Text>
            </View>
          </View>
        </View>

        {/* Registration Trend Chart */}
        {analytics.registrationTrend.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Registration Trend</Text>
            {/* <LineChart
              data={{
                labels: analytics.registrationTrend.map(item => item.date.split(' ')[0]),
                datasets: [{
                  data: analytics.registrationTrend.map(item => item.count),
                  strokeWidth: 2,
                }]
              }}
              width={screenWidth - 40}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            /> */}
          </View>
        )}

        {/* Attendance Overview */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Attendance Overview</Text>
          {/* <PieChart
            data={[
              {
                name: 'Checked In',
                count: analytics.checkedInCount,
                color: '#4CAF50',
                legendFontColor: '#7F7F7F',
                legendFontSize: 14,
              },
              {
                name: 'Not Checked In',
                count: analytics.totalRegistrations - analytics.checkedInCount,
                color: '#FF5722',
                legendFontColor: '#7F7F7F',
                legendFontSize: 14,
              }
            ]}
            width={screenWidth - 40}
            height={200}
            chartConfig={chartConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="0"
            center={[-10, 0]}
            style={styles.chart}
          /> */}
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>
              Attendance Chart
            </Text>
            <Text style={styles.chartPlaceholderSubtext}>
              {analytics.checkedInCount} / {analytics.totalRegistrations} checked in
            </Text>
          </View>
        </View>

        {/* Registrations by Day */}
        {analytics.registrationsByDay.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Registrations by Day</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                Chart temporarily unavailable
              </Text>
              <Text style={styles.chartPlaceholderSubtext}>
                {analytics.registrationsByDay.length} days of data available
              </Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EventDetails', { eventId: event.id, event })}
          >
            <MaterialIcons name="event" size={24} color={COLORS.white} />
            <Text style={styles.actionButtonText}>View Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              // Export functionality coming soon
              toast.info('Export', 'Export functionality coming soon');
            }}
          >
            <MaterialIcons name="download" size={24} color={COLORS.primary} />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Export Data</Text>
          </TouchableOpacity>
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
  eventHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 16,
    color: COLORS.gray,
  },
  metricsContainer: {
    flexDirection: 'column',
    padding: 20,
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  chartContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  chartPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 8,
  },
  chartPlaceholderSubtext: {
    fontSize: 14,
    color: COLORS.gray,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30, // pill shape similar to Events quick actions
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.primary,
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  silentRefreshIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.white,
  },
  refreshText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
}); 