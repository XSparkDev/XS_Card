import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { SPLASH_FACTS } from '../../constants/splashFacts';

type SplashScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Splash'>;

// Session restoration itself - waiting for Firebase, validating the current
// user, and refreshing the token if needed - all happens inside AuthContext's
// onIdTokenChanged listener before it ever reports isLoading: false. This
// screen's only job is to wait for that to settle and then navigate once,
// so there is exactly one place deciding when auth restoration is "done."
// Pick a random starting index so each launch feels fresh.
function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export default function SplashScreen() {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const { isLoading, isAuthenticated, keepLoggedIn, firebaseReady } = useAuth();
  const [statusText, setStatusText] = useState('Just a moment while we restore your secure session.');
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false);

  // ── Rotating facts ──────────────────────────────────────────────────────────
  const [factIndex, setFactIndex] = useState(() => randomIndex(SPLASH_FACTS.length));
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Track whether we should keep rotating (stop as soon as navigation begins).
  const rotatingRef = useRef(true);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const rotateFact = () => {
      if (!rotatingRef.current) return;
      // Fade out → swap fact → fade in.
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (!rotatingRef.current) return;
        setFactIndex((prev) => {
          // Advance by a non-zero step to avoid showing the same fact twice.
          const next = (prev + 1 + Math.floor(Math.random() * (SPLASH_FACTS.length - 1))) % SPLASH_FACTS.length;
          return next;
        });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    };

    intervalId = setInterval(rotateFact, 3000);

    return () => {
      rotatingRef.current = false;
      clearInterval(intervalId);
    };
  }, [fadeAnim]);

  // ── Auth status text ────────────────────────────────────────────────────────
  // Minimum display time keeps the splash from flashing on/off on fast warm starts.
  useEffect(() => {
    const timer = setTimeout(() => setMinDisplayTimeElapsed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!firebaseReady) {
      setStatusText('Just a moment while we restore your secure session.');
      return;
    }
    if (isAuthenticated && keepLoggedIn) {
      setStatusText('Welcome back!');
    }
  }, [firebaseReady, isAuthenticated, keepLoggedIn]);

  useEffect(() => {
    if (isLoading || !firebaseReady || !minDisplayTimeElapsed) return;

    // Stop rotating the moment we decide to navigate.
    rotatingRef.current = false;

    const destination = isAuthenticated ? 'MainApp' : 'SignIn';
    const timer = setTimeout(() => {
      if (destination === 'MainApp') {
        navigation.getParent()?.navigate('MainApp');
      } else {
        navigation.replace('SignIn');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isLoading, firebaseReady, minDisplayTimeElapsed, isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/xslogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      <Text style={styles.statusText}>{statusText}</Text>

      {/* Rotating application fact */}
      <Animated.Text
        style={[styles.factText, { opacity: fadeAnim }]}
        accessibilityLabel={`Did you know: ${SPLASH_FACTS[factIndex]}`}
        accessibilityLiveRegion="polite"
      >
        {SPLASH_FACTS[factIndex]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
    fontSize: 14,
    marginTop: 20,
    opacity: 0.8,
    textAlign: 'center',
  },
  factText: {
    color: '#000000',
    fontSize: 13,
    marginTop: 32,
    opacity: 0.55,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 36,
  },
});
