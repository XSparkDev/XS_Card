/**
 * PremiumUpsellProvider
 *
 * Mounted once inside the NavigationContainer (above the navigator) so it can
 * use useNavigation() and overlay every screen — including the side menu, which
 * stays mounted in the background while this modal is shown.
 *
 * Layout:
 *   - Dashboard/analytics icon (large, centred, primary colour)
 *   - ✕ close button (top-right) — dismisses, same as "Maybe Later"
 *   - Heading "This is a premium feature"
 *   - Body "Keep going, {X} contacts have successfully scanned your card…"
 *     where {X} is the current user's cached contact count
 *   - Unlock Premium + Maybe Later buttons (unchanged behaviour)
 *   - "How does this work?" link (bottom-right) → nested modal explaining the
 *     feature, with its own ✕ that closes ONLY the nested modal
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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [howVisible, setHowVisible] = useState(false);
  const [contactCount, setContactCount] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = premiumUpsellService.subscribe((config) => {
      setState({ visible: true, config });
      setHowVisible(false);
    });
    return unsubscribe;
  }, []);

  // Pull the current user's contact count from the cache whenever the modal
  // opens, so the body copy reflects the real number.
  useEffect(() => {
    if (!state.visible) return;
    let active = true;
    AsyncStorage.getItem('cachedContacts')
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          const count = Array.isArray(parsed?.data) ? parsed.data.length : 0;
          setContactCount(count);
        } catch {
          /* ignore malformed cache */
        }
      })
      .catch(() => {
        /* ignore storage errors */
      });
    return () => {
      active = false;
    };
  }, [state.visible]);

  const dismiss = () => {
    setHowVisible(false);
    setState({ visible: false, config: null });
  };

  const handleUnlockPremium = () => {
    dismiss();
    // Small delay so the modal fully closes before pushing the new screen
    setTimeout(() => {
      try {
        (navigation as any).navigate('UnlockPremium');
      } catch {
        console.warn('[PremiumUpsell] Could not navigate to UnlockPremium');
      }
    }, 150);
  };

  const featureName = state.config?.featureName ?? 'this feature';
  // The feature explanation paragraph now lives behind "How does this work?"
  const explanation =
    state.config?.description ??
    `${featureName} is available exclusively for Premium members. Upgrade now to unlock the full XS Card experience.`;

  // Per-feature hero icon (MaterialCommunityIcons), defaulting to analytics.
  const heroIconName = state.config?.icon ?? 'chart-bar';

  // Per-feature body copy. When a trigger supplies static bodyText we use it
  // verbatim; otherwise fall back to the dynamic contacts sentence.
  const bodyText =
    state.config?.bodyText ??
    `Keep going, ${contactCount} ${
      contactCount === 1 ? 'contact has' : 'contacts have'
    } successfully scanned your card. To see more...`;

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
          {/* Tap-outside-to-dismiss overlay (sits above the still-mounted side menu) */}
          <TouchableWithoutFeedback onPress={dismiss}>
            <View style={styles.overlay}>
              {/* Prevent taps inside the card from closing the modal */}
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.card}>
                  {/* ✕ close button (top-right) */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={dismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={22} color={COLORS.gray} />
                  </TouchableOpacity>

                  {/* Per-feature hero icon */}
                  <MaterialCommunityIcons
                    name={heroIconName as any}
                    size={72}
                    color={COLORS.primary}
                    style={styles.heroIcon}
                  />

                  {/* Heading */}
                  <Text style={styles.headline}>This is a premium feature</Text>

                  {/* Body — dynamic contact count */}
                  <Text style={styles.body}>{bodyText}</Text>

                  {/* Primary CTA (unchanged) */}
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

                  {/* Secondary dismiss (unchanged) */}
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={dismiss}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                  </TouchableOpacity>

                  {/* "How does this work?" (bottom-right) → nested modal */}
                  <TouchableOpacity
                    style={styles.howButton}
                    onPress={() => setHowVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="info-outline"
                      size={14}
                      color={COLORS.gray}
                      style={styles.howIcon}
                    />
                    <Text style={styles.howText}>How does this work?</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>

          {/* Nested "How does this work?" modal — layered above the upsell modal.
              Closing it returns to the upsell modal (does NOT dismiss it). */}
          {howVisible && (
            <Modal
              visible={true}
              transparent
              animationType="fade"
              onRequestClose={() => setHowVisible(false)}
              statusBarTranslucent
            >
              <TouchableWithoutFeedback onPress={() => setHowVisible(false)}>
                <View style={styles.overlay}>
                  <TouchableWithoutFeedback onPress={() => {}}>
                    <View style={styles.card}>
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setHowVisible(false)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="close" size={22} color={COLORS.gray} />
                      </TouchableOpacity>

                      <Text style={styles.howHeadline}>How does this work?</Text>
                      <Text style={styles.body}>{explanation}</Text>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
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
    // Sit above the side menu without unmounting it
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    paddingBottom: 44, // room for the bottom-right "How does this work?" link
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heroIcon: {
    marginTop: 8,
    marginBottom: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: 'bold',
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
  howButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  howIcon: {
    marginRight: 4,
  },
  howText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  howHeadline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginTop: 8,
    marginBottom: 14,
    textAlign: 'center',
  },
});
