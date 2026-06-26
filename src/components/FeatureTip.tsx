/**
 * FeatureTip
 *
 * Wrap any element to point an onboarding tooltip at it. The bubble is rendered
 * by the single top-level TooltipOverlay (so it can't be clipped or covered).
 *
 * CRITICAL: a tip only registers its bubble while ITS OWN screen is focused
 * (`useIsFocused`). Tab/stack screens stay mounted when you navigate away, so
 * without this gate every screen's tips would pile onto whatever screen is
 * currently visible.
 *
 *   <FeatureTip tipKey="home_qr_button" content="Share your card via QR code" position="bottom">
 *     <QRButton />
 *   </FeatureTip>
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, LayoutChangeEvent, Dimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTooltipContext, TipPosition, AnchorRect } from '../context/TooltipContext';

interface FeatureTipProps {
  tipKey: string;
  content: string;
  position?: TipPosition;
  children: React.ReactNode;
  /** Optional style merged onto the wrapper. */
  style?: ViewStyle;
  /**
   * Set to `true` when the wrapped element lives inside a vertical ScrollView
   * whose scroll events are wired to `notifyScroll`.  The bubble position will
   * then be tracked smoothly via an Animated.Value rather than repeated
   * measureInWindow calls, eliminating scroll-stutter.
   */
  inScrollView?: boolean;
  /**
   * Horizontal alignment for top/bottom bubbles (default 'center').
   * 'left'  → bubble left edge aligns with anchor left, arrow at ~¼ from left.
   * 'right' → bubble right edge aligns with anchor right, arrow at ~¼ from right.
   */
  bubbleAlign?: 'center' | 'left' | 'right';
  /**
   * When the value changes, the anchor is re-measured. Use this for tips whose
   * anchor element moves when some external state changes (e.g. the active card
   * template on the Cards screen) — neither onLayout nor scroll fire in that
   * case, so the bubble would otherwise keep its stale position.
   */
  remeasureKey?: string | number;
  /**
   * Force the arrow to point at the horizontal centre of the anchor element
   * (derived from its measured rect) regardless of `bubbleAlign`. Without this,
   * 'left'/'right' aligned bubbles draw the arrow at a fixed fraction of the
   * bubble width rather than at the anchor.
   */
  arrowAtAnchor?: boolean;
  /**
   * Temporarily hold this tip back without unmounting the wrapper (layout stays
   * stable). Used to sequence overlapping tips — e.g. the Add-card tip waits for
   * the Edit-card tip to be dismissed so the two header bubbles never collide.
   */
  suppressed?: boolean;
  /**
   * Never auto-flip this bubble to the opposite side. Use when the tip MUST stay
   * on its requested side — e.g. a `position="bottom"` tip low in a scroll form
   * that would otherwise flip up and run off the top of the screen.
   */
  disableFlip?: boolean;
}

export default function FeatureTip({
  tipKey,
  content,
  position = 'bottom',
  children,
  style,
  inScrollView = false,
  bubbleAlign,
  remeasureKey,
  arrowAtAnchor,
  suppressed = false,
  disableFlip,
}: FeatureTipProps) {
  const { tooltipsEnabled, dismissedTips, registerBubble, unregisterBubble, scrollNonce, scrollYRef } = useTooltipContext();
  const isFocused = useIsFocused();

  // Only show on the focused screen, when enabled, not dismissed, and not
  // temporarily suppressed (e.g. waiting its turn behind another tip).
  const isVisible = isFocused && tooltipsEnabled && !dismissedTips[tipKey] && !suppressed;

  const wrapperRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  // Scroll offset captured synchronously just before the async measureInWindow
  // call so the Animated transform in BubbleView starts from the correct base.
  const scrollYAtMeasureRef = useRef(0);
  // Best (smallest-x) sane reading seen for static tips. The native measure here
  // is noisy and only ever inflates x (never undershoots the true left edge), so
  // the minimum valid reading is the accurate anchor position.
  const bestAnchorRef = useRef<AnchorRect | null>(null);

  // Direct measure (no rAF) so layout stays locked to the anchor.
  // Only updates state when the rect actually changed, so static tips don't
  // re-render every scroll frame.
  const measure = useCallback(() => {
    // Capture scroll position before the async bridge call.
    if (inScrollView) {
      scrollYAtMeasureRef.current = scrollYRef.current;
    }
    // On this RN/New-Architecture setup the native measure intermittently returns
    // bogus page coordinates for header elements (x far beyond the screen width,
    // and inconsistent across passes) while other passes return the correct
    // values. Those bad readings pinned the bubble/arrow to the screen edge.
    // We validate each reading and, when it's bogus, retry on the next frame
    // until a sane value arrives — so the anchor reliably settles on a correct
    // position instead of being dropped or stuck on garbage.
    let attempts = 0;
    const tryMeasure = () => {
      const node = wrapperRef.current;
      if (!node) return;
      node.measure((_x, _y, width, height, pageX, pageY) => {
        const screenW = Dimensions.get('window').width;
        const bogus = !(width || height) || pageX > screenW || pageX < -width;
        if (!bogus) {
          if (inScrollView) {
            // Scroll tips: x is stable, y tracks scroll — take the first sane read.
            setAnchor((prev) =>
              prev && prev.x === pageX && prev.y === pageY && prev.width === width && prev.height === height
                ? prev
                : { x: pageX, y: pageY, width, height },
            );
            return;
          }
          // Static tips (e.g. header icons): keep sampling and lock onto the
          // smallest-x reading, which is the accurate position (noise inflates x).
          const best = bestAnchorRef.current;
          if (!best || pageX < best.x) {
            bestAnchorRef.current = { x: pageX, y: pageY, width, height };
          }
          const a = bestAnchorRef.current!;
          setAnchor((prev) =>
            prev && prev.x === a.x && prev.y === a.y && prev.width === a.width && prev.height === a.height
              ? prev
              : { ...a },
          );
        }
        // Keep sampling across the settling window: bogus reads retry, and static
        // tips keep refining toward the minimum-x (accurate) reading.
        if (attempts++ < 12) setTimeout(tryMeasure, 80);
      });
    };
    tryMeasure();
  }, [inScrollView, scrollYRef]);

  const onLayout = (_e: LayoutChangeEvent) => measure();

  // Re-measure on focus (layout may have shifted).
  // scrollNonce is no longer bumped during scroll (notifyScroll was changed to
  // update an Animated.Value instead), so this effect never fires during
  // scrolling — position is tracked smoothly via the Animated transform.
  // Re-measure when focused, on focus-change nonce, or when remeasureKey changes
  // (e.g. the active template switched and moved this tip's anchor).
  useEffect(() => {
    if (isFocused) measure();
  }, [isFocused, scrollNonce, measure, remeasureKey]);

  // Publish/withdraw this tip's bubble to the global overlay.
  useEffect(() => {
    if (isVisible && anchor) {
      registerBubble(tipKey, {
        content,
        position,
        anchor,
        scrollYAtMeasure: inScrollView ? scrollYAtMeasureRef.current : undefined,
        bubbleAlign,
        arrowAtAnchor,
        disableFlip,
      });
    } else {
      unregisterBubble(tipKey);
    }
    return () => unregisterBubble(tipKey);
  }, [isVisible, anchor, content, position, tipKey, inScrollView, bubbleAlign, arrowAtAnchor, disableFlip, registerBubble, unregisterBubble]);

  return (
    <View ref={wrapperRef} style={[styles.wrapper, style]} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
});
