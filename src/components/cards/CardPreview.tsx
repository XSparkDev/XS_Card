/**
 * CardPreview
 *
 * Renders the live card preview for a given template + card, used inside the
 * shared DraggablePreviewPanel on both the Add Card and Edit Card screens.
 * Templates 2–5 delegate to the existing CardTemplate components; template 1 is
 * the original inline layout (kept here so the panel preview matches the modal
 * without modifying CardPreviewModal).
 */
import React from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import GradientAvatar from '../GradientAvatar';
import CardTemplate2 from './CardTemplate2';
import CardTemplate3 from './CardTemplate3';
import CardTemplate4 from './CardTemplate4';
import CardTemplate5 from './CardTemplate5';
import { PreviewCardData } from './CardPreviewModal';

const SOCIAL_ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  whatsapp: 'whatsapp',
  x: 'twitter',
  facebook: 'facebook',
  linkedin: 'linkedin',
  website: 'web',
  tiktok: 'music-note',
  instagram: 'instagram',
};

interface CardPreviewProps {
  template: number;
  card: PreviewCardData;
  altNumber?: { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean };
}

export default function CardPreview({ template, card, altNumber }: CardPreviewProps) {
  const accentColor = card.colorScheme || '#1B2B5B';
  const zoomLevel = card.logoZoomLevel ?? 1.0;

  const sharedTemplateProps = {
    card,
    qrUri: undefined as undefined,
    colorFallback: accentColor,
    isWalletLoading: false,
    onPressShare: () => {},
    onPressWallet: () => {},
    onPressEmail: () => {},
    onPressPhone: () => {},
    onPressSocial: () => {},
    altNumber: altNumber?.showAltNumber ? altNumber : undefined,
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.cardContainer}>
        {template === 1 ? (
          <>
            {/* QR Code placeholder */}
            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                <MaterialIcons name="qr-code-2" size={80} color="#ccc" />
              </View>
              <Text style={styles.qrLabel}>QR Code</Text>
            </View>

            {/* Company logo + profile image */}
            <View style={styles.logoContainer}>
              <View style={styles.logoFrame}>
                {card.companyLogo && getImageUrl(card.companyLogo) ? (
                  <Image
                    source={{ uri: getImageUrl(card.companyLogo) || '' }}
                    style={{ width: '100%', height: '100%', transform: [{ scale: zoomLevel }], opacity: 1 }}
                    resizeMode="contain"
                    fadeDuration={300}
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoPlaceholderText}>LOGO</Text>
                  </View>
                )}
              </View>

              <View style={styles.profileContainer}>
                <View style={styles.profileImageContainer}>
                  {card.profileImage ? (
                    <Image style={styles.profileImage} source={{ uri: getImageUrl(card.profileImage) || '' }} />
                  ) : (
                    <GradientAvatar size={110} style={styles.profileImage} />
                  )}
                </View>
              </View>
            </View>

            {/* Name / role / company */}
            <Text style={styles.name}>{`${card.name ?? ''} ${card.surname ?? ''}`.trim()}</Text>
            <Text style={styles.position}>{card.occupation}</Text>
            <Text style={styles.company}>{card.company}</Text>

            {/* Email */}
            <TouchableOpacity style={styles.contactSection}>
              <MaterialCommunityIcons name="email-outline" size={24} color={accentColor} />
              <Text style={styles.contactText}>{card.email}</Text>
            </TouchableOpacity>

            {/* Phone */}
            <TouchableOpacity style={styles.contactSection}>
              <MaterialCommunityIcons name="phone-outline" size={24} color={accentColor} />
              <Text style={styles.contactText}>{card.phone}</Text>
            </TouchableOpacity>

            {/* Social links */}
            {Object.entries(card.socials ?? {})
              .filter(([, value]) => Boolean(value))
              .map(([socialId, value]) => {
                const icon = SOCIAL_ICON_MAP[socialId] ?? 'link';
                return (
                  <TouchableOpacity key={socialId} style={styles.contactSection}>
                    <MaterialCommunityIcons name={icon} size={24} color={accentColor} />
                    <Text style={styles.contactText}>{value}</Text>
                  </TouchableOpacity>
                );
              })}
          </>
        ) : template === 2 ? (
          <CardTemplate2 {...sharedTemplateProps} />
        ) : template === 3 ? (
          <CardTemplate3 {...sharedTemplateProps} />
        ) : template === 4 ? (
          <CardTemplate4 {...sharedTemplateProps} />
        ) : template === 5 ? (
          <CardTemplate5 {...sharedTemplateProps} />
        ) : (
          <Text style={styles.fallbackText}>Template not found</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // Generous bottom padding so the entire card (incl. the bottom share/wallet row)
  // can be scrolled fully into view above the bottom edge of the screen.
  scrollContent: { paddingBottom: 160 },
  cardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 16,
    margin: 16,
  },
  qrContainer: { alignItems: 'center', marginBottom: 20 },
  qrPlaceholder: {
    width: 150,
    height: 124,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  qrLabel: { marginTop: 8, fontSize: 18, color: '#444', textAlign: 'center' },
  logoContainer: { width: '100%', position: 'relative', overflow: 'visible', marginBottom: 80, borderRadius: 12, padding: 8 },
  logoFrame: { width: '100%', height: 200, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: 12 },
  logoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#d3d3d3', justifyContent: 'center', alignItems: 'center' },
  logoPlaceholderText: { fontSize: 48, fontWeight: 'bold', color: '#ffffff', textShadowColor: 'rgba(255, 255, 255, 0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  profileContainer: { position: 'absolute', bottom: -60, left: '50%', transform: [{ translateX: -60 }], alignItems: 'center' },
  profileImageContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 5, borderColor: COLORS.white, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  profileImage: { width: 110, height: 110, borderRadius: 55 },
  name: { fontSize: 22, fontWeight: '600', marginBottom: 5, marginTop: 20, color: COLORS.black, marginLeft: 10 },
  position: { fontSize: 18, marginBottom: 5, color: '#444', marginLeft: 10 },
  company: { fontSize: 16, fontWeight: '500', marginBottom: 20, color: '#666', marginLeft: 10 },
  contactSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 5, borderRadius: 8, marginLeft: 10 },
  contactText: { marginLeft: 10, fontSize: 16, color: '#333' },
  fallbackText: { textAlign: 'center', color: '#888', padding: 24 },
});
