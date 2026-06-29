/**
 * CardPreviewModal
 *
 * Shared full-screen preview modal used by both EditCard and AddCards.
 * Pass a card object built by the caller, a template number, and optional
 * callbacks. If `onSave` is omitted only the close button is rendered.
 */

import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getImageUrl } from '../../utils/imageUtils';
import GradientAvatar from '../GradientAvatar';
import LogoPlaceholder from '../LogoPlaceholder';
import QrPlaceholder from '../QrPlaceholder';
import CardTemplate2 from './CardTemplate2';
import CardTemplate3 from './CardTemplate3';
import CardTemplate4 from './CardTemplate4';
import CardTemplate5 from './CardTemplate5';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreviewCardData {
  /** User-defined label that identifies the card (separate from the company name). */
  cardName?: string;
  name?: string;
  surname?: string;
  occupation?: string;
  company?: string;
  email?: string;
  phone?: string;
  /** Social links: { whatsapp: 'url', linkedin: 'url', … } */
  socials?: Record<string, string>;
  colorScheme?: string;
  profileImage?: string | null;
  companyLogo?: string | null;
  logoZoomLevel?: number;
  template?: number;
}

interface CardPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when the user taps the primary action button.
   *  If omitted, no save button is rendered. */
  onSave?: () => void;
  template: number;
  card: PreviewCardData;
  altNumber?: {
    altNumber?: string;
    altCountryCode?: string;
    showAltNumber?: boolean;
  };
  /** Label for the secondary (close) button — defaults to "Continue Editing" */
  closeLabel?: string;
  /** Label for the primary (save) button — defaults to "Save & Exit" */
  saveLabel?: string;
}

// ─── Social icon map (mirrors the socials array used in each screen) ──────────

const SOCIAL_ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  whatsapp: 'whatsapp',
  x: 'twitter',
  facebook: 'facebook',
  linkedin: 'linkedin',
  website: 'web',
  tiktok: 'music-note',
  instagram: 'instagram',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CardPreviewModal({
  visible,
  onClose,
  onSave,
  template,
  card,
  altNumber,
  closeLabel = 'Continue Editing',
  saveLabel = 'Save & Exit',
}: CardPreviewModalProps) {
  const accentColor = card.colorScheme || '#1B2B5B';
  const zoomLevel = card.logoZoomLevel ?? 1.0;
  // Card-name identifier shown above the card design (not part of the card face).
  const cardNameLabel = (card.cardName || '').trim() || (card.company || '').trim();

  // Props shared by CardTemplate2–5
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Card Preview</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview">
            <MaterialIcons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Card content */}
        <ScrollView style={styles.cardScrollView}>
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
              // ── Template 1: original hardcoded layout ──────────────────────
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
                  <View style={styles.logoFrame}>
                    {card.companyLogo && getImageUrl(card.companyLogo) ? (
                      <Image
                        source={{ uri: getImageUrl(card.companyLogo) || '' }}
                        style={{
                          width: '100%',
                          height: '100%',
                          transform: [{ scale: zoomLevel }],
                          opacity: 1,
                        }}
                        resizeMode="contain"
                        fadeDuration={300}
                      />
                    ) : (
                      <LogoPlaceholder textSize={22} />
                    )}
                  </View>

                  <View style={styles.profileContainer}>
                    <View style={styles.profileImageContainer}>
                      {card.profileImage ? (
                        <Image
                          style={styles.profileImage}
                          source={{ uri: getImageUrl(card.profileImage) || '' }}
                        />
                      ) : (
                        <GradientAvatar size={110} style={styles.profileImage} />
                      )}
                    </View>
                  </View>
                </View>

                {/* Name / role / company */}
                <Text style={styles.name}>
                  {`${card.name ?? ''} ${card.surname ?? ''}`.trim()}
                </Text>
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

                {/* Social links — derived from card.socials */}
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

        {/* Action row */}
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.closeButton, { borderColor: accentColor }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.closeText, { color: accentColor }]}>{closeLabel}</Text>
          </TouchableOpacity>

          {onSave && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: accentColor }]}
              onPress={() => {
                onClose();
                onSave();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.saveText}>{saveLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles (extracted verbatim from EditCard's previewStyles) ─────────────────

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  cardScrollView: {
    flex: 1,
  },
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
  cardNameBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 150,
    height: 124,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  qrLabel: {
    marginTop: 8,
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
  },
  logoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    marginBottom: 80,
    borderRadius: 12,
    padding: 8,
  },
  logoFrame: {
    width: '100%',
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d3d3d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  profileContainer: {
    position: 'absolute',
    bottom: -60,
    left: '50%',
    transform: [{ translateX: -60 }],
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20,
    color: COLORS.black,
    marginLeft: 10,
  },
  position: {
    fontSize: 18,
    marginBottom: 5,
    color: '#444',
    marginLeft: 10,
  },
  company: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    color: '#666',
    marginLeft: 10,
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
    borderRadius: 8,
    marginLeft: 10,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  closeButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeText: {
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    color: COLORS.white,
    fontWeight: '500',
  },
  fallbackText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});
