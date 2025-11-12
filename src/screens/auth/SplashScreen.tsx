import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { validateCurrentToken } from '../../services/tokenValidationService';

type SplashScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const { isLoading, isAuthenticated, keepLoggedIn, firebaseReady } = useAuth();
  const [authCheckStatus, setAuthCheckStatus] = useState<string>('Checking authentication...');
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false);

  // Ensure minimum display time for smooth UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDisplayTimeElapsed(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Handle navigation when auth state is determined and minimum time has elapsed
  useEffect(() => {
    if (!isLoading && firebaseReady && minDisplayTimeElapsed) {
      console.log('SplashScreen: Auth state determined:', { isAuthenticated, keepLoggedIn });
      
      if (isAuthenticated) {
        console.log('SplashScreen: User is authenticated');
        
        if (keepLoggedIn) {
          console.log('SplashScreen: User authenticated with keepLoggedIn enabled');
          setAuthCheckStatus('Validating session...');
          
          // 🔥 CRITICAL FIX: Wait for Firebase auth state to be ready before validating
          const validateWithRetry = async (retryCount = 0) => {
            try {
              const isValid = await validateCurrentToken();
              if (isValid) {
                console.log('SplashScreen: Token validation successful');
                setAuthCheckStatus('Welcome back!');
                setTimeout(() => {
                  console.log('SplashScreen: Navigating to MainApp');
                  // Navigate to root navigator's MainApp screen
                  navigation.getParent()?.navigate('MainApp');
                }, 500);
              } else {
                // If validation fails and we haven't retried too many times, wait and retry
                if (retryCount < 3) {
                  console.log(`SplashScreen: Token validation failed, retrying in 1 second (attempt ${retryCount + 1}/3)`);
                  setAuthCheckStatus('Checking session...');
                  setTimeout(() => validateWithRetry(retryCount + 1), 1000);
                } else {
                  console.log('SplashScreen: Token validation failed after retries - forcing logout');
                  setAuthCheckStatus('Session expired');
                  setTimeout(() => {
                    console.log('SplashScreen: Navigating to SignIn due to invalid token');
                    navigation.replace('SignIn');
                  }, 500);
                }
              }
            } catch (error) {
              console.log('SplashScreen: Token validation error:', error);
              if (retryCount < 3) {
                console.log(`SplashScreen: Validation error, retrying in 1 second (attempt ${retryCount + 1}/3)`);
                setAuthCheckStatus('Checking session...');
                setTimeout(() => validateWithRetry(retryCount + 1), 1000);
              } else {
                setAuthCheckStatus('Session error');
                setTimeout(() => {
                  console.log('SplashScreen: Navigating to SignIn due to validation error');
                  navigation.replace('SignIn');
                }, 500);
              }
            }
          };
          
          // Start validation with retry mechanism
          validateWithRetry();
        } else {
          console.log('SplashScreen: User authenticated but keepLoggedIn is disabled - treating as new session');
          setAuthCheckStatus('Please sign in again');
          setTimeout(() => {
            console.log('SplashScreen: Navigating to SignIn due to keepLoggedIn disabled');
            navigation.replace('SignIn');
          }, 500);
        }
      } else {
        console.log('SplashScreen: User not authenticated, keepLoggedIn:', keepLoggedIn);
        setAuthCheckStatus('Loading...');
        setTimeout(() => {
          console.log('SplashScreen: Navigating to SignIn');
          navigation.replace('SignIn');
        }, 500);
      }
    } else if (!isLoading && !minDisplayTimeElapsed) {
      // Auth is ready but still showing splash for UX
      if (isAuthenticated && keepLoggedIn) {
        setAuthCheckStatus('Welcome back!');
      } else {
        setAuthCheckStatus('Loading...');
      }
    } else if (!firebaseReady) {
      // Firebase not ready yet
      setAuthCheckStatus('Initializing...');
    }
  }, [isLoading, firebaseReady, minDisplayTimeElapsed, isAuthenticated, keepLoggedIn, navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/xslogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
      <Text style={styles.statusText}>{authCheckStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  loader: {
    marginTop: 30,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 20,
    opacity: 0.8,
    textAlign: 'center',
  },
}); 