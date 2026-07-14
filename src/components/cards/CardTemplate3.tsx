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

export default function CardTemplate3(props: Props) {
  const { card, qrUri, colorFallback, isWalletLoading, onPressShare, onPressWallet, onPressEmail, onPressPhone, onPressSocial, altNumber, onPressEdit, scanLimited, scanCountdown, qrTimedOut, onRetryQr, onChangeField, onEditProfileImage, onEditCompanyLogo } = props;
  const theme = card.colorScheme || colorFallback;

  // Use exact same icon mapping as Template 1
  const socialIconMap: { [key: string]: keyof typeof MaterialCommunityIcons.glyphMap } = {
    whatsapp: 'whatsapp',
    x: 'twitter',
    facebook: 'facebook',
    linkedin: 'linkedin',
    website: 'web',
    tiktok: 'music-note',
    instagram: 'instagram'
  };

  const socialIcon = (platform: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    return socialIconMap[platform] || 'web';
  };

  return (
    <View style={styles.container}>
      {/* Edit Button for Tablet - positioned to the right of QR code (same as OG template) */}
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
      {/* QR Code at top (same position as Template 1) */}
      <View style={styles.qrWrap}>
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

      {/* Logo and Profile on same line */}
      <View style={styles.imagesRow}>
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
        <TouchableOpacity activeOpacity={1} onPress={onEditProfileImage} disabled={!onEditProfileImage}>
          {card.profileImage && getImageUrl(card.profileImage) ? (
            <Image
              source={{ uri: getImageUrl(card.profileImage) || '' }}
              style={styles.profile}
            />
          ) : (
            <GradientAvatar
              size={120}
              style={styles.profile}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Personal details */}
      <InlineTextField
        value={`${card.name || ''} ${card.surname || ''}`.trim()}
        onChange={onChangeField ? v => onChangeField('fullName', v) : undefined}
        style={styles.name}
      />
      <InlineTextField
        value={card.occupation || ''}
        onChange={onChangeField ? v => onChangeField('occupation', v) : undefined}
        style={styles.position}
      />
      <InlineTextField
        value={card.company || ''}
        onChange={onChangeField ? v => onChangeField('company', v) : undefined}
        style={styles.company}
      />

      {/* Contact Info - OUTLINED */}
      <View style={[styles.pill, { borderColor: theme }]}>
        <MaterialCommunityIcons name="email-outline" size={22} color={theme} />
        <InlineTextField
          value={card.email || 'No email address'}
          onChange={onChangeField ? v => onChangeField('email', v) : undefined}
          style={[styles.pillText, { color: theme, flex: 1 }]}
        />
      </View>

      <View style={[styles.pill, { borderColor: theme }]}>
        <MaterialCommunityIcons name="phone-outline" size={22} color={theme} />
        <InlineTextField
          value={card.phone || 'No phone number'}
          onChange={onChangeField ? v => onChangeField('phoneNumber', v) : undefined}
          style={[styles.pillText, { color: theme, flex: 1 }]}
        />
      </View>

      {/* Alt Number */}
      {altNumber?.showAltNumber && altNumber?.altNumber && (
        <View style={[styles.pill, { borderColor: theme }]}>
          <MaterialCommunityIcons name="phone-outline" size={22} color={theme} />
          <Text style={[styles.pillText, { color: theme }]}>{`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`}</Text>
        </View>
      )}

      {/* Social Links */}
      {card.socials && Object.entries(card.socials).map(([platform, value]: any) => {
        const textValue = typeof value === 'string' ? value.trim() : '';
        if (!textValue) return null;
        return (
          <View key={platform} style={[styles.pill, { borderColor: theme }]}>
            <MaterialCommunityIcons name={socialIcon(platform)} size={22} color={theme} />
            <InlineTextField
              value={formatSocialLinkDisplay(platform, textValue)}
              onChange={onChangeField ? v => onChangeField(platform, v) : undefined}
              style={[styles.pillText, { color: theme, flex: 1 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            />
          </View>
        );
      })}

      {/* Combined Share & Wallet Button - Bottom Right - OUTLINED */}
      <View style={styles.bottomButtonContainer}>
        <View style={[styles.combinedButton, { borderColor: theme }]}>
          <TouchableOpacity 
            style={styles.combinedButtonLeft} 
            onPress={onPressShare}
          >
            <MaterialIcons name="share" size={24} color={theme} />
          </TouchableOpacity>
          <View style={[styles.combinedButtonDivider, { backgroundColor: theme + '40' }]} />
          <TouchableOpacity 
            style={styles.combinedButtonRight} 
            onPress={onPressWallet}
            disabled={isWalletLoading}
          >
            {isWalletLoading ? (
              <ActivityIndicator size="small" color={theme} />
            ) : (
              <MaterialCommunityIcons name="wallet" size={24} color={theme} />
            )}
          </TouchableOpacity>
        </View>
      </View>

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
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 10,
    alignSelf: 'center',
  },
  qrCode: {
    width: 150,
    height: 150,
    alignSelf: 'center',
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  imagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  logoContainer: {
    flex: 1,
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    marginRight: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  profile: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: COLORS.white,
  },
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 40,
    marginTop: 14,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  bottomButtonContainer: {
    alignItems: 'flex-end',
    marginTop: 14,
    width: '100%',
  },
  combinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 40,
    width: '50%',
    minHeight: 56,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  combinedButtonLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  combinedButtonDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 16,
  },
  combinedButtonRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

