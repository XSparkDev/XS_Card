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
  const { card, qrUri, colorFallback, isWalletLoading, onPressShare, onPressWallet, onPressEmail, onPressPhone, onPressSocial, altNumber } = props;
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
      {/* Top row: Logo left, QR right - bottoms aligned */}
      <View style={styles.topRow}>
        {/* Company Logo - Left */}
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
            <Text style={isTablet() ? { fontSize: scale(16) } : undefined}>Loading QR Code...</Text>
          )}
        </View>
      </View>

      {/* Large Profile Picture - Center Stage */}
      <View style={styles.profileCenterContainer}>
        <View style={styles.profileCircleContainer}>
          <Image
            style={styles.profileCenterImage}
            source={card.profileImage && getImageUrl(card.profileImage) ? 
              { uri: getImageUrl(card.profileImage) } : 
              require('../../../assets/images/profile2.jpg')
            }
          />
        </View>
      </View>

      {/* Basic Info - EXACT same as Template 1 */}
      <Text style={[
        styles.name,
        styles.leftAligned,
        isTablet() && { fontSize: scale(22), marginLeft: scale(25), marginTop: scale(20), marginBottom: scale(5) }
      ]}>
        {`${card.name || ''} ${card.surname || ''}`}
      </Text>
      <Text style={[
        styles.position,
        styles.leftAligned,
        isTablet() && { fontSize: scale(20), marginLeft: scale(25), marginBottom: scale(5) }
      ]}>
        {card.occupation || 'No occupation'}
      </Text>
      <Text style={[
        styles.company,
        styles.leftAligned,
        isTablet() && { fontSize: scale(17), marginLeft: scale(25), marginBottom: scale(10) }
      ]}>
        {card.company || 'No company'}
      </Text>

      {/* Contact Info - EXACT same as Template 1 */}
      <TouchableOpacity 
        style={[
          styles.contactSection,
          styles.leftAligned,
          isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
        ]}
        onPress={() => onPressEmail(card.email)}
      >
        <MaterialCommunityIcons 
          name="email-outline" 
          size={isTablet() ? scale(30) : 30} 
          color={theme} 
        />
        <Text style={[
          styles.contactText,
          isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
        ]}>
          {card.email || 'No email address'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.contactSection,
          styles.leftAligned,
          isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
        ]}
        onPress={() => onPressPhone(card.phone)}
      >
        <MaterialCommunityIcons 
          name="phone-outline" 
          size={isTablet() ? scale(30) : 30} 
          color={theme} 
        />
        <Text style={[
          styles.contactText,
          isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
        ]}>
          {card.phone || 'No phone number'}
        </Text>
      </TouchableOpacity>

      {/* Alt Number - only show if toggle is enabled and alt number exists - EXACT same as Template 1 */}
      {altNumber?.showAltNumber && altNumber?.altNumber && (
        <TouchableOpacity 
          style={[
            styles.contactSection,
            styles.leftAligned,
            isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
          ]}
          onPress={() => onPressPhone(`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`)}
        >
          <MaterialCommunityIcons 
            name="phone-outline" 
            size={isTablet() ? scale(30) : 30} 
            color={theme} 
          />
          <Text style={[
            styles.contactText,
            isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
          ]}>
            {`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Social Links - EXACT same as Template 1 */}
      {card.socials && Object.entries(card.socials).map(([platform, value]: any) => {
        const textValue = typeof value === 'string' ? value.trim() : '';
        if (socialIcons[platform] && textValue !== '') {
          return (
            <TouchableOpacity 
              key={platform}
              style={[
                styles.contactSection,
                styles.leftAligned,
                isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
              ]}
              onPress={() => onPressSocial(platform, textValue)}
            >
              <MaterialCommunityIcons 
                name={socialIcons[platform]} 
                size={isTablet() ? scale(30) : 30} 
                color={theme} 
              />
              <Text style={[
                styles.contactText,
                isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
              ]}>
                {textValue || ''}
              </Text>
            </TouchableOpacity>
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
  // EXACT same styles as Template 1
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
    fontFamily: 'Montserrat-Regular',
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
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
  },
});
