import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, AppState, Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import AuthNavigator from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { EventNotificationProvider } from './src/context/EventNotificationContext';
import { ColorSchemeProvider } from './src/context/ColorSchemeContext';
import ToastProvider from './src/components/ToastProvider';
import { AuthManager } from './src/utils/authManager';
import { setGlobalNavigationRef } from './src/utils/api';

// Suppress specific warnings
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
  'Warning: Text strings must be rendered within a <Text> component',
]);

const Stack = createStackNavigator();

export default function App() {
  const appState = useRef(AppState.currentState);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Set up global navigation reference for automatic logout
    if (navigationRef.current) {
      setGlobalNavigationRef(navigationRef.current);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('App state changed:', appState.current, '->', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        AuthManager.handleAppForeground();
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App has gone to the background!');
        AuthManager.handleAppBackground();
      }

      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, []);

  return (
    <AuthProvider>
      <EventNotificationProvider>
        <ColorSchemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="auto" />
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Auth" component={AuthNavigator} />
                <Stack.Screen name="MainApp" component={TabNavigator} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </ColorSchemeProvider>
      </EventNotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});