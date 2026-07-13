import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import { formatSocialLinkDisplay } from '../../utils/socialLinkDisplay';
import { isTablet, scale } from '../../utils/responsive';
import GradientAvatar from '../GradientAvatar';
import LogoPlaceholder from '../LogoPlaceholder';
import QrPlaceholder from '../QrPlaceholder';
import InlineTextField from './InlineTextField';

type CardData = any;

interface Props {
  card: CardData;
  qrUri?: string;
  colorFallback: string;
  isWalletLoading: boolean;
  onPressShare: () => void;
  onPressWallet: () => void;
  onPressEmail: (email: string) => void;
  onPressPhone: (phone: string) => void;
  onPressSocial: (platform: string, value: string) => void;
  altNumber?: { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean };
  onPressEdit?: () => void;
  scanLimited?: boolean;
  scanCountdown?: string;
  qrTimedOut?: boolean;
  onRetryQr?: () => void;
  onChangeField?: (field: string, value: string) => void;
  onEditProfileImage?: () => void;
  onEditCompanyLogo?: () => void;
}

// Social icons mapping - EXACT same as Template 1
const socialIcons: { [key: string]: keyof typeof MaterialCommunityIcons.glyphMap } = {
  whatsapp: 'whatsapp',
  x: 'twitter',
  facebook: 'facebook',
  linkedin: 'linkedin',
  website: 'web',
  tiktok: 'music-note',
  instagram: 'instagram'
};

export default function CardTemplate4(props: Props) {
  const { card, qrUri, colorFallback, isWalletLoading, onPressShare, onPressWallet, onPressEmail, onPressPhone, onPressSocial, altNumber, onPressEdit, scanLimited, scanCountdown, qrTimedOut, onRetryQr, onChangeField, onEditProfileImage, onEditCompanyLogo } = props;
  const theme = card.colorScheme || colorFallback;

  // EXACT same getDynamicStyles as Template 1
  const getDynamicStyles = (cardColorScheme: string) => StyleSheet.create({
    shareButton: {
      flexDirection: 'row',
      backgroundColor: cardColorScheme,
      paddingVertical: isTablet() ? scale(12) : 12,
      paddingHorizontal: isTablet() ? scale(24) : 24,
      borderRadius: isTablet() ? scale(25) : 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: isTablet() ? scale(10) : 10,
      marginHorizontal: isTablet() ? scale(10) : 10,
      alignSelf: 'stretch',
      gap: isTablet() ? scale(8) : 8,
    },
    walletButton: {
      flexDirection: 'row',
      backgroundColor: COLORS.white,
      paddingVertical: isTablet() ? scale(12) : 12,
      paddingHorizontal: isTablet() ? scale(24) : 24,
      borderRadius: isTablet() ? scale(25) : 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: isTablet() ? scale(10) : 10,
      marginHorizontal: isTablet() ? scale(10) : 10,
      alignSelf: 'stretch',
      borderWidth: 2,
      borderColor: cardColorScheme,
      gap: isTablet() ? scale(8) : 8,
    },
  });

  return (
    <View style={styles.container}>
      {/* Edit Button for Tablet - top-right position */}
      {isTablet() && onPressEdit && (
        <TouchableOpacity
          style={[
            styles.editButton,
            {
              width: scale(40),
              height: scale(40),
              borderRadius: scale(20),
              top: scale(10),
              right: scale(10),
            }
          ]}
          onPress={onPressEdit}
        >
          <MaterialIcons 
            name="edit" 
            size={scale(20)} 
            color={COLORS.white} 
          />
        </TouchableOpacity>
      )}
      {/* Top row: Logo left, QR right - bottoms aligned */}
      <View style={styles.topRow}>
        {/* Company Logo - Left */}
        <TouchableOpacity style={styles.logoContainer} activeOpacity={1} onPress={onEditCompanyLogo} disabled={!onEditCompanyLogo}>
          {card.companyLogo && getImageUrl(card.companyLogo) ? (
            <Image
              source={{ uri: getImageUrl(card.companyLogo) || '' }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <LogoPlaceholder style={styles.logo} />
          )}
        </TouchableOpacity>
        
        {/* QR Code - Right */}
        <View style={styles.qrContainer}>
          {qrUri ? (
            <Image
              style={[
                styles.qrCode,
                isTablet() && { width: scale(150), height: scale(150) }
              ]}
              source={{ uri: qrUri }}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <QrPlaceholder limited={scanLimited} countdownLabel={scanCountdown} timedOut={qrTimedOut} onRetry={onRetryQr} />
            </View>
          )}
        </View>
      </View>

      {/* Large Profile Picture - Center Stage */}
      <View style={styles.profileCenterContainer}>
        <TouchableOpacity style={styles.profileCircleContainer} activeOpacity={1} onPress={onEditProfileImage} disabled={!onEditProfileImage}>
          {card.profileImage && getImageUrl(card.profileImage) ? (
            <Image
              style={styles.profileCenterImage}
              source={{ uri: getImageUrl(card.profileImage) || '' }}
            />
          ) : (
            <GradientAvatar
              size={225}
              style={styles.profileCenterImage}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Basic Info */}
      <InlineTextField
        value={`${card.name || ''} ${card.surname || ''}`.trim()}
        onChange={onChangeField ? v => onChangeField('fullName', v) : undefined}
        style={[styles.name, styles.leftAligned, isTablet() && { fontSize: scale(22), marginLeft: scale(25), marginTop: scale(20), marginBottom: scale(5) }]}
      />
      <InlineTextField
        value={card.occupation || 'No occupation'}
        onChange={onChangeField ? v => onChangeField('occupation', v) : undefined}
        style={[styles.position, styles.leftAligned, isTablet() && { fontSize: scale(20), marginLeft: scale(25), marginBottom: scale(5) }]}
      />
      <InlineTextField
        value={card.company || 'No company'}
        onChange={onChangeField ? v => onChangeField('company', v) : undefined}
        style={[styles.company, styles.leftAligned, isTablet() && { fontSize: scale(17), marginLeft: scale(25), marginBottom: scale(10) }]}
      />

      {/* Contact Info */}
      <View style={[styles.contactSection, styles.leftAligned, isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }]}>
        <MaterialCommunityIcons name="email-outline" size={isTablet() ? scale(30) : 30} color={theme} />
        <InlineTextField
          value={card.email || 'No email address'}
          onChange={onChangeField ? v => onChangeField('email', v) : undefined}
          style={[styles.contactText, isTablet() && { fontSize: scale(16), marginLeft: scale(10) }]}
        />
      </View>

      <View style={[styles.contactSection, styles.leftAligned, isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }]}>
        <MaterialCommunityIcons name="phone-outline" size={isTablet() ? scale(30) : 30} color={theme} />
        <InlineTextField
          value={card.phone || 'No phone number'}
          onChange={onChangeField ? v => onChangeField('phoneNumber', v) : undefined}
          style={[styles.contactText, isTablet() && { fontSize: scale(16), marginLeft: scale(10) }]}
        />
      </View>

      {/* Alt Number */}
      {altNumber?.showAltNumber && altNumber?.altNumber && (
        <View style={[styles.contactSection, styles.leftAligned, isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }]}>
          <MaterialCommunityIcons name="phone-outline" size={isTablet() ? scale(30) : 30} color={theme} />
          <Text style={[styles.contactText, isTablet() && { fontSize: scale(16), marginLeft: scale(10) }]}>
            {`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`}
          </Text>
        </View>
      )}

      {/* Social Links */}
      {card.socials && Object.entries(card.socials).map(([platform, value]: any) => {
        const textValue = typeof value === 'string' ? value.trim() : '';
        if (socialIcons[platform] && textValue !== '') {
          return (
            <View
              key={platform}
              style={[styles.contactSection, styles.leftAligned, isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }]}
            >
              <MaterialCommunityIcons name={socialIcons[platform]} size={isTablet() ? scale(30) : 30} color={theme} />
              <InlineTextField
                value={textValue ? formatSocialLinkDisplay(platform, textValue) : ''}
                onChange={onChangeField ? v => onChangeField(platform, v) : undefined}
                style={[styles.contactText, isTablet() && { fontSize: scale(16), marginLeft: scale(10) }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              />
            </View>
          );
        }
        return null;
      })}

      {/* Share and Wallet Buttons - EXACT same as Template 1 */}
      <TouchableOpacity 
        onPress={onPressShare} 
        style={[getDynamicStyles(theme).shareButton]}
      >
        <MaterialIcons name="share" size={isTablet() ? scale(24) : 24} color={COLORS.white} />
        <Text style={[
          styles.shareButtonText,
          isTablet() && { fontSize: scale(16) }
        ]}>
          Share
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={onPressWallet} 
        style={[getDynamicStyles(theme).walletButton]}
        disabled={isWalletLoading}
      >
        {isWalletLoading ? (
          <ActivityIndicator size="small" color={theme} />
        ) : (
          <>
            <MaterialCommunityIcons 
              name="wallet" 
              size={isTablet() ? scale(24) : 24} 
              color={theme} 
            />
            <Text style={[
              styles.walletButtonText,
              { color: theme },
              isTablet() && { fontSize: scale(16) }
            ]}>
              Add to {Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    width: '100%',
  },
  logoContainer: {
    flex: 1,
    height: 170,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderRadius: 12,
    marginRight: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  qrContainer: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 10,
    alignSelf: 'center',
  },
  qrCode: {
    width: 150,
    height: 150,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  profileCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  profileCircleContainer: {
    width: 225,
    height: 225,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: COLORS.white,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  profileCenterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
  // EXACT same styles as OG Template
  name: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20,
    fontFamily: 'Montserrat-Bold',
    marginLeft: 25,
  },
  position: {
    fontSize: 20,
    marginBottom: 5,
    fontFamily: 'Montserrat-Regular',
    marginLeft: 25,
  },
  company: {
    fontSize: 17,
    marginBottom: 10,
    fontFamily: 'Montserrat-Bold',
    marginLeft: 25,
  },
  leftAligned: {
    alignSelf: 'stretch',
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
    borderRadius: 8,
    marginLeft: 17,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
