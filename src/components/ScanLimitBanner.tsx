/**
 * ScanLimitBanner
 *
 * Persistent countdown strip for the QR scan rate limit. Rendered by every
 * header (Header, AdminHeader, EventHeader) right after the header bar, with
 * `top` set to that header's own measured height — so it docks flush against
 * the header's bottom edge (never overlapping it) on every screen the moment
 * a free user hits the limit, and disappears the instant it resets. Reads
 * from the shared ScanLimitContext so it always matches the QR placeholder
 * overlay.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useScanLimit } from '../context/ScanLimitContext';

interface ScanLimitBannerProps {
  /**
   * The hosting header's measured height — pass this when the header is
   * itself position:'absolute' (Header, AdminHeader) so the banner can dock
   * at that exact offset. Omit it for headers already in normal document
   * flow (EventHeader) — the banner then renders as a plain block right
   * below, with no absolute positioning needed.
   */
  top?: number;
}

export default function ScanLimitBanner({ top }: ScanLimitBannerProps) {
  const { isLimitExceeded, countdownLabel } = useScanLimit();

  if (!isLimitExceeded) return null;
  if (top !== undefined && !top) return null;

  return (
    <View pointerEvents="none" style={[styles.banner, top !== undefined && { position: 'absolute', top, left: 0, right: 0 }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="timer-outline" size={14} color="#ffffff" />
        <Text style={styles.text}>
          Scan limit reached — resets in {countdownLabel || '--:--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#E53935',
    // Must exceed the contentShell's zIndex: 2 / elevation: 20 used by all
    // screen layouts, so the banner always paints above the scrollable content.
    // Kept well below SideMenu (zIndex: 9999) so the menu still covers it.
    zIndex: 10,
    elevation: 25,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Montserrat_600SemiBold',
  },
});
