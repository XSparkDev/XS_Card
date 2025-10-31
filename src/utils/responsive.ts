import { Dimensions, Platform } from 'react-native';

/**
 * Breakpoint constants for device detection
 */
const TABLET_BREAKPOINT = 768;

/**
 * Detects if the current device is a tablet based on screen width
 * @returns true if screen width >= 768px (tablet), false otherwise (mobile)
 */
export const isTablet = (): boolean => {
  const { width } = Dimensions.get('window');
  return width >= TABLET_BREAKPOINT;
};

/**
 * Gets responsive dimensions and device type information
 * @returns Object with screen dimensions and device type
 */
export const getResponsiveDimensions = () => {
  const { width, height } = Dimensions.get('window');
  const tablet = isTablet();
  
  return {
    width,
    height,
    isTablet: tablet,
    isMobile: !tablet,
  };
};

/**
 * Scales a value proportionally for tablet devices
 * Returns original value for mobile, scaled value for tablet
 * @param mobileSize - The size to use on mobile
 * @param scaleFactor - Optional scale factor for tablet (default: 1.4)
 * @returns Scaled value for tablet, original for mobile
 */
export const scale = (mobileSize: number, scaleFactor: number = 1.4): number => {
  if (!isTablet()) {
    return mobileSize;
  }
  return Math.round(mobileSize * scaleFactor);
};

/**
 * Gets card width for the current device
 * Mobile: full screen width
 * Tablet: fixed card width (allows multiple cards visible)
 * @param cardWidth - Desired card width for tablet (default: 420)
 * @returns Card width appropriate for device type
 */
export const getCardWidth = (cardWidth: number = 420): number => {
  if (!isTablet()) {
    return Dimensions.get('window').width;
  }
  return cardWidth;
};

/**
 * Gets spacing value based on device type
 * @param mobileSpacing - Spacing value for mobile
 * @param tabletMultiplier - Multiplier for tablet (default: 1.5)
 * @returns Spacing value appropriate for device
 */
export const getSpacing = (mobileSpacing: number, tabletMultiplier: number = 1.5): number => {
  if (!isTablet()) {
    return mobileSpacing;
  }
  return Math.round(mobileSpacing * tabletMultiplier);
};

