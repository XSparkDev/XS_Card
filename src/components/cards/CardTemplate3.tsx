import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import { isTablet, scale } from '../../utils/responsive';

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
}

export default function CardTemplate3(props: Props) {
  const { card, qrUri, colorFallback, isWalletLoading, onPressShare, onPressWallet, onPressEmail, onPressPhone, onPressSocial, altNumber } = props;
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
          <Text style={isTablet() ? { fontSize: scale(16) } : undefined}>Loading QR Code...</Text>
        )}
      </View>

      {/* Logo and Profile on same line - logo takes most of line, profile on right */}
      <View style={styles.imagesRow}>
        <View style={styles.logoContainer}>
          <Image
            source={card.companyLogo && getImageUrl(card.companyLogo) ? 
              { uri: getImageUrl(card.companyLogo) } : 
              require('../../../assets/images/logoplaceholder.jpg')
            }
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Image
          source={card.profileImage && getImageUrl(card.profileImage) ? 
            { uri: getImageUrl(card.profileImage) } : 
            require('../../../assets/images/profile2.jpg')
          }
          style={styles.profile}
        />
      </View>

      {/* Personal details */}
      <Text style={styles.name}>{`${card.name || ''} ${card.surname || ''}`.trim()}</Text>
      <Text style={styles.position}>{card.occupation || ''}</Text>
      <Text style={styles.company}>{card.company || ''}</Text>

      {/* Contact Info - exact sequence as Template 1: Email, Phone, Alt Number, Socials - OUTLINED */}
      <TouchableOpacity style={[styles.pill, { borderColor: theme }]} onPress={() => onPressEmail(card.email)}>
        <MaterialCommunityIcons name="email-outline" size={22} color={theme} />
        <Text style={[styles.pillText, { color: theme }]}>{card.email || 'No email address'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.pill, { borderColor: theme }]} onPress={() => onPressPhone(card.phone)}>
        <MaterialCommunityIcons name="phone-outline" size={22} color={theme} />
        <Text style={[styles.pillText, { color: theme }]}>{card.phone || 'No phone number'}</Text>
      </TouchableOpacity>

      {/* Alt Number - only show if toggle is enabled and alt number exists */}
      {altNumber?.showAltNumber && altNumber?.altNumber && (
        <TouchableOpacity 
          style={[styles.pill, { borderColor: theme }]}
          onPress={() => onPressPhone(`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`)}
        >
          <MaterialCommunityIcons name="phone-outline" size={22} color={theme} />
          <Text style={[styles.pillText, { color: theme }]}>{`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`}</Text>
        </TouchableOpacity>
      )}

      {/* Social Links */}
      {card.socials && Object.entries(card.socials).map(([platform, value]: any) => {
        const textValue = typeof value === 'string' ? value.trim() : '';
        if (!textValue) return null;
        return (
          <TouchableOpacity 
            key={platform}
            style={[styles.pill, { borderColor: theme }]} 
            onPress={() => onPressSocial(platform, textValue)}
          >
            <MaterialCommunityIcons name={socialIcon(platform)} size={22} color={theme} />
            <Text style={[styles.pillText, { color: theme }]}>{textValue}</Text>
          </TouchableOpacity>
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
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 6,
    marginTop: 20,
  },
  position: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 6,
  },
  company: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 16,
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
    fontWeight: '700',
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

