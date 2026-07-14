/**
 * CardPreview
 *
 * Renders the live card preview for a given template + card, used inside the
 * shared DraggablePreviewPanel on both the Add Card and Edit Card screens.
 * Templates 2–5 delegate to the existing CardTemplate components; template 1 is
 * the original inline layout.
 *
 * When onFieldEdit is provided the preview becomes an invisible editing canvas:
 * every text element is tappable and edits in-place with no visual indicators.
 * When onEditProfileImage / onEditCompanyLogo are provided, tapping those images
 * opens the existing upload workflow from the parent screen.
 */
import React from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import { formatSocialLinkDisplay } from '../../utils/socialLinkDisplay';
import GradientAvatar from '../GradientAvatar';
import LogoPlaceholder from '../LogoPlaceholder';
import QrPlaceholder from '../QrPlaceholder';
import InlineTextField from './InlineTextField';
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

export interface CardPreviewProps {
  template: number;
  card: PreviewCardData;
  altNumber?: { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean };
  /** When provided, tapping a text field edits it in-place and calls this on blur. */
  onFieldEdit?: (field: string, value: string) => void;
  /** When provided, tapping the profile image opens the upload workflow. */
  onEditProfileImage?: () => void;
  /** When provided, tapping the company logo opens the upload workflow. */
  onEditCompanyLogo?: () => void;
}

export default function CardPreview({
  template,
  card,
  altNumber,
  onFieldEdit,
  onEditProfileImage,
  onEditCompanyLogo,
}: CardPreviewProps) {
  const accentColor = card.colorScheme || '#1B2B5B';
  const zoomLevel = card.logoZoomLevel ?? 1.0;
  const cardNameLabel = (card.cardName || '').trim() || (card.company || '').trim();

  // Helper: split "First Last" back into formData fields on blur.
  const onChangeFullName = onFieldEdit
    ? (v: string) => {
        const idx = v.indexOf(' ');
        const first = idx === -1 ? v : v.slice(0, idx);
        const last = idx === -1 ? '' : v.slice(idx + 1);
        onFieldEdit('firstName', first);
        onFieldEdit('lastName', last);
      }
    : undefined;

  const sharedTemplateProps = {
    card,
    qrUri: undefined as undefined,
    colorFallback: accentColor,
    isWalletLoading: false,
    onPressShare: () => {},
    onPressWallet: () => {},
    // In preview-edit mode these are re-routed through onChangeField inside the
    // templates; keep them as no-ops here so the pills don't open mail/dialer.
    onPressEmail: () => {},
    onPressPhone: () => {},
    onPressSocial: () => {},
    altNumber: altNumber?.showAltNumber ? altNumber : undefined,
    onChangeField: onFieldEdit
      ? (field: string, value: string) => {
          if (field === 'fullName') {
            const idx = value.indexOf(' ');
            onFieldEdit('firstName', idx === -1 ? value : value.slice(0, idx));
            onFieldEdit('lastName', idx === -1 ? '' : value.slice(idx + 1));
          } else {
            onFieldEdit(field, value);
          }
        }
      : undefined,
    onEditProfileImage,
    onEditCompanyLogo,
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.cardContainer}>
        {cardNameLabel ? (
          <View style={[styles.cardNameBadge, { borderColor: accentColor }]}>
            <MaterialIcons name="badge" size={16} color={accentColor} />
            <Text style={[styles.cardNameBadgeText, { color: accentColor }]} numberOfLines={1}>
              {cardNameLabel}
            </Text>
          </View>
        ) : null}

        {template === 1 ? (
          <>
            {/* QR Code placeholder */}
            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                <QrPlaceholder />
              </View>
              <Text style={styles.qrLabel}>QR Code</Text>
            </View>

            {/* Company logo + profile image */}
            <View style={styles.logoContainer}>
              <TouchableOpacity
                activeOpacity={onEditCompanyLogo ? 1 : 1}
                onPress={onEditCompanyLogo}
                disabled={!onEditCompanyLogo}
                style={styles.logoFrame}
              >
                {card.companyLogo && getImageUrl(card.companyLogo) ? (
                  <Image
                    source={{ uri: getImageUrl(card.companyLogo) || '' }}
                    style={{ width: '100%', height: '100%', transform: [{ scale: zoomLevel }], opacity: 1 }}
                    resizeMode="contain"
                    fadeDuration={300}
                  />
                ) : (
                  <LogoPlaceholder textSize={22} />
                )}
              </TouchableOpacity>

              <View style={styles.profileContainer}>
                <TouchableOpacity
                  activeOpacity={onEditProfileImage ? 1 : 1}
                  onPress={onEditProfileImage}
                  disabled={!onEditProfileImage}
                  style={styles.profileImageContainer}
                >
                  {card.profileImage ? (
                    <Image style={styles.profileImage} source={{ uri: getImageUrl(card.profileImage) || '' }} />
                  ) : (
                    <GradientAvatar size={110} style={styles.profileImage} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Name / role / company — invisible inline editors */}
            <InlineTextField
              value={`${card.name ?? ''} ${card.surname ?? ''}`.trim()}
              onChange={onChangeFullName}
              style={styles.name}
            />
            <InlineTextField
              value={card.occupation ?? ''}
              onChange={onFieldEdit ? v => onFieldEdit('occupation', v) : undefined}
              style={styles.position}
            />
            <InlineTextField
              value={card.company ?? ''}
              onChange={onFieldEdit ? v => onFieldEdit('company', v) : undefined}
              style={styles.company}
            />

            {/* Email */}
            <View style={styles.contactSection}>
              <MaterialCommunityIcons name="email-outline" size={24} color={accentColor} />
              <InlineTextField
                value={card.email ?? ''}
                onChange={onFieldEdit ? v => onFieldEdit('email', v) : undefined}
                style={styles.contactText}
              />
            </View>

            {/* Phone */}
            <View style={styles.contactSection}>
              <MaterialCommunityIcons name="phone-outline" size={24} color={accentColor} />
              <InlineTextField
                value={card.phone ?? ''}
                onChange={onFieldEdit ? v => onFieldEdit('phoneNumber', v) : undefined}
                style={styles.contactText}
              />
            </View>

            {/* Social links */}
            {Object.entries(card.socials ?? {})
              .filter(([, value]) => Boolean(value))
              .map(([socialId, value]) => {
                const icon = SOCIAL_ICON_MAP[socialId] ?? 'link';
                return (
                  <View key={socialId} style={styles.contactSection}>
                    <MaterialCommunityIcons name={icon} size={24} color={accentColor} />
                    <InlineTextField
                      value={formatSocialLinkDisplay(socialId, value as string)}
                      onChange={onFieldEdit ? v => onFieldEdit(socialId, v) : undefined}
                      style={styles.contactText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    />
                  </View>
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
  scrollContent: { paddingBottom: 160 },
  cardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 16,
    margin: 16,
  },
  cardNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#F6F7FF',
    marginBottom: 16,
    maxWidth: '100%',
  },
  cardNameBadgeText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
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
  profileContainer: { position: 'absolute', bottom: -60, left: '50%', transform: [{ translateX: -60 }], alignItems: 'center' },
  profileImageContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 5, borderColor: COLORS.white, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', overflow: 'hidden' },
  profileImage: { width: 110, height: 110, borderRadius: 55 },
  name: { fontSize: 22, fontWeight: '600', marginBottom: 5, marginTop: 20, color: COLORS.black, marginLeft: 10 },
  position: { fontSize: 18, marginBottom: 5, color: '#444', marginLeft: 10 },
  company: { fontSize: 16, fontWeight: '500', marginBottom: 20, color: '#666', marginLeft: 10 },
  contactSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 5, borderRadius: 8, marginLeft: 10 },
  contactText: { marginLeft: 10, fontSize: 16, color: '#333', flex: 1 },
  fallbackText: { textAlign: 'center', color: '#888', padding: 24 },
});
