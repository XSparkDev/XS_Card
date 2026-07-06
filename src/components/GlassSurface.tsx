/**
 * GlassSurface
 *
 * Shared building block for the app's glassmorphic "Ghost Mode" theme. Wrap
 * any card/panel/bar/button in this instead of a plain View to get a frosted
 * glass treatment that's consistent everywhere it's used: native background
 * blur (expo-blur), a translucent white overlay, a thin low-opacity border,
 * and a soft shadow. When Ghost Mode is off, it renders as a plain View with
 * whatever `style` was passed — completely inert, zero visual change.
 *
 * The glass overlay's opacity is animated on Ghost Mode toggle (not an
 * instant swap), so turning it on/off cross-fades smoothly.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useGhostMode } from '../context/GhostModeContext';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius for the glass border/blur clip. Should match the surface's own borderRadius. */
  borderRadius?: number;
  /** expo-blur intensity (0-100). Higher = stronger blur. */
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

const GLASS_OVERLAY_COLOR = 'rgba(255, 255, 255, 0.32)';
const GLASS_BORDER_COLOR = 'rgba(255, 255, 255, 0.55)';

export default function GlassSurface({
  children,
  style,
  borderRadius = 20,
  intensity = 45,
  tint = 'light',
}: GlassSurfaceProps) {
  const { ghostModeEnabled } = useGhostMode();
  const glassOpacity = useRef(new Animated.Value(ghostModeEnabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glassOpacity, {
      toValue: ghostModeEnabled ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [ghostModeEnabled, glassOpacity]);

  return (
    <View style={[style, { borderRadius, overflow: 'hidden' }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glassOpacity, borderRadius }]}
      >
        <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />
        <View style={[StyleSheet.absoluteFill, styles.border, { borderRadius }]} />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: GLASS_OVERLAY_COLOR,
  },
  border: {
    borderWidth: 1,
    borderColor: GLASS_BORDER_COLOR,
  },
});
