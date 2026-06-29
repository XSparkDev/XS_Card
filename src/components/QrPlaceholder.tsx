import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface QrPlaceholderProps {
  /** Merged onto the container — typically the same size/box the real QR image uses. */
  style?: StyleProp<ViewStyle>;
  /**
   * Shown while a free user is over the rolling-hour scan limit: dims the QR
   * image and overlays the reached-limit message + live countdown.
   */
  limited?: boolean;
  /** "MM:SS" until the limit resets — only rendered when `limited` is true. */
  countdownLabel?: string;
  /**
   * The real QR hasn't arrived within the load window. When set (and not
   * `limited`) together with `onRetry`, the placeholder is dimmed (same treatment
   * as the scan-limit state) and a circular refresh button is overlaid on top —
   * the QR stays visible underneath rather than being fully covered.
   */
  timedOut?: boolean;
  /** Called when the user taps the refresh button (re-fetch the QR code). */
  onRetry?: () => void;
}

/**
 * Shared QR placeholder shown (a) while the real QR hasn't loaded yet, (b) when
 * the load has timed out — in which case it dims the QR and overlays a circular
 * refresh button — and (c) when a free user has hit their scan limit, where it
 * overlays the limit message and countdown. Used everywhere a card's QR is
 * rendered (Cards screen, template previews, Add/Edit card panels) so the
 * placeholder looks identical across the app.
 */
export default function QrPlaceholder({ style, limited, countdownLabel, timedOut, onRetry }: QrPlaceholderProps) {
  // Limit state always wins — never offer a refresh that the user can't act on.
  const showRefresh = !limited && !!timedOut && !!onRetry;
  const dimmed = limited || showRefresh;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/images/PlaceholderQr.jpeg')}
        style={[styles.image, dimmed && styles.imageDimmed]}
        resizeMode="contain"
      />
      {limited && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Scan limit reached</Text>
          {!!countdownLabel && (
            <Text style={styles.overlayCountdown}>Resets in {countdownLabel}</Text>
          )}
        </View>
      )}
      {showRefresh && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Refresh QR code"
        >
          <View style={styles.refreshCircle}>
            <MaterialIcons name="refresh" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageDimmed: {
    opacity: 0.25,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  overlayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  overlayCountdown: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
    marginTop: 4,
    textAlign: 'center',
  },
  refreshCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1B2B5B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
