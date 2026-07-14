/**
 * TemplatePreviewOverlay
 *
 * The shared template-selection + draggable-preview overlay used by BOTH the Add
 * Card and Edit Card screens (single implementation, no duplication). It splits
 * the area into two regions:
 *   • top  — a horizontal strip of template options (always visible, anchored top)
 *   • below — the DraggablePreviewPanel showing the live preview of the selected
 *             template, with three snap points (docked / full / hidden).
 *
 * Mount it (absolute-fill) over the screen content below the nav header when the
 * user is previewing templates. Tapping a template updates the preview and, if
 * the panel was dismissed, brings it back to docked. Dragging the panel to the
 * hidden position calls onClose so the host screen can unmount the overlay.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import DraggablePreviewPanel, { DraggablePreviewPanelRef, SnapPosition } from './DraggablePreviewPanel';
import CardPreview from './CardPreview';
import { PreviewCardData } from './CardPreviewModal';

interface TemplatePreviewOverlayProps {
  template: number;
  card: PreviewCardData;
  altNumber?: { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean };
  /** Available template numbers (defaults to 1–5). */
  templates?: number[];
  onSelectTemplate: (n: number) => void;
  /** Called when the panel is fully dismissed (dragged to hidden) or closed. */
  onClose: () => void;
  /** When provided, tapping a text field edits it in-place. */
  onFieldEdit?: (field: string, value: string) => void;
  /** When provided, tapping the profile image opens the upload workflow. */
  onEditProfileImage?: () => void;
  /** When provided, tapping the company logo opens the upload workflow. */
  onEditCompanyLogo?: () => void;
}

export default function TemplatePreviewOverlay({
  template,
  card,
  altNumber,
  templates = [1, 2, 3, 4, 5],
  onSelectTemplate,
  onClose,
  onFieldEdit,
  onEditProfileImage,
  onEditCompanyLogo,
}: TemplatePreviewOverlayProps) {
  const [containerH, setContainerH] = useState(0);
  const [stripH, setStripH] = useState(0);
  const panelRef = useRef<DraggablePreviewPanelRef>(null);
  const opened = useRef(false);

  // Once we know both measurements, open the panel to its docked position.
  useEffect(() => {
    if (containerH > 0 && stripH > 0 && !opened.current) {
      opened.current = true;
      panelRef.current?.snapTo('docked');
    }
  }, [containerH, stripH]);

  // Position 3 (hidden) keeps the template selector full-screen — the panel is
  // just off-screen, the overlay stays mounted. Only the ✕ returns to the form.
  const handleSnapChange = (_pos: SnapPosition) => {};

  const handleSelect = (n: number) => {
    onSelectTemplate(n);
    // Selecting a template always brings the preview back to docked (unless the
    // user is already viewing it full screen), so the result is visible.
    if (panelRef.current?.getSnap() !== 'full') {
      panelRef.current?.snapTo('docked');
    }
  };

  return (
    <View
      style={styles.overlay}
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
    >
      {/* Top region — template selector strip */}
      <View style={styles.strip} onLayout={(e) => setStripH(e.nativeEvent.layout.height)}>
        <View style={styles.stripHeader}>
          <Text style={styles.stripTitle}>Choose a template</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <MaterialIcons name="close" size={22} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {templates.map((n) => {
            const selected = n === template;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => handleSelect(n)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  Template {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom region — draggable preview panel */}
      {containerH > 0 && stripH > 0 && (
        <DraggablePreviewPanel
          ref={panelRef}
          dockedTop={stripH}
          availableHeight={containerH}
          onSnapChange={handleSnapChange}
        >
          <CardPreview
            template={template}
            card={card}
            altNumber={altNumber}
            onFieldEdit={onFieldEdit}
            onEditProfileImage={onEditProfileImage}
            onEditCompanyLogo={onEditCompanyLogo}
          />
        </DraggablePreviewPanel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    zIndex: 20,
    elevation: 20,
  },
  strip: {
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 47) + 12,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  stripTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  pillRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  pillSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: '#F6F7FF',
  },
  pillText: {
    fontSize: 14,
    color: COLORS.black,
  },
  pillTextSelected: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
});
