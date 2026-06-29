import React, { useCallback } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { AdminTabParamList } from '../types';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useColorScheme } from '../context/ColorSchemeContext';

import AdminDashboard from '../screens/admin/AdminDashboard';
import Calendar from '../screens/admin/Calendar';
// import Settings from '../screens/admin/Settings';

const Tab = createBottomTabNavigator<AdminTabParamList>();

const TAB_ITEMS = [
  { name: 'Analytics', icon: 'dashboard' as const, label: 'Dashboard' },
  { name: 'Contacts', icon: 'people' as const, label: 'Contacts' },
  { name: 'Calendar', icon: 'calendar-today' as const, label: 'Calendar' },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();

  return (
    <View style={pillStyles.wrapper} pointerEvents="box-none">
      <View style={pillStyles.pill}>
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
      </View>
    </View>
  );
}

// A tiny screen that redirects the tab to the Contacts tab in MainTabs
function ContactsRedirect() {
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate('MainTabs', { screen: 'Contacts' });
    }, [navigation])
  );

  return null;
}

export default function DashboardNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Analytics" component={AdminDashboard} />
      <Tab.Screen name="Contacts" component={ContactsRedirect} />
      <Tab.Screen name="Calendar" component={Calendar} />
    </Tab.Navigator>
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
