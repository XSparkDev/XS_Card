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
          <View style={[styles.iconCircle, styles.errorCircle]}>
            <MaterialIcons name="error" size={56} color={COLORS.white} />
          </View>
        ) : success ? (
          <View style={[styles.iconCircle, styles.successCircle]}>
            <MaterialIcons name="check-circle" size={56} color={COLORS.white} />
          </View>
        ) : (
          <View style={[styles.iconCircle, styles.primaryCircle]}>
            <MaterialIcons name="nfc" size={56} color={COLORS.white} />
          </View>
        )}
      </Animated.View>

      {/* Status Text */}
      <Text style={styles.statusText}>
        {error
          ? 'Write Failed'
          : success
          ? 'Card Programmed Successfully!'
          : isWriting
          ? 'Tap Card to Back of Phone'
          : 'Ready to Write'}
      </Text>

      {/* Progress Bar */}
      {(isWriting || (!success && progress > 0)) && !error && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${Math.max(Math.min(progress, 100), 0)}%` }]} />
        </View>
      )}

      {/* Activity Indicator */}
      {isWriting && !error && !success && (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
      )}

      {/* Duration (on success) */}
      {success && duration !== undefined && (
        <View style={styles.durationContainer}>
          <MaterialIcons name="timer" size={16} color={COLORS.success} />
          <Text style={styles.durationText}>Completed in {duration}ms</Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={20} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Instructions */}
      {!error && !success && (
        <View style={styles.instructionsContainer}>
          <MaterialIcons 
            name={isWriting ? "touch-app" : "info-outline"} 
            size={20} 
            color={COLORS.primary} 
            style={styles.instructionIcon}
          />
          <Text style={styles.instructionText}>
            {isWriting
              ? 'Hold the card steady where your NFC module is located until writing completes'
              : 'Tap the Program NFC Card button to begin'}
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
    padding: 24,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorCircle: {
    backgroundColor: COLORS.error,
  },
  successCircle: {
    backgroundColor: COLORS.success,
  },
  primaryCircle: {
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 20,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  spinner: {
    marginVertical: 16,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.successLight,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.errorLight,
    borderRadius: 12,
    maxWidth: '90%',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
    flex: 1,
    fontWeight: '500',
  },
  instructionsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    maxWidth: '100%',
  },
  instructionIcon: {
    marginTop: 2,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 20,
    flex: 1,
  },
});

