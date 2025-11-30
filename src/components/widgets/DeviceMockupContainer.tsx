import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DeviceMockup from './DeviceMockup';
import WidgetPreview from './WidgetPreview';
import { WidgetSize, WidgetConfig, WidgetData } from '../../widgets/WidgetTypes';
import { COLORS } from '../../constants/colors';

export interface DeviceMockupContainerProps {
  config: Partial<WidgetConfig>;
  data: Partial<WidgetData>;
  size: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
}

/**
 * Device Mockup Container
 * Shows widget preview on both device mockups with controls
 */
export default function DeviceMockupContainer({
  config,
  data,
  size,
  onSizeChange
}: DeviceMockupContainerProps) {
  const [selectedDevice, setSelectedDevice] = useState<'iphone-15-pro' | 'samsung-s24-ultra'>('samsung-s24-ultra');

  return (
    <View style={styles.container}>
      {/* Device Selector */}
      <View style={styles.deviceSelector}>
        <TouchableOpacity
          style={[
            styles.deviceButton,
            selectedDevice === 'iphone-15-pro' && styles.deviceButtonActive
          ]}
          onPress={() => setSelectedDevice('iphone-15-pro')}
        >
          <MaterialIcons
            name="phone-iphone"
            size={20}
            color={selectedDevice === 'iphone-15-pro' ? COLORS.primary : COLORS.gray}
          />
          <Text style={[
            styles.deviceButtonText,
            selectedDevice === 'iphone-15-pro' && styles.deviceButtonTextActive
          ]}>
            iPhone 15 Pro
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deviceButton,
            selectedDevice === 'samsung-s24-ultra' && styles.deviceButtonActive
          ]}
          onPress={() => setSelectedDevice('samsung-s24-ultra')}
        >
          <MaterialIcons
            name="phone-android"
            size={20}
            color={selectedDevice === 'samsung-s24-ultra' ? COLORS.primary : COLORS.gray}
          />
          <Text style={[
            styles.deviceButtonText,
            selectedDevice === 'samsung-s24-ultra' && styles.deviceButtonTextActive
          ]}>
            Galaxy S24 Ultra
          </Text>
        </TouchableOpacity>
      </View>

      {/* Size Selector */}
      {onSizeChange && (
        <View style={styles.sizeSelector}>
          <TouchableOpacity
            style={[
              styles.sizeButton,
              size === WidgetSize.SMALL && styles.sizeButtonActive
            ]}
            onPress={() => onSizeChange(WidgetSize.SMALL)}
          >
            <Text style={[
              styles.sizeButtonText,
              size === WidgetSize.SMALL && styles.sizeButtonTextActive
            ]}>
              Small (2x2)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sizeButton,
              size === WidgetSize.LARGE && styles.sizeButtonActive
            ]}
            onPress={() => onSizeChange(WidgetSize.LARGE)}
          >
            <Text style={[
              styles.sizeButtonText,
              size === WidgetSize.LARGE && styles.sizeButtonTextActive
            ]}>
              Large (4x4)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Device Mockup Preview */}
      <ScrollView
        style={styles.previewContainer}
        contentContainerStyle={styles.previewContent}
        showsVerticalScrollIndicator={true}
      >
        <DeviceMockup
          device={selectedDevice}
          widgetSize={size}
          widgetContent={
            <WidgetPreview
              size={size}
              config={config}
              data={data}
            />
          }
        />
      </ScrollView>

      {/* Info Text */}
      <Text style={styles.infoText}>
        Preview shows how your widget will appear on the home screen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deviceSelector: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  deviceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    gap: 6,
  },
  deviceButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  deviceButtonText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
  },
  deviceButtonTextActive: {
    color: COLORS.primary,
  },
  sizeSelector: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  sizeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
  },
  sizeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  sizeButtonText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  sizeButtonTextActive: {
    color: 'white',
  },
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  infoText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 12,
    padding: 12,
  },
});





