import React, { useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View, AppState, Platform, LogBox, TouchableOpacity, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AuthNavigator from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { EventNotificationProvider } from './src/context/EventNotificationContext';
import { ColorSchemeProvider } from './src/context/ColorSchemeContext';
import ToastProvider from './src/components/ToastProvider';
import { AuthManager } from './src/utils/authManager';
import { setGlobalNavigationRef } from './src/utils/api';
import { COLORS } from './src/constants/colors';
import { useSystemUI } from './src/hooks/useSystemUI';
import { MeetingNotificationProvider } from './src/context/MeetingNotificationContext';

// Suppress specific warnings
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
  'Warning: Text strings must be rendered within a <Text> component',
]);

const Stack = createStackNavigator();

// Top-level error boundary to catch all crashes
interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends Component<{children: ReactNode}, AppErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 App-level Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>XS Card Crashed</Text>
          <Text style={errorStyles.subtitle}>Something went wrong, but don't worry!</Text>
          <Text style={errorStyles.error}>{this.state.error?.message}</Text>
          <TouchableOpacity 
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={errorStyles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const appState = useRef(AppState.currentState);
  const navigationRef = useRef<any>(null);

  // Handle system UI visibility
  useSystemUI();

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
          <MeetingNotificationProvider>
            <ToastProvider>
              <NavigationContainer ref={navigationRef}>
                <ExpoStatusBar style="auto" translucent={true} />
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Auth" component={AuthNavigator} />
                  <Stack.Screen name="MainApp" component={TabNavigator} />
                </Stack.Navigator>
              </NavigationContainer>
            </ToastProvider>
          </MeetingNotificationProvider>
        </ColorSchemeProvider>
      </EventNotificationProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
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

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: COLORS.black,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.gray,
    textAlign: 'center',
  },
  error: {
    fontSize: 12,
    color: 'red',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});