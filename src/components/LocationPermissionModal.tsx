/**
 * LocationPermissionModal
 *
 * Shown once on first app launch. Presents a plain-language rationale BEFORE the
 * OS location dialog appears, so the user understands why XS Card wants their
 * location. Only when the user taps "Allow" do we trigger the real system
 * permission prompt via expo-location.
 *
 * The decision (granted/denied/skipped) is persisted to AsyncStorage under
 * `location_permission_status` so this rationale never appears again after the
 * first decision. Location is always optional — denying never blocks anything.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';

// Load expo-location defensively. It ships a NATIVE module (`ExpoLocation`) that
// only exists in a proper native build — not in Expo Go, and not in an app binary
// built before the package was added. A bare `import * as Location` would throw at
// module-eval time ("Cannot find native module 'ExpoLocation'") and crash the app.
// Guarding the require means a missing module just disables the prompt instead.
let Location: typeof import('expo-location') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Location = require('expo-location');
} catch (error) {
  console.log('[Location] expo-location native module unavailable, skipping:', error);
  Location = null;
}

const STORAGE_KEY = 'location_permission_status';

export default function LocationPermissionModal() {
  const [visible, setVisible] = useState(false);

  // On mount: only show the rationale if the user has not decided before.
  useEffect(() => {
    // If the native module isn't present, there's nothing we could request —
    // never show the rationale (and never crash).
    if (!Location) return;

    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && !stored) {
          setVisible(true);
        }
      } catch (error) {
        console.log('[Location] Failed to read permission status:', error);
        // On read failure, default to showing the rationale once.
        if (!cancelled) setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistStatus = async (status: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, status);
    } catch (error) {
      console.log('[Location] Failed to persist permission status:', error);
    }
  };

  const handleAllow = async () => {
    setVisible(false);
    if (!Location) {
      await persistStatus('unavailable');
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[Location] Permission denied by user');
      } else {
        console.log('[Location] Permission granted');
      }
      await persistStatus(status);
    } catch (error) {
      console.log('[Location] Permission request failed:', error);
      await persistStatus('error');
    }
  };

  const handleNotNow = async () => {
    setVisible(false);
    console.log('[Location] User dismissed location rationale');
    await persistStatus('not_now');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleNotNow}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name="map-marker-radius"
            size={64}
            color={COLORS.primary}
            style={styles.icon}
          />
          <Text style={styles.headline}>See where you met your contacts</Text>
          <Text style={styles.body}>
            XS Card would like to know your location so you can see where you met
            your contacts. This is optional and can be changed in your device
            settings at any time.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAllow}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Allow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleNotNow}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    paddingBottom: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  icon: {
    marginTop: 4,
    marginBottom: 16,
  },
  headline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: COLORS.gray,
    fontSize: 15,
    fontWeight: '500',
  },
});
