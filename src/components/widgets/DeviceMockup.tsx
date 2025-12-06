import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { WidgetSize } from '../../widgets/WidgetTypes';
import { getWidgetPosition, getDeviceDimensions, WidgetPosition } from './widgetPositions';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface DeviceMockupProps {
  device: 'iphone-15-pro' | 'samsung-s24-ultra';
  widgetSize: WidgetSize;
  widgetContent: React.ReactNode;
  widgetPosition?: WidgetPosition;
}

/**
 * Device Mockup Component
 * Renders a device frame with widget overlay
 */
export default function DeviceMockup({
  device,
  widgetSize,
  widgetContent,
  widgetPosition: customPosition
}: DeviceMockupProps) {
  // Get device mockup image path
  const mockupImage = device === 'iphone-15-pro'
    ? require('../../../assets/widgets/device-mockups/iphone-15-pro-mockup.png')
    : require('../../../assets/widgets/device-mockups/samsung-s24-ultra-mockup.png');

  // Get device dimensions and widget position
  const deviceDimensions = getDeviceDimensions(device);
  const widgetPos = customPosition || getWidgetPosition(device, widgetSize);

  // Calculate scaling to fit screen
  const scale = (SCREEN_WIDTH * 0.9) / deviceDimensions.width;
  const scaledDeviceWidth = deviceDimensions.width * scale;
  const scaledDeviceHeight = deviceDimensions.height * scale;

  // Scale widget position and size
  const scaledWidgetX = widgetPos.x * scale;
  const scaledWidgetY = widgetPos.y * scale;
  const scaledWidgetWidth = widgetPos.width * scale;
  const scaledWidgetHeight = widgetPos.height * scale;

  return (
    <View style={[styles.container, { width: scaledDeviceWidth, height: scaledDeviceHeight }]}>
      {/* Device mockup background */}
      <Image
        source={mockupImage}
        style={[styles.deviceImage, { width: scaledDeviceWidth, height: scaledDeviceHeight }]}
        resizeMode="contain"
      />

      {/* Widget overlay */}
      <View
        style={[
          styles.widgetOverlay,
          {
            left: scaledWidgetX,
            top: scaledWidgetY,
            width: scaledWidgetWidth,
            height: scaledWidgetHeight,
          }
        ]}
      >
        {widgetContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  deviceImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  widgetOverlay: {
    position: 'absolute',
  },
});





