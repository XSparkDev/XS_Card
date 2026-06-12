import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { isTablet, scale } from '../utils/responsive';

interface GradientAvatarProps {
  size?: number;
  style?: ViewStyle;
}

export default function GradientAvatar({ size, style }: GradientAvatarProps) {
  // Default size based on device type
  const avatarSize = size || (isTablet() ? scale(120) : 120);
  const iconSize = avatarSize * 0.72; // Icon is ~72% of the avatar size
  
  return (
    <LinearGradient
      colors={['#92278F', '#BE1E2D']} // Purple to red gradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.container,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="account"
        size={iconSize}
        color={COLORS.white}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

