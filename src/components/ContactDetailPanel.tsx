/**
 * ContactDetailPanel
 *
 * Draggable bottom-sheet for contact details, using the same DraggablePreviewPanel
 * mechanics as the template preview overlay. Mounts as an absolute-fill overlay
 * with pointerEvents="box-none" so the contact list behind it stays scrollable and
 * tappable — the user can tap another contact while this panel is open.
 *
 * Snap positions:
 *   docked → dockedTop  (panel top sits right below the tapped contact)
 *   full   → 0          (full-screen contact detail view)
 *   hidden → off-screen (panel is dismissed)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import GradientAvatar from './GradientAvatar';
import DraggablePreviewPanel, {
  DraggablePreviewPanelRef,
  SnapPosition,
} from './cards/DraggablePreviewPanel';
import { formatTimestamp } from '../utils/dateFormatter';

export interface ContactPanelData {
  id?: string;
  name: string;
  surname: string;
  phone: string;
  email?: string;
  company?: string;
  howWeMet?: string;
  createdAt: string | any;
  isXsCardUser?: boolean;
  profileImageUrl?: string;
  profileImageUrls?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
}

interface ContactDetailPanelProps {
  contact: ContactPanelData | null;
  visible: boolean;
  dockedTop: number;
  onClose: () => void;
}

const formatPhone = (phone: string): string => {
  if (!phone) return '';
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('00')) return '+' + clean.substring(2);
  if (clean.startsWith('0')) return '+27' + clean.substring(1);
  return clean;
};

export default function ContactDetailPanel({
  contact,
  visible,
  dockedTop,
  onClose,
}: ContactDetailPanelProps) {
  const insets = useSafeAreaInsets();
  const [containerH, setContainerH] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [snapPos, setSnapPos] = useState<SnapPosition>('hidden');
  const panelRef = useRef<DraggablePreviewPanelRef>(null);
  const opened = useRef(false);
  const prevContactKey = useRef<string | null>(null);

  // Open panel once layout is measured
  useEffect(() => {
    if (visible && containerH > 0 && !opened.current) {
      opened.current = true;
      panelRef.current?.snapTo('docked');
    }
  }, [visible, containerH]);

  // When the contact changes while the panel is already open: reset image error
  // and let DraggablePreviewPanel's own effect re-clamp to the new dockedTop.
  useEffect(() => {
    if (!contact) return;
    const key = `${contact.phone}-${contact.name}`;
    if (prevContactKey.current !== null && prevContactKey.current !== key) {
      setImgError(false);
      // If panel was hidden (tapped after dismiss), reopen
      if (opened.current && panelRef.current?.getSnap() === 'hidden') {
        panelRef.current.snapTo('docked');
      }
    }
    prevContactKey.current = key;
  }, [contact]);

  // Close from parent
  useEffect(() => {
    if (!visible) {
      opened.current = false;
      panelRef.current?.snapTo('hidden');
    }
  }, [visible]);

  const handleSnapChange = (pos: SnapPosition) => {
    setSnapPos(pos);
    if (pos === 'hidden') onClose();
  };

  if (!contact) return null;

  const imageUrl = contact.isXsCardUser
    ? (contact.profileImageUrls?.medium ??
       contact.profileImageUrls?.thumbnail ??
       contact.profileImageUrl ??
       null)
    : null;

  const showImage = !!imageUrl && !imgError;
  const showGradient = contact.isXsCardUser && !showImage;
  const phoneFormatted = formatPhone(contact.phone);

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
    >
      {containerH > 0 && (
        <DraggablePreviewPanel
          ref={panelRef}
          dockedTop={dockedTop}
          availableHeight={containerH}
          onSnapChange={handleSnapChange}
        >
          {/* Close button row — sits just below the drag handle. When the panel is
              expanded to full screen its top reaches under the notch/status bar, so
              drop the close button down past the safe-area inset to keep it tappable. */}
          <View
            style={[
              styles.closeRow,
              snapPos === 'full' && { paddingTop: Math.max(insets.top - 24, 8) },
            ]}
          >
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <MaterialIcons name="close" size={24} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              {showImage && (
                <Image
                  source={{ uri: imageUrl! }}
                  style={styles.avatar}
                  onError={() => setImgError(true)}
                />
              )}
              {showGradient && <GradientAvatar size={88} />}
              {!contact.isXsCardUser && (
                <View style={styles.plainAvatar}>
                  <MaterialIcons name="person" size={44} color="#C0C0C0" />
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.name}>
              {contact.name} {contact.surname}
            </Text>

            {/* XS Card badge */}
            {contact.isXsCardUser && (
              <View style={styles.badge}>
                <MaterialIcons name="verified" size={14} color={COLORS.primary} />
                <Text style={styles.badgeText}>XS Card User</Text>
              </View>
            )}

            {/* Company */}
            {!!contact.company && (
              <Text style={styles.company}>{contact.company}</Text>
            )}

            <View style={styles.divider} />

            {/* Phone — tappable to call */}
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                const dial = phoneFormatted.replace(/[^0-9+]/g, '');
                if (!dial) return;
                Linking.openURL(`tel:${dial}`).catch(() =>
                  Alert.alert('Unable to call', 'No phone app available on this device.')
                );
              }}
            >
              <View style={styles.infoIconWrap}>
                <MaterialIcons name="phone" size={20} color={COLORS.secondary} />
              </View>
              <Text style={styles.infoText} numberOfLines={1}>
                {phoneFormatted}
              </Text>
              <MaterialIcons name="chevron-right" size={18} color={COLORS.gray} />
            </TouchableOpacity>

            {/* Email — tappable to compose */}
            {!!contact.email && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() =>
                  Linking.openURL(`mailto:${contact.email}`).catch(() =>
                    Alert.alert('Unable to email', 'No email app available on this device.')
                  )
                }
              >
                <View style={styles.infoIconWrap}>
                  <MaterialIcons name="email" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.infoText} numberOfLines={1}>
                  {contact.email}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={COLORS.gray} />
              </TouchableOpacity>
            )}

            {/* How we met */}
            {!!contact.howWeMet && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <MaterialIcons
                    name={contact.howWeMet === 'Scanned QR Code' ? 'qr-code-scanner' : 'place'}
                    size={20}
                    color={COLORS.secondary}
                  />
                </View>
                <Text style={styles.infoText} numberOfLines={1}>
                  {contact.howWeMet}
                </Text>
              </View>
            )}

            {/* Date added */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <MaterialIcons name="event" size={20} color={COLORS.secondary} />
              </View>
              <Text style={[styles.infoText, styles.dateText]} numberOfLines={1}>
                {formatTimestamp(contact.createdAt)}
              </Text>
            </View>
          </ScrollView>
        </DraggablePreviewPanel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  avatarWrap: {
    marginBottom: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  plainAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: 'Montserrat_500Medium',
  },
  company: {
    fontSize: 14,
    color: COLORS.gray,
    fontFamily: 'Montserrat_500Medium',
    marginBottom: 4,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  infoIconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
    fontFamily: 'Montserrat_500Medium',
  },
  dateText: {
    color: COLORS.gray,
    fontSize: 14,
  },
});
