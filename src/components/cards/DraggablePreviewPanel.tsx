/**
 * DraggablePreviewPanel
 *
 * A draggable bottom-sheet preview panel with three snap positions, shared by the
 * Add Card and Edit Card screens. Built on the already-installed
 * react-native-gesture-handler (PanGestureHandler) + the core Animated API
 * (Animated.spring, native-driver translateY) — no reanimated.
 *
 * Snap positions (expressed as translateY of the panel within the area below the
 * nav header):
 *   full   → 0            (covers the template selector, full preview)
 *   docked → dockedTop    (top edge sits flush below the template selector)
 *   hidden → availableH   (panel is fully off the bottom of the screen)
 *
 * The parent controls open/close imperatively via the ref (`snapTo`), e.g. it
 * calls snapTo('docked') when a template is tapped. Drag gestures on the handle/
 * header snap between positions with a springy feel.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { COLORS } from '../../constants/colors';

export type SnapPosition = 'hidden' | 'docked' | 'full';

export interface DraggablePreviewPanelRef {
  snapTo: (pos: SnapPosition) => void;
  getSnap: () => SnapPosition;
}

interface DraggablePreviewPanelProps {
  /** translateY for the DOCKED position = height of the template selector above the panel. */
  dockedTop: number;
  /** Total draggable area height (below the nav header). HIDDEN equals this. */
  availableHeight: number;
  /** Preview content (the rendered card). */
  children: React.ReactNode;
  /** Fired whenever the resting snap position changes. */
  onSnapChange?: (pos: SnapPosition) => void;
}

// App-standard spring (matches Animated.spring usage elsewhere): natural + slightly bouncy.
const SPRING = { tension: 90, friction: 9, useNativeDriver: true } as const;

const DraggablePreviewPanel = forwardRef<DraggablePreviewPanelRef, DraggablePreviewPanelProps>(
  ({ dockedTop, availableHeight, children, onSnapChange }, ref) => {
    const FULL = 0;
    const DOCKED = Math.max(0, dockedTop);
    const HIDDEN = Math.max(DOCKED + 1, availableHeight);

    const translateY = useRef(new Animated.Value(HIDDEN)).current;
    const latest = useRef(HIDDEN); // live value of translateY (for gesture base + snap math)
    const currentSnap = useRef<SnapPosition>('hidden');

    const valueFor = (pos: SnapPosition) => (pos === 'full' ? FULL : pos === 'docked' ? DOCKED : HIDDEN);

    const animateTo = (pos: SnapPosition) => {
      currentSnap.current = pos;
      Animated.spring(translateY, { toValue: valueFor(pos), ...SPRING }).start();
      onSnapChange?.(pos);
    };

    useImperativeHandle(ref, () => ({
      snapTo: animateTo,
      getSnap: () => currentSnap.current,
    }));

    // Keep `latest` in sync with the animated value.
    useEffect(() => {
      const id = translateY.addListener(({ value }) => {
        latest.current = value;
      });
      return () => translateY.removeListener(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-clamp / re-snap if the layout sizes change while open.
    useEffect(() => {
      if (currentSnap.current !== 'hidden') {
        translateY.setValue(valueFor(currentSnap.current));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [DOCKED, HIDDEN]);

    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationY: translateY } }],
      { useNativeDriver: true },
    ) as (e: PanGestureHandlerGestureEvent) => void;

    const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, translationY, velocityY } = e.nativeEvent;

      if (state === State.BEGAN || (state === State.ACTIVE && oldState === State.BEGAN)) {
        // Start dragging from the current resting value.
        translateY.setOffset(latest.current);
        translateY.setValue(0);
        return;
      }

      if (oldState === State.ACTIVE) {
        translateY.flattenOffset();

        // Project where the drag is heading, factoring in fling velocity.
        const projected = latest.current + velocityY * 0.08;

        const midFullDocked = (FULL + DOCKED) / 2;
        const midDockedHidden = (DOCKED + HIDDEN) / 2;

        let target: SnapPosition;
        if (projected < midFullDocked) {
          target = 'full';
        } else if (projected < midDockedHidden) {
          target = 'docked';
        } else {
          target = 'hidden';
        }
        animateTo(target);
      }
    };

    return (
      <GestureHandlerRootView style={styles.root} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.panel,
            { height: availableHeight, transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle + header bar — the whole bar is the drag target. */}
          <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
            <Animated.View style={styles.grabber}>
              <View style={styles.handle} />
            </Animated.View>
          </PanGestureHandler>

          <View style={styles.content}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    );
  },
);

DraggablePreviewPanel.displayName = 'DraggablePreviewPanel';

export default DraggablePreviewPanel;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  grabber: {
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7CCD6',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
