/**
 * PremiumUpsellProvider
 *
 * Place this component once inside the NavigationContainer so it can use
 * useNavigation().  It subscribes to premiumUpsellService and renders
 * the upsell modal whenever trigger() is called.
 *
 * Visual style mirrors ProfileCompletionModal exactly:
 *   - animationType="fade"
 *   - rgba(0,0,0,0.5) overlay
 *   - white card, borderRadius 20, padding 30
 *   - Primary (COLORS.primary) CTA + ghost secondary
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../constants/colors';
import { premiumUpsellService, UpsellConfig } from '../utils/premiumUpsell';
import { RootStackParamList } from '../types';

type NavProp = StackNavigationProp<RootStackParamList>;

interface UpsellState {
  visible: boolean;
  config: UpsellConfig | null;
}

export default function PremiumUpsellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = useNavigation<NavProp>();
  const [state, setState] = useState<UpsellState>({ visible: false, config: null });

  useEffect(() => {
    const unsubscribe = premiumUpsellService.subscribe((config) => {
      setState({ visible: true, config });
    });
    return unsubscribe;
  }, []);

  const dismiss = () => setState({ visible: false, config: null });

  const handleUnlockPremium = () => {
    dismiss();
    // Small delay so the modal fully closes before pushing the new screen
    setTimeout(() => {
      try {
        (navigation as any).navigate('UnlockPremium');
      } catch {
        // Fallback if UnlockPremium is not in the current stack
        console.warn('[PremiumUpsell] Could not navigate to UnlockPremium');
      }
    }, 150);
  };

  const featureName = state.config?.featureName ?? 'this feature';
  const description =
    state.config?.description ??
    `${featureName} is available exclusively for Premium members. Upgrade now to unlock the full XS Card experience.`;

  return (
    <>
      {children}

      {state.visible && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={dismiss}
          statusBarTranslucent
        >
          {/* Tap-outside-to-dismiss overlay */}
          <TouchableWithoutFeedback onPress={dismiss}>
            <View style={styles.overlay}>
              {/* Prevent taps inside the card from closing the modal */}
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.card}>
                  {/* Premium icon */}
                  <View style={styles.iconWrapper}>
                    <MaterialIcons name="lock" size={52} color={COLORS.primary} />
                  </View>

                  <Text style={styles.headline}>Premium Feature</Text>

                  <Text style={styles.body}>{description}</Text>

                  {/* Primary CTA */}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleUnlockPremium}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons
                      name="star"
                      size={18}
                      color={COLORS.white}
                      style={styles.btnIcon}
                    />
                    <Text style={styles.primaryButtonText}>Unlock Premium</Text>
                  </TouchableOpacity>

                  {/* Secondary dismiss */}
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={dismiss}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF0F3', // soft pink tint matching COLORS.primaryLight
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    marginBottom: 12,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: COLORS.gray,
    fontSize: 15,
    fontWeight: '500',
  },
});
