/**
 * EntryInfoModal
 *
 * Reusable informational "entry" modal shown automatically the first few times
 * a user lands on a screen (e.g. Events, Dashboard). Shown a maximum of
 * `maxShows` times total (tracked in AsyncStorage under `storageKey`), for both
 * free and premium users — with different content per plan.
 *
 * Structure mirrors PremiumUpsellProvider for visual consistency:
 *   - ✕ close button (top-right)        → closes the modal
 *   - large centred hero icon (primary colour)
 *   - bold heading
 *   - plan-specific body (free copy has an inline pink "unlock premium" link)
 *   - optional row of decorative feature-preview icons
 *   - "How does this work?" link (bottom-right) → nested modal with detail,
 *     whose ✕ closes ONLY the nested modal (returns to this one)
 *
 * The modal overlays the screen (RN Modal + zIndex/elevation) without
 * unmounting or altering any underlying screen/navigation state.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  InteractionManager,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { usePremiumUpsell } from '../hooks/usePremiumUpsell';

export interface FeaturePreviewIcon {
  /** MaterialCommunityIcons glyph name */
  icon: string;
  label: string;
}

interface EntryInfoModalProps {
  /**
   * AsyncStorage key tracking how many times this modal has shown. When set, the
   * modal stops appearing after `maxShows` displays (used by the Events modal).
   * OMIT to disable the seen-count entirely (Dashboard/Calendar), so the modal
   * is only ever suppressed by the "Don't show again" flag.
   */
  storageKey?: string;
  /** MaterialCommunityIcons glyph for the hero icon */
  icon: string;
  /** Bold heading under the icon */
  heading: string;
  /** Free-user copy shown before the inline pink link */
  freeTextBefore: string;
  /** Pink, tappable inline link text → navigates to UnlockPremium (free users) */
  freeLinkText?: string;
  /** Free-user copy shown after the inline link */
  freeTextAfter?: string;
  /** Premium-user informational copy */
  premiumText: string;
  /** Optional decorative preview-icon row (shown to both plans) */
  featureIcons?: FeaturePreviewIcon[];
  /** Detailed "how it works" copy for the nested modal */
  howItWorksText: string;
  /** Max number of times to ever show this modal (default 3) */
  maxShows?: number;
  /**
   * When provided, renders a "Don't show again" checkbox. If the user checks it
   * and dismisses, this AsyncStorage key is set to 'true' and the modal is never
   * shown again (takes priority over the seen count). Omit to hide the checkbox.
   */
  dontShowAgainKey?: string;
  /** Only trigger for free users (premium → never shows). Default false. */
  requireFreeUser?: boolean;
  /** Render "Unlock Premium" + "Maybe Later" buttons under the body (upsell). */
  showUpsellButtons?: boolean;
  /**
   * Sequencing gate. When false, the eligibility check waits and does not show;
   * it runs once this flips true (used to show a second modal only after a first
   * one has resolved). Default true.
   */
  enabled?: boolean;
  /**
   * Called exactly once per focus when this modal's lifecycle for that visit is
   * resolved — either it decided NOT to show, or it was shown and then dismissed.
   * Used to sequence a follow-up modal.
   */
  onResolved?: () => void;
  /**
   * Marks this modal as sequenced (gated by `enabled`). When true, the gate is
   * forced CLOSED at the start of every focus so a stale `enabled` from a prior
   * visit can't fire it early — it only opens when `enabled` transitions to true
   * this focus (e.g. the prior modal resolves). Default false.
   */
  sequenced?: boolean;
  /** Short label used to disambiguate this modal in debug logs. */
  name?: string;
}

export default function EntryInfoModal({
  storageKey,
  icon,
  heading,
  freeTextBefore,
  freeLinkText,
  freeTextAfter,
  premiumText,
  featureIcons,
  howItWorksText,
  maxShows = 3,
  dontShowAgainKey,
  requireFreeUser = false,
  showUpsellButtons = false,
  enabled = true,
  onResolved,
  sequenced = false,
  name = 'modal',
}: EntryInfoModalProps) {
  const navigation = useNavigation<any>();
  const { isFreeUser, isLoadingUserStatus } = usePremiumUpsell();

  const [visible, setVisible] = useState(false);
  const [howVisible, setHowVisible] = useState(false);
  // Unchecked by default every time the modal opens.
  const [dontShow, setDontShow] = useState(false);

  // Refs that keep the eligibility check reliable across focus + async resolves:
  //  - focusedRef:   is the screen currently focused?
  //  - evaluatedRef: have we already made a definitive show/skip decision this focus?
  //  - resolvedRef:  has onResolved fired for this focus? (single-call guard)
  //  - loadingRef / isFreeUserRef / enabledRef: latest values for the stable callback
  const focusedRef = useRef(false);
  const evaluatedRef = useRef(false);
  const resolvedRef = useRef(false);
  const loadingRef = useRef(isLoadingUserStatus);
  const isFreeUserRef = useRef(isFreeUser);
  const enabledRef = useRef(enabled);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    loadingRef.current = isLoadingUserStatus;
  }, [isLoadingUserStatus]);
  useEffect(() => {
    isFreeUserRef.current = isFreeUser;
  }, [isFreeUser]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  // Fire onResolved at most once per focus.
  const resolve = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolvedRef.current?.();
  }, []);

  // Present the modal only AFTER the current navigation/transition settles.
  // Presenting an RN Modal mid-transition (entering the screen, or while a sibling
  // modal is still animating out) overlaps two native modal presentations — on iOS
  // that crashes ("present while a presentation is in progress") or makes the modal
  // silently fail to appear. A real device's slower timing makes it reproducible;
  // the simulator is usually fast enough to dodge it.
  const showModalSafely = useCallback(() => {
    setDontShow(false); // always unchecked on open
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      if (focusedRef.current) setVisible(true);
    };
    // Prefer to present right after the transition settles…
    InteractionManager.runAfterInteractions(show);
    // …but never withhold the modal indefinitely if an interaction handle stays
    // open — guarantee it appears within 600ms (whichever fires first wins).
    setTimeout(show, 600);
  }, []);

  // Single eligibility check. Stable identity (reads loading via ref) so the
  // focus effect doesn't churn. Runs the sequence: loading gate → dont-show-again
  // → seen-count → show + increment. On any AsyncStorage failure it DEFAULTS TO
  // SHOWING rather than silently hiding.
  const runEligibility = useCallback(async () => {
    if (evaluatedRef.current) return; // already decided this focus
    console.log(`[Events] Running eligibility check for modal: ${name}`);

    if (loadingRef.current) {
      // Not ready yet — the isLoadingUserStatus watcher below will re-run us.
      console.log(`[Events] Skipping modal ${name} because: isLoadingUserStatus still true, waiting`);
      return;
    }

    // Sequencing gate: wait until enabled (e.g. a prior modal has resolved).
    // The `enabled` watcher below re-runs this once it flips true.
    if (!enabledRef.current) {
      console.log(`[Events] Skipping modal ${name} because: sequencing gate not open yet, waiting`);
      return;
    }

    evaluatedRef.current = true; // a definitive decision is being made now

    // User-type gate (Modal 2 only): premium users never see the upsell.
    if (requireFreeUser && !isFreeUserRef.current) {
      console.log(`[Events] Skipping modal ${name} because: premium user + requireFreeUser`);
      resolve();
      return;
    }

    try {
      // Suppressor 1: "Don't show again" flag.
      if (dontShowAgainKey) {
        const suppressed = await AsyncStorage.getItem(dontShowAgainKey);
        console.log(`[Events] AsyncStorage read: ${dontShowAgainKey} = ${suppressed}`);
        if (suppressed === 'true') {
          console.log(`[Events] Skipping modal ${name} because: dont_show_again flag is set`);
          resolve();
          return;
        }
      }

      // Suppressor 2: seen-count cap — ONLY when storageKey is provided.
      if (storageKey) {
        const raw = await AsyncStorage.getItem(storageKey);
        console.log(`[Events] AsyncStorage read: ${storageKey} = ${raw}`);
        const count = raw ? parseInt(raw, 10) || 0 : 0;
        if (count >= maxShows) {
          console.log(`[Events] Skipping modal ${name} because: seen_count is ${count} (>= ${maxShows})`);
          resolve();
          return;
        }
        console.log(`[Events] Setting modal visible: ${name}`);
        showModalSafely();
        await AsyncStorage.setItem(storageKey, String(count + 1));
        return; // resolve fires on dismiss
      }

      // No seen-count: show every focus until "Don't show again" is set.
      console.log(`[Events] Setting modal visible: ${name}`);
      showModalSafely(); // resolve fires on dismiss
    } catch {
      console.log(`[Events] AsyncStorage read failed for ${name}, defaulting to show`);
      showModalSafely(); // resolve fires on dismiss
    }
  }, [storageKey, maxShows, dontShowAgainKey, requireFreeUser, resolve, showModalSafely, name]);

  // Run the eligibility check every time the screen comes into FOCUS (not just
  // mount) — critical for tab navigators where screens are not remounted.
  useFocusEffect(
    useCallback(() => {
      console.log(`[Events] Focus effect fired for modal: ${name}`);
      focusedRef.current = true;
      evaluatedRef.current = false; // fresh decision for this visit
      resolvedRef.current = false; // fresh resolution for this visit
      // For sequenced modals, force the gate CLOSED at focus so a stale `enabled`
      // from a prior visit cannot fire it before the prior modal resolves.
      if (sequenced) enabledRef.current = false;
      runEligibility();
      return () => {
        focusedRef.current = false;
      };
    }, [runEligibility, sequenced, name]),
  );

  // Loading-gate retry: re-run once the plan resolves (while still focused).
  useEffect(() => {
    if (!isLoadingUserStatus && focusedRef.current && !evaluatedRef.current) {
      runEligibility();
    }
  }, [isLoadingUserStatus, runEligibility]);

  // Sequencing retry: re-run once the gate opens (e.g. a prior modal resolved).
  useEffect(() => {
    if (enabled && focusedRef.current && !evaluatedRef.current) {
      runEligibility();
    }
  }, [enabled, runEligibility]);

  const dismiss = () => {
    // Persist the suppression flag if the user opted out before dismissing.
    if (dontShowAgainKey && dontShow) {
      AsyncStorage.setItem(dontShowAgainKey, 'true').catch(() => {});
    }
    setHowVisible(false);
    setVisible(false);
    // Release any follow-up (sequenced) modal only AFTER this one has finished
    // dismissing. Firing resolve() synchronously made the next modal present while
    // this one was still animating out — two overlapping native modal transitions,
    // which on iOS crashes ("present while a presentation is in progress") or drops
    // the second modal on a real device. The delay covers the fade-out animation.
    setTimeout(() => resolve(), 350);
  };

  const handleUnlockPremium = () => {
    dismiss();
    setTimeout(() => {
      try {
        navigation.navigate('UnlockPremium');
      } catch {
        console.warn('[EntryInfoModal] Could not navigate to UnlockPremium');
      }
    }, 150);
  };

  console.log(`[Events Modal] Rendered (${name}), visible:`, visible);
  if (!visible) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Android back: close the in-place "how" overlay first if it's open,
        // otherwise dismiss the whole modal.
        if (howVisible) {
          setHowVisible(false);
          return;
        }
        dismiss();
      }}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              {/* ✕ close (top-right) */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={dismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color={COLORS.gray} />
              </TouchableOpacity>

              {/* Hero icon */}
              <MaterialCommunityIcons
                name={icon as any}
                size={72}
                color={COLORS.primary}
                style={styles.heroIcon}
              />

              {/* Heading */}
              <Text style={styles.headline}>{heading}</Text>

              {/* Plan-specific body */}
              {isFreeUser ? (
                <Text style={styles.body}>
                  {freeTextBefore}
                  {freeLinkText ? (
                    <Text style={styles.link} onPress={handleUnlockPremium}>
                      {freeLinkText}
                    </Text>
                  ) : null}
                  {freeTextAfter ?? ''}
                </Text>
              ) : (
                <Text style={styles.body}>{premiumText}</Text>
              )}

              {/* Upsell buttons (Modal 2): Unlock Premium + Maybe Later */}
              {showUpsellButtons && isFreeUser && (
                <>
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
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={dismiss}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Decorative feature-preview icons */}
              {featureIcons && featureIcons.length > 0 && (
                <View style={styles.featureRow}>
                  {featureIcons.map((f) => (
                    <View key={f.label} style={styles.featureItem}>
                      <MaterialCommunityIcons
                        name={f.icon as any}
                        size={26}
                        color={COLORS.primary}
                      />
                      <Text style={styles.featureLabel}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* "Don't show again" checkbox (centred, above the bottom edge) */}
              {dontShowAgainKey && (
                <TouchableOpacity
                  style={styles.dontShowRow}
                  onPress={() => setDontShow((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: dontShow }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <View style={[styles.checkbox, dontShow && styles.checkboxChecked]}>
                    {dontShow && (
                      <MaterialIcons name="check" size={14} color={COLORS.white} />
                    )}
                  </View>
                  <Text style={styles.dontShowLabel}>Don't show again</Text>
                </TouchableOpacity>
              )}

              {/* "How does this work?" (bottom-right) */}
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

      {/* "How does this work?" overlay — rendered IN-PLACE inside this same Modal,
          NOT as a nested RN Modal. Nesting two native modal presentations is an
          iOS crash hazard (same class as the entry-handoff race); an absolute-fill
          overlay gives the identical look without a second native modal. Closing it
          returns to the main modal content. */}
      {howVisible && (
        <TouchableWithoutFeedback onPress={() => setHowVisible(false)}>
          <View style={[styles.overlay, StyleSheet.absoluteFillObject]}>
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
                <Text style={styles.body}>{howItWorksText}</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    paddingBottom: 44,
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
    marginBottom: 8,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
    textAlign: 'center',
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
  // "Don't show again" checkbox — centred, sits above the bottom-right ⓘ link.
  dontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dontShowLabel: {
    fontSize: 12,
    color: COLORS.gray,
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
    marginTop: 8,
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
