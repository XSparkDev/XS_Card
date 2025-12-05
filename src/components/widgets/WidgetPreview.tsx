import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WidgetSize, WidgetConfig, WidgetData } from '../../widgets/WidgetTypes';
import { COLORS } from '../../constants/colors';
import QRCode from 'react-native-qrcode-svg';
import { API_BASE_URL } from '../../utils/api';

export interface WidgetPreviewProps {
  size: WidgetSize;
  config: Partial<WidgetConfig>;
  data: Partial<WidgetData>;
}

/**
 * Widget Preview Component
 * Renders the actual widget content as it would appear on the home screen
 * Matches the design from the screenshot: white background, QR left, text right
 */
export default function WidgetPreview({ size, config, data }: WidgetPreviewProps) {
  const isSmall = size === WidgetSize.SMALL;
  const colorScheme = data.colorScheme || COLORS.primary;

  // Generate QR code data
  const base = API_BASE_URL.replace(/\/+$/, '');
  const qrData = data.qrCodeData || `${base}/card/${data.cardIndex || 0}`;

  // Small widget: Only QR code with outline, no background
  if (isSmall) {
    return (
      <View style={styles.smallContainer}>
        {config.showQRCode !== false && (
          <View style={[styles.qrWrapper, { borderColor: colorScheme }]}>
            <View style={styles.qrInnerPadding}>
              <QRCode
                value={qrData}
                size={80}
                backgroundColor="white"
                color="#000000"
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  // Large widget: White background, QR left, text right
  return (
    <View style={styles.largeContainer}>
      <View style={styles.largeContent}>
        {/* QR Code on Left */}
        {config.showQRCode !== false && (
          <View style={[styles.qrWrapper, { borderColor: colorScheme }]}>
            <View style={styles.qrInnerPadding}>
              <QRCode
                value={qrData}
                size={75}
                backgroundColor="white"
                color="#000000"
              />
            </View>
          </View>
        )}

        {/* Text on Right */}
        <View style={styles.textContainer}>
          {data.name && (
            <Text style={styles.name} numberOfLines={1}>
              {data.name}
            </Text>
          )}
          {data.surname && (
            <Text style={styles.surname} numberOfLines={1}>
              {data.surname}
            </Text>
          )}
          {data.occupation && (
            <Text style={styles.occupation} numberOfLines={1}>
              {data.occupation}
            </Text>
          )}
          {data.company && (
            <Text style={styles.company} numberOfLines={1}>
              {data.company}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Small Widget: Only QR code with outline, transparent background
  smallContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Large Widget: White background with rounded corners - fills allocated space
  largeContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  largeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // QR Code wrapper with outline (border will be card color)
  qrWrapper: {
    borderWidth: 2,
    borderRadius: 2,
    padding: 2,
    backgroundColor: 'white',
  },
  qrInnerPadding: {
    backgroundColor: 'white',
    padding: 1,
  },
  // Text container on the right
  textContainer: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  name: {
    fontSize: 13,
    fontWeight: '700', // Bold
    color: '#000000',
    marginBottom: 1,
  },
  surname: {
    fontSize: 13,
    fontWeight: '700', // Bold
    color: '#000000',
    marginBottom: 3,
  },
  occupation: {
    fontSize: 10,
    fontWeight: '400', // Regular
    color: '#000000',
    marginBottom: 1,
  },
  company: {
    fontSize: 10,
    fontWeight: '400', // Regular
    color: '#000000',
  },
});





