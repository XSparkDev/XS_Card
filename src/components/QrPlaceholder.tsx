import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';

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
}

/**
 * Shared QR placeholder shown (a) while the real QR hasn't loaded yet, and
 * (b) when a free user has hit their scan limit — in which case it also
 * overlays the limit message and countdown. Used everywhere a card's QR is
 * rendered (Cards screen, template previews, Add/Edit card panels) so the
 * placeholder looks identical across the app.
 */
export default function QrPlaceholder({ style, limited, countdownLabel }: QrPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/images/PlaceholderQr.jpeg')}
        style={[styles.image, limited && styles.imageDimmed]}
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
});
