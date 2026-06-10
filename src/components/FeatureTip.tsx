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
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
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
}

export default function FeatureTip({
  tipKey,
  content,
  position = 'bottom',
  children,
  style,
  inScrollView = false,
  bubbleAlign,
}: FeatureTipProps) {
  const { tooltipsEnabled, dismissedTips, registerBubble, unregisterBubble, scrollNonce, scrollYRef } = useTooltipContext();
  const isFocused = useIsFocused();

  // Only show on the focused screen, when enabled and not dismissed.
  const isVisible = isFocused && tooltipsEnabled && !dismissedTips[tipKey];

  const wrapperRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  // Scroll offset captured synchronously just before the async measureInWindow
  // call so the Animated transform in BubbleView starts from the correct base.
  const scrollYAtMeasureRef = useRef(0);

  // Direct measure (no rAF) so layout stays locked to the anchor.
  // Only updates state when the rect actually changed, so static tips don't
  // re-render every scroll frame.
  const measure = useCallback(() => {
    // Capture scroll position before the async bridge call.
    if (inScrollView) {
      scrollYAtMeasureRef.current = scrollYRef.current;
    }
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      if (!(width || height)) return;
      setAnchor((prev) =>
        prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height
          ? prev
          : { x, y, width, height },
      );
    });
  }, [inScrollView, scrollYRef]);

  const onLayout = (_e: LayoutChangeEvent) => measure();

  // Re-measure on focus (layout may have shifted).
  // scrollNonce is no longer bumped during scroll (notifyScroll was changed to
  // update an Animated.Value instead), so this effect never fires during
  // scrolling — position is tracked smoothly via the Animated transform.
  useEffect(() => {
    if (isFocused) measure();
  }, [isFocused, scrollNonce, measure]);

  // Publish/withdraw this tip's bubble to the global overlay.
  useEffect(() => {
    if (isVisible && anchor) {
      registerBubble(tipKey, {
        content,
        position,
        anchor,
        scrollYAtMeasure: inScrollView ? scrollYAtMeasureRef.current : undefined,
        bubbleAlign,
      });
    } else {
      unregisterBubble(tipKey);
    }
    return () => unregisterBubble(tipKey);
  }, [isVisible, anchor, content, position, tipKey, inScrollView, bubbleAlign, registerBubble, unregisterBubble]);

  return (
    <View ref={wrapperRef} style={[styles.wrapper, style]} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
});
