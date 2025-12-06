/**
 * NFCWriteProgress Component
 * 
 * Displays progress and status during NFC card programming
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

interface NFCWriteProgressProps {
  progress: number; // 0-100
  isWriting: boolean;
  error?: string | null;
  success?: boolean;
  duration?: number;
}

export default function NFCWriteProgress({
  progress,
  isWriting,
  error,
  success,
  duration,
}: NFCWriteProgressProps) {
  const [scaleAnim] = React.useState(new Animated.Value(1));

  React.useEffect(() => {
    if (isWriting) {
      // Pulse animation while writing
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isWriting]);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        {error ? (
          <MaterialIcons name="error" size={64} color={COLORS.error} />
        ) : success ? (
          <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
        ) : (
          <MaterialIcons name="nfc" size={64} color={COLORS.primary} />
        )}
      </Animated.View>

      {/* Status Text */}
      <Text style={styles.statusText}>
        {error
          ? 'Write Failed'
          : success
          ? 'Card Programmed!'
          : isWriting
          ? 'Tap Card to Back of Phone'
          : 'Ready to Write'}
      </Text>

      {/* Progress Bar */}
      {isWriting && !error && !success && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      )}

      {/* Activity Indicator */}
      {isWriting && !error && !success && (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
      )}

      {/* Duration (on success) */}
      {success && duration !== undefined && (
        <Text style={styles.durationText}>Completed in {duration}ms</Text>
      )}

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Instructions */}
      {!error && !success && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionText}>
            {isWriting
              ? 'Hold the card steady against the back of your phone'
              : 'Place your blank NFC card on the back of your phone and tap "Program Card"'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  spinner: {
    marginVertical: 12,
  },
  durationText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  instructionsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
});

