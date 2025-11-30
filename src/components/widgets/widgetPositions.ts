import { WidgetSize } from '../../widgets/WidgetTypes';

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DevicePositions {
  small: WidgetPosition;
  large: WidgetPosition;
}

/**
 * Widget positions for device mockups
 * Coordinates are based on the actual device mockup PNG dimensions
 * and typical widget placement on home screens
 */
export const WIDGET_POSITIONS: Record<'iphone-15-pro' | 'samsung-s24-ultra', DevicePositions> = {
  'iphone-15-pro': {
    // Small widget (2x2 grid) - positioned in top-left area below weather widget
    small: {
      x: 32,
      y: 520,
      width: 170,
      height: 170
    },
    // Large widget (4x4 grid) - positioned in top area below weather widget
    large: {
      x: 32,
      y: 520,
      width: 350,
      height: 360
    }
  },
  'samsung-s24-ultra': {
    // Small widget (2x2 grid) - positioned in top-left area below weather widget
    small: {
      x: 32,
      y: 520,
      width: 180,
      height: 180
    },
    // Large widget (4x4 grid) - positioned in top area below weather widget
    large: {
      x: 32,
      y: 520,
      width: 370,
      height: 370
    }
  }
};

/**
 * Device mockup image dimensions for proper scaling
 */
export const DEVICE_DIMENSIONS = {
  'iphone-15-pro': {
    width: 428,
    height: 1338
  },
  'samsung-s24-ultra': {
    width: 440,
    height: 1420
  }
};

/**
 * Get widget position for specific device and size
 */
export function getWidgetPosition(
  device: 'iphone-15-pro' | 'samsung-s24-ultra',
  size: WidgetSize
): WidgetPosition {
  return WIDGET_POSITIONS[device][size];
}

/**
 * Get device dimensions
 */
export function getDeviceDimensions(device: 'iphone-15-pro' | 'samsung-s24-ultra') {
  return DEVICE_DIMENSIONS[device];
}





