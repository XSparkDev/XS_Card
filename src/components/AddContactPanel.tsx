/**
 * AddContactPanel
 *
 * Manual "add contact" sheet. Uses the EXACT same DraggablePreviewPanel mechanics
 * as ContactDetailPanel (draggable bottom-sheet, drag-down to dismiss, spring snap)
 * — the only difference is it docks all the way at the top of the screen instead of
 * below a tapped contact, so the whole form is in view immediately.
 *
 * Purely presentational: the form values, validation, submit (/AddContact) and the
 * free-plan limit handling all live in ContactScreen and are passed in as props.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import DraggablePreviewPanel, {
  DraggablePreviewPanelRef,
  SnapPosition,
} from './cards/DraggablePreviewPanel';

export interface AddContactForm {
  name: string;
  surname: string;
  email: string;
  company: string;
  phone: string;
  howWeMet: string;
}

interface AddContactPanelProps {
  visible: boolean;
  form: AddContactForm;
  onChange: (field: keyof AddContactForm, value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  accentColor: string;
}

export default function AddContactPanel({
  visible,
  form,
  onChange,
  submitting,
  onSubmit,
  onClose,
  accentColor,
}: AddContactPanelProps) {
  const insets = useSafeAreaInsets();
  const [containerH, setContainerH] = useState(0);
  const panelRef = useRef<DraggablePreviewPanelRef>(null);
  const opened = useRef(false);

  // Dock all the way at the top (just below the status bar), so the sheet opens
  // near full-screen rather than stopping partway like the contact detail panel.
  const dockedTop = Math.max(insets.top, 12);

  // Open the panel once layout is measured.
  useEffect(() => {
    if (visible && containerH > 0 && !opened.current) {
      opened.current = true;
      panelRef.current?.snapTo('docked');
    }
  }, [visible, containerH]);

  // Close from parent.
  useEffect(() => {
    if (!visible) {
      opened.current = false;
      panelRef.current?.snapTo('hidden');
    }
  }, [visible]);

  const handleSnapChange = (pos: SnapPosition) => {
    if (pos === 'hidden') onClose();
  };

  if (!visible && !opened.current) return null;

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
          {/* Close button row — sits just below the drag handle. */}
          <View style={styles.closeRow}>
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
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Add Contact</Text>
            <Text style={styles.subtitle}>Saved to your contacts, just like a scanned card</Text>

            <Text style={styles.label}>First name *</Text>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={COLORS.gray}
              value={form.name}
              onChangeText={(t) => onChange('name', t)}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Last name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={COLORS.gray}
              value={form.surname}
              onChangeText={(t) => onChange('surname', t)}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={COLORS.gray}
              value={form.email}
              onChangeText={(t) => onChange('email', t)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Company</Text>
            <TextInput
              style={styles.input}
              placeholder="Company"
              placeholderTextColor={COLORS.gray}
              value={form.company}
              onChangeText={(t) => onChange('company', t)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="+27 ..."
              placeholderTextColor={COLORS.gray}
              value={form.phone}
              onChangeText={(t) => onChange('phone', t)}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>How we met *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Tech conference 2026"
              placeholderTextColor={COLORS.gray}
              value={form.howWeMet}
              onChangeText={(t) => onChange('howWeMet', t)}
              autoCapitalize="sentences"
            />

            <TouchableOpacity
              style={[
                styles.submit,
                { backgroundColor: accentColor },
                submitting && styles.submitDisabled,
              ]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="person-add-alt-1" size={20} color={COLORS.white} />
                  <Text style={styles.submitText}>Save Contact</Text>
                </>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.black,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 25,
    paddingVertical: 14,
    marginTop: 24,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
