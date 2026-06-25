/**
 * Shared Animated.Value that CardsScreen writes to (vertical card scroll).
 * TabNavigator reads from it to animate the floating pill background opacity.
 */
import { Animated } from 'react-native';

export const tabBarScrollY = new Animated.Value(0);
