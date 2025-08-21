import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { AdminTabParamList } from '../types';

import AdminDashboard from '../screens/admin/AdminDashboard';
import Calendar from '../screens/admin/Calendar';
// import Settings from '../screens/admin/Settings';

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function DashboardNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.secondary,
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
      }}
    >
      <Tab.Screen
        name="Analytics"
        component={AdminDashboard}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={Calendar}
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="calendar-today" size={24} color={color} />
          ),
        }}
      />
      {/* Settings tab commented out
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={24} color={color} />
          ),
        }}
      />
      */}
    </Tab.Navigator>
  );
}
