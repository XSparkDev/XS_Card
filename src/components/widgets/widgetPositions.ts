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
      x: 72,
      y: 720,
      width: 130,
      height: 130
    },
    // Large widget (4x4 grid) - positioned in top area below weather widget, compact size
    large: {
      x: 88,
      y: 735,
      width: 250,
      height: 110
    }
  },
  'samsung-s24-ultra': {
    // Small widget (2x2 grid) - positioned in top-left area below weather widget
    small: {
      x: 80,
      y: 760,
      width: 130,
      height: 130
    },
    // Large widget (4x4 grid) - positioned in top area below weather widget, compact size
    large: {
      x: 95,
      y: 770,
      width: 250,
      height: 110
    }
  }
};

/**
 * Device mockup image dimensions for proper scaling
 */
export const DEVICE_DIMENSIONS = {
  'iphone-15-pro': {
    width: 428,
    height: 1338 //500
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














