import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { WidgetSize, WidgetConfig, WidgetData } from '../../widgets/WidgetTypes';
import { COLORS } from '../../constants/colors';
import QRCode from 'react-native-qrcode-svg';

export interface WidgetPreviewProps {
  size: WidgetSize;
  config: Partial<WidgetConfig>;
  data: Partial<WidgetData>;
}

/**
 * Widget Preview Component
 * Renders the actual widget content as it would appear on the home screen
 */
export default function WidgetPreview({ size, config, data }: WidgetPreviewProps) {
  const isSmall = size === WidgetSize.SMALL;
  const colorScheme = data.colorScheme || COLORS.primary;

  // Generate QR code data
  const qrData = data.qrCodeData || `https://xscard.co.za/card/${data.cardIndex || 0}`;

  const containerStyle = [
    styles.container,
    isSmall ? styles.smallContainer : styles.largeContainer,
    { backgroundColor: colorScheme }
  ];

  return (
    <View style={containerStyle}>
      {/* Small Widget Layout - QR Code Focused */}
      {isSmall && (
        <View style={styles.smallContent}>
          {config.showQRCode !== false && (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={120}
                backgroundColor="white"
                color={colorScheme}
              />
            </View>
          )}
          {config.showProfileImage !== false && data.profileImage && (
            <Image
              source={{ uri: data.profileImage }}
              style={styles.smallProfileImage}
            />
          )}
          <Text style={styles.smallName} numberOfLines={1}>
            {data.name || 'Name'}
          </Text>
        </View>
      )}

      {/* Large Widget Layout - Full Information */}
      {!isSmall && (
        <View style={styles.largeContent}>
          {/* Header with profile and company */}
          <View style={styles.header}>
            {config.showProfileImage !== false && data.profileImage && (
              <Image
                source={{ uri: data.profileImage }}
                style={styles.profileImage}
              />
            )}
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>
                {data.name} {data.surname}
              </Text>
              <Text style={styles.occupation} numberOfLines={1}>
                {data.occupation || 'Occupation'}
              </Text>
              <Text style={styles.company} numberOfLines={1}>
                {data.company || 'Company'}
              </Text>
            </View>
          </View>

          {/* QR Code */}
          {config.showQRCode !== false && (
            <View style={styles.largeQrContainer}>
              <QRCode
                value={qrData}
                size={140}
                backgroundColor="white"
                color={colorScheme}
              />
            </View>
          )}

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            {data.email && (
              <Text style={styles.contactText} numberOfLines={1}>
                📧 {data.email}
              </Text>
            )}
            {data.phone && (
              <Text style={styles.contactText} numberOfLines={1}>
                📱 {data.phone}
              </Text>
            )}
          </View>

          {/* Company Logo */}
          {config.showCompanyLogo !== false && data.companyLogo && (
            <Image
              source={{ uri: data.companyLogo }}
              style={styles.companyLogo}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  smallContainer: {
    width: 170,
    height: 170,
    padding: 12,
  },
  largeContainer: {
    width: 350,
    height: 360,
    padding: 16,
  },
  smallContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  smallProfileImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'white',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  smallName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  largeContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  name: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  occupation: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 2,
  },
  company: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  largeQrContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 16,
    alignSelf: 'center',
    marginVertical: 12,
  },
  contactInfo: {
    marginTop: 8,
  },
  contactText: {
    color: 'white',
    fontSize: 12,
    marginVertical: 2,
  },
  companyLogo: {
    width: 50,
    height: 50,
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 8,
  },
});





