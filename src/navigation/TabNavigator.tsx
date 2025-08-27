import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import CardsScreen from '../screens/cards/CardsScreen';
import ContactsScreen from '../screens/contacts/ContactScreen';
import { RootTabParamList, RootStackParamList } from '../types';
import { createStackNavigator } from '@react-navigation/stack';
import AddCards from '../screens/cards/AddCards';
import EditCard from '../screens/contacts/EditCard';
import { API_BASE_URL, ENDPOINTS, buildUrl } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import UnlockPremium from '../screens/Unlockpremium/UnlockPremium';
import { useColorScheme } from '../context/ColorSchemeContext';
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
import SettingsScreen from '../screens/SettingsScreen';

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

function TabNavigator() {
  const { colorScheme } = useColorScheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colorScheme,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: 90,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          padding: 4,
        },
        tabBarLabelStyle: {
          fontSize: 15,
          marginTop: 2,
          paddingBottom: 4,
        },
        headerShown: false,
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
      }}
    >
      <Tab.Screen
        name="Cards"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="credit-card" size={24} color={color} />
          ),
        }}
      >
        {() => (
          <ErrorBoundary>
            <CardsScreen />
          </ErrorBoundary>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Contacts"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people" size={24} color={color} />
          ),
        }}
      >
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
      <Stack.Screen name="EditCard" component={EditCard} />
      <Stack.Screen name="UnlockPremium" component={UnlockPremium} />
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

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
