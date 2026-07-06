import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tabBarScrollY } from '../utils/tabBarScroll';
import { COLORS } from '../constants/colors';
import CardsScreen from '../screens/cards/CardsScreen';
import ContactsScreen from '../screens/contacts/ContactScreen';
import { RootTabParamList, RootStackParamList } from '../types';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import AddCards from '../screens/cards/AddCards';
import EditCard from '../screens/contacts/EditCard';
import UnlockPremium from '../screens/Unlockpremium/UnlockPremium';
import { useColorScheme } from '../context/ColorSchemeContext';
import GlassSurface from '../components/GlassSurface';
import EventsScreen from '../screens/events/EventsScreen';
import EventDetailsScreen from '../screens/events/EventDetailsScreen';
import EventPreferencesScreen from '../screens/events/EventPreferencesScreen';
import CreateEventScreen from '../screens/events/CreateEventScreen';
import EditEventScreen from '../screens/events/EditEventScreen';
import MyEventsScreen from '../screens/events/MyEventsScreen';
import { EventTicketScreen } from '../screens/events/EventTicketScreen';
import QRScannerScreen from '../screens/events/QRScannerScreen';
import CheckInDashboard from '../screens/events/CheckInDashboard';
import EventAnalyticsScreen from '../screens/events/EventAnalyticsScreen';
import OrganiserRegistrationScreen from '../screens/events/OrganiserRegistrationScreen';
import PaymentPendingScreen from '../screens/events/PaymentPendingScreen';
import RecurringSeriesManagementScreen from '../screens/events/RecurringSeriesManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DashboardNavigator from './DashboardNavigator';
import SubscriptionManagementScreen from '../screens/SubscriptionManagementScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen'; // NEW IMPORT
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CalendarPreferencesScreen from '../screens/settings/CalendarPreferencesScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TabNavigator Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.error}>{this.state.error?.message}</Text>
          <TouchableOpacity 
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}


const TAB_ITEMS = [
  { name: 'Cards', icon: 'credit-card' as const, label: 'Cards' },
  { name: 'Contacts', icon: 'people' as const, label: 'Contacts' },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const [opacity, setOpacity] = useState(1);

  // Subscribe to scroll position and derive pill opacity
  useEffect(() => {
    const id = tabBarScrollY.addListener(({ value }) => {
      // 0px → 1.0 opacity, 140px+ → 0.65 opacity (subtle fade, stays readable)
      setOpacity(Math.max(0.65, 1 - (Math.min(value, 140) / 140) * 0.35));
    });
    return () => tabBarScrollY.removeListener(id);
  }, []);

  // Restore full opacity when switching tabs
  useEffect(() => {
    tabBarScrollY.setValue(0);
    setOpacity(1);
  }, [state.index]);

  return (
    <View style={pillStyles.wrapper} pointerEvents="box-none">
      <GlassSurface style={[pillStyles.pill, { opacity }]} borderRadius={32}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const item = TAB_ITEMS[index];
          const color = isFocused ? colorScheme : COLORS.gray;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={pillStyles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <MaterialIcons name={item.icon} size={24} color={color} style={{ marginTop: 6 }} />
              <Text style={[pillStyles.label, { color }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </GlassSurface>
    </View>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Cards">
        {() => (
          <ErrorBoundary>
            <CardsScreen />
          </ErrorBoundary>
        )}
      </Tab.Screen>
      <Tab.Screen name="Contacts">
        {() => (
          <ErrorBoundary>
            <ContactsScreen />
          </ErrorBoundary>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="AddCards" component={AddCards} />
      <Stack.Screen
        name="EditCard"
        component={EditCard}
        options={{
          // Horizontal slide so a pushed EditCard layers OVER the previous one
          // (e.g. the redirect to the primary card), and peels back on return.
          ...TransitionPresets.SlideFromRightIOS,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="UnlockPremium" component={UnlockPremium} />
      <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="EventPreferences" component={EventPreferencesScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EditEvent" component={EditEventScreen} />
      <Stack.Screen name="MyEvents" component={MyEventsScreen} />
      <Stack.Screen name="PaymentPending" component={PaymentPendingScreen} />
      <Stack.Screen name="EventTicket" component={EventTicketScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="CheckInDashboard" component={CheckInDashboard} />
      <Stack.Screen name="EventAnalytics" component={EventAnalyticsScreen} />
      <Stack.Screen name="OrganiserRegistration" component={OrganiserRegistrationScreen} />
      <Stack.Screen name="RecurringSeriesManagement" component={RecurringSeriesManagementScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="CalendarPreferences" component={CalendarPreferencesScreen} />
      <Stack.Screen name="AdminDashboard" component={DashboardNavigator} />
    </Stack.Navigator>
  );
}

const pillStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    height: 64,
    width: '100%',
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    marginBottom: 6,
    marginTop: 2,
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.black,
  },
  error: {
    fontSize: 14,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.secondary,
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
