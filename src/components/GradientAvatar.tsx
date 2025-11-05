import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { isTablet, scale } from '../utils/responsive';

interface GradientAvatarProps {
  size?: number;
  style?: ViewStyle;
}

export default function GradientAvatar({ size, style }: GradientAvatarProps) {
  // Default size based on device type
  const avatarSize = size || (isTablet() ? scale(120) : 120);
  const iconSize = avatarSize * 0.7; // Icon is 70% of the avatar size (enlarged from 50%)
  
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
      <MaterialIcons 
        name="person" 
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

