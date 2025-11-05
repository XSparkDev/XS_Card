import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import { isTablet, scale } from '../../utils/responsive';
import GradientAvatar from '../GradientAvatar';

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

export default function CardTemplate5(props: Props) {
  const { card, qrUri, colorFallback, isWalletLoading, onPressShare, onPressWallet, onPressEmail, onPressPhone, onPressSocial, altNumber, onPressEdit } = props;
  const theme = card.colorScheme || colorFallback;

  // EXACT same getDynamicStyles as Template 1
  const getDynamicStyles = (cardColorScheme: string) => StyleSheet.create({
    shareButton: {
      flexDirection: 'row',
      backgroundColor: cardColorScheme,
      paddingVertical: isTablet() ? scale(16) : 16,
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
      paddingVertical: isTablet() ? scale(16) : 16,
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
      {/* QR Code Section - Large with generous spacing */}
      <View style={styles.qrContainer}>
        {qrUri ? (
          <Image
            style={[
              styles.qrCode,
              isTablet() && { width: scale(200), height: scale(200) }
            ]}
            source={{ uri: qrUri }}
            resizeMode="contain"
          />
        ) : (
          <Text style={isTablet() ? { fontSize: scale(16) } : undefined}>Loading QR Code...</Text>
        )}
      </View>

      {/* Logo & Profile Section - Side by side, no overlap */}
      <View style={styles.logoProfileSection}>
        {/* Logo on left */}
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

        {/* Profile on right */}
        <View style={styles.profileContainer}>
          {card.profileImage && getImageUrl(card.profileImage) ? (
            <Image
              style={styles.profileImage}
              source={{ uri: getImageUrl(card.profileImage) || '' }}
            />
          ) : (
            <GradientAvatar 
              size={120}
              style={styles.profileImage}
            />
          )}
        </View>
      </View>

      {/* Text Information - Better hierarchy and spacing */}
      <View style={styles.textSection}>
        <Text style={[
          styles.name,
          isTablet() && { fontSize: scale(28) }
        ]}>
          {`${card.name || ''} ${card.surname || ''}`.trim()}
        </Text>
        <Text style={[
          styles.position,
          isTablet() && { fontSize: scale(18) }
        ]}>
          {card.occupation || 'No occupation'}
        </Text>
        <Text style={[
          styles.company,
          isTablet() && { fontSize: scale(18) }
        ]}>
          {card.company || 'No company'}
        </Text>
      </View>

      {/* Contact Section - Circular icon backgrounds */}
      <View style={styles.contactSection}>
        <TouchableOpacity 
          style={styles.contactRow}
          onPress={() => onPressEmail(card.email)}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme }]}>
            <MaterialCommunityIcons 
              name="email-outline" 
              size={isTablet() ? scale(20) : 20} 
              color={COLORS.white} 
            />
          </View>
          <Text style={[
            styles.contactText,
            isTablet() && { fontSize: scale(16) }
          ]}>
            {card.email || 'No email address'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.contactRow}
          onPress={() => onPressPhone(card.phone)}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme }]}>
            <MaterialCommunityIcons 
              name="phone-outline" 
              size={isTablet() ? scale(20) : 20} 
              color={COLORS.white} 
            />
          </View>
          <Text style={[
            styles.contactText,
            isTablet() && { fontSize: scale(16) }
          ]}>
            {card.phone || 'No phone number'}
          </Text>
        </TouchableOpacity>

        {/* Alt Number */}
        {altNumber?.showAltNumber && altNumber?.altNumber && (
          <TouchableOpacity 
            style={styles.contactRow}
            onPress={() => onPressPhone(`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`)}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme }]}>
              <MaterialCommunityIcons 
                name="phone-outline" 
                size={isTablet() ? scale(20) : 20} 
                color={COLORS.white} 
              />
            </View>
            <Text style={[
              styles.contactText,
              isTablet() && { fontSize: scale(16) }
            ]}>
              {`${altNumber?.altCountryCode || ''}${altNumber?.altNumber || ''}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Social Links - Same circular icon treatment */}
        {card.socials && Object.entries(card.socials).map(([platform, value]: any) => {
          const textValue = typeof value === 'string' ? value.trim() : '';
          if (socialIcons[platform] && textValue !== '') {
            return (
              <TouchableOpacity 
                key={platform}
                style={styles.contactRow}
                onPress={() => onPressSocial(platform, textValue)}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme }]}>
                  <MaterialCommunityIcons 
                    name={socialIcons[platform]} 
                    size={isTablet() ? scale(20) : 20} 
                    color={COLORS.white} 
                  />
                </View>
                <Text style={[
                  styles.contactText,
                  isTablet() && { fontSize: scale(16) }
                ]}>
                  {textValue || ''}
                </Text>
              </TouchableOpacity>
            );
          }
          return null;
        })}
      </View>

      {/* Action Buttons - Larger, better spacing */}
      <View style={styles.buttonSection}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
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
  // QR Code Section - Large with generous spacing
  qrContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 10,
    marginBottom: 40, // Large gap after QR
    padding: 20,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  // Logo & Profile Section - Side by side, no overlap
  logoProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40, // Large gap after logo/profile
    height: 160,
    paddingHorizontal: 10,
  },
  logoContainer: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderRadius: 12,
    marginRight: 20, // Clear separation from profile
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  profileContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#E0E0E0', // Light grey border
  },
  // Text Information - Better hierarchy
  textSection: {
    marginBottom: 30, // Medium gap before contact section
    alignItems: 'flex-start',
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
  // Contact Section - Circular icon backgrounds
  contactSection: {
    marginBottom: 40, // Large gap before buttons
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20, // Medium gap between contact rows
    paddingVertical: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  contactText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  // Button Section
  buttonSection: {
    marginTop: 10,
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
  },
});
