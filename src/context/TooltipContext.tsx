/**
 * TooltipContext (+ TooltipOverlay)
 *
 * Single source of truth for the FeatureTip onboarding system AND the renderer.
 *
 * Bubbles are NOT drawn inside each anchor (that gets clipped by parents and
 * painted over by sibling cards). Instead every visible FeatureTip registers its
 * measured screen-rect + content here, and ONE top-level overlay draws all the
 * bubbles above everything, with on-screen clamping and collision avoidance so
 * they never overlap each other or get covered.
 *
 *  - tooltipsEnabled / dismissedTips — global state, dismissed loaded once (multiGet)
 *  - dismissTip(key)                 — persist + update map immediately
 *  - registerBubble / unregisterBubble — FeatureTip publishes its anchor rect here
 *
 * Independent of the entry-modal system.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'tooltips_enabled';
export const TIP_DISMISSED_PREFIX = 'tip_dismissed_';

export type TipPosition = 'top' | 'bottom' | 'left' | 'right';
export interface AnchorRect { x: number; y: number; width: number; height: number; }
interface BubbleSpec {
  content: string;
  position: TipPosition;
  anchor: AnchorRect;
  /** Scroll offset captured at measure time — present only for tips inside a ScrollView. */
  scrollYAtMeasure?: number;
  /**
   * Horizontal alignment for top/bottom bubbles (default 'center').
   * 'left'  → bubble left edge aligns with anchor left edge; arrow at ~¼ from left.
   * 'right' → bubble right edge aligns with anchor right edge; arrow at ~¼ from right.
   */
  bubbleAlign?: 'center' | 'left' | 'right';
  /**
   * Force the arrow to point at the horizontal centre of the anchor (derived from
   * its measured rect) regardless of `bubbleAlign`.
   */
  arrowAtAnchor?: boolean;
  /**
   * Keep the bubble on the requested top/bottom side even when there isn't quite
   * enough room — i.e. never auto-flip bottom→top (or top→bottom). Used when a tip
   * MUST sit below its anchor (e.g. the speaker-card info tip, whose flipped-up
   * bubble fell off the top of the screen on long forms).
   */
  disableFlip?: boolean;
}

type DismissedMap = Record<string, boolean>;

interface TooltipContextType {
  tooltipsEnabled: boolean;
  setTooltipsEnabled: (enabled: boolean) => void;
  resetTips: () => Promise<void>;
  dismissedTips: DismissedMap;
  dismissTip: (tipKey: string) => void;
  tipResetToken: number;
  registerBubble: (tipKey: string, spec: BubbleSpec) => void;
  unregisterBubble: (tipKey: string) => void;
  /** Bumped on focus changes so FeatureTip re-measures when a screen regains focus. */
  scrollNonce: number;
  /** Pass the scroll contentOffset.y here; updates the Animated.Value without setState. */
  notifyScroll: (y: number) => void;
  /** Plain ref that always holds the latest scroll Y — readable synchronously during measureInWindow. */
  scrollYRef: React.MutableRefObject<number>;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

const GAP = 10;
const ARROW = 10;
const MARGIN = 16;

export const TooltipProvider = ({ children }: { children: ReactNode }) => {
  const [tooltipsEnabled, setEnabled] = useState(true);
  const [dismissedTips, setDismissedTips] = useState<DismissedMap>({});
  const [tipResetToken, setTipResetToken] = useState(0);
  const [bubbles, setBubbles] = useState<Record<string, BubbleSpec>>({});
  const [scrollNonce, setScrollNonce] = useState(0);
  // Animated.Value driven directly from the ScrollView's contentOffset — no setState,
  // no re-renders. BubbleView subscribes to it via Animated.subtract for smooth tracking.
  const scrollAnimValue = useRef(new Animated.Value(0)).current;
  // Plain ref so FeatureTip can read the current Y synchronously at measure time.
  const scrollYRef = useRef(0);
  const notifyScroll = useCallback((y: number) => {
    scrollYRef.current = y;
    scrollAnimValue.setValue(y);
    // Deliberately NOT bumping scrollNonce — position is now driven by the
    // Animated value, so React re-renders during scroll are not needed.
  }, [scrollAnimValue]);

  const loadDismissedTips = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const tipKeys = allKeys.filter((k) => k.startsWith(TIP_DISMISSED_PREFIX));
      if (tipKeys.length === 0) { setDismissedTips({}); return; }
      const pairs = await AsyncStorage.multiGet(tipKeys);
      const map: DismissedMap = {};
      pairs.forEach(([key, value]) => {
        map[key.replace(TIP_DISMISSED_PREFIX, '')] = value === 'true';
      });
      setDismissedTips(map);
    } catch {
      setDismissedTips({});
    }
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ENABLED_KEY)
      .then((v) => { if (active && v !== null) setEnabled(v === 'true'); })
      .catch(() => {});
    loadDismissedTips();
    return () => { active = false; };
  }, [loadDismissedTips]);

  const dismissTip = useCallback((tipKey: string) => {
    setDismissedTips((prev) => ({ ...prev, [tipKey]: true }));
    AsyncStorage.setItem(`${TIP_DISMISSED_PREFIX}${tipKey}`, 'true').catch(() => {});
  }, []);

  const clearDismissed = useCallback(async () => {
    setDismissedTips({});
    setTipResetToken((v) => v + 1);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = keys.filter((k) => k.startsWith(TIP_DISMISSED_PREFIX));
      if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    } catch {}
  }, []);

  const setTooltipsEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false').catch(() => {});
    if (enabled) clearDismissed();
  }, [clearDismissed]);

  const resetTips = useCallback(async () => { await clearDismissed(); }, [clearDismissed]);

  const registerBubble = useCallback((tipKey: string, spec: BubbleSpec) => {
    setBubbles((prev) => ({ ...prev, [tipKey]: spec }));
  }, []);
  const unregisterBubble = useCallback((tipKey: string) => {
    setBubbles((prev) => {
      if (!(tipKey in prev)) return prev;
      const next = { ...prev }; delete next[tipKey]; return next;
    });
  }, []);

  // Only draw bubbles that are still eligible (enabled + not dismissed).
  const visibleBubbles = tooltipsEnabled
    ? Object.entries(bubbles).filter(([key]) => !dismissedTips[key])
    : [];

  return (
    <TooltipContext.Provider
      value={{
        tooltipsEnabled, setTooltipsEnabled, resetTips,
        dismissedTips, dismissTip, tipResetToken,
        registerBubble, unregisterBubble,
        scrollNonce, notifyScroll, scrollYRef,
      }}
    >
      {children}
      <TooltipOverlay bubbles={visibleBubbles} onDismiss={dismissTip} scrollAnimValue={scrollAnimValue} />
    </TooltipContext.Provider>
  );
};

/* ── Overlay renderer ─────────────────────────────────────────────────────── */

// Type shared between TooltipOverlay and BubbleView.
type Placed = {
  key: string;
  spec: BubbleSpec;
  top: number;
  left: number;
  w: number;
  h: number;
  pos: TipPosition;
  moved: boolean;
  hidden: boolean;
};

/**
 * Renders a single tooltip bubble.
 *
 * Static bubbles (header buttons, etc.): plain opacity flag, no transforms.
 *
 * In-scroll bubbles (`spec.scrollYAtMeasure` is set):
 *  - `translateY` is a stable Animated.subtract node.  scrollAnimValue.setValue(y)
 *    propagates directly to the native layer — zero React re-renders, zero async
 *    bridge round-trips.
 *  - `opacity` is an Animated.interpolate derived from the same value, so the
 *    bubble fades in when the anchor scrolls into the visible band and fades out
 *    when it leaves — even when the anchor starts below the viewport (static
 *    `hidden` flag would permanently hide it).
 */
function BubbleView({
  b,
  maxW,
  scrollAnimValue,
  onDismiss,
  onSizeChange,
}: {
  b: Placed;
  maxW: number;
  scrollAnimValue: Animated.Value;
  onDismiss: (key: string) => void;
  onSizeChange: (key: string, w: number, h: number) => void;
}) {
  const measured = b.w !== 0;
  // For static (non-scroll) bubbles this is the only visibility gate.
  const shown = measured && !b.hidden;

  const scrollYAtMeasure = b.spec.scrollYAtMeasure;
  const isScrollBubble = scrollYAtMeasure !== undefined;

  // ── Arrow ──────────────────────────────────────────────────────────────────
  // For in-scroll bubbles we show the arrow whenever measured (the Animated
  // opacity handles actual visibility); for static bubbles keep the old gate.
  const canShowArrow = isScrollBubble ? (measured && !b.moved) : (shown && !b.moved);
  let arrowStyle: any = null;
  if (canShowArrow) {
    const a = b.spec.anchor;
    if (b.pos === 'top' || b.pos === 'bottom') {
      let al: number;
      const align = b.spec.bubbleAlign ?? 'center';
      if (b.spec.arrowAtAnchor) {
        // Pin the arrow to the anchor's horizontal centre regardless of how the
        // bubble itself is aligned (used when the bubble is offset from the anchor
        // but the arrow must still point precisely at it).
        al = a.x + a.width / 2 - b.left - ARROW / 2;
      } else if (align === 'left') {
        // Arrow at ~¼ from the left edge of the bubble.
        al = Math.round(b.w * 0.25);
      } else if (align === 'right') {
        // Arrow at ~¼ from the right edge (= ~¾ from left).
        al = Math.round(b.w * 0.75) - ARROW;
      } else {
        al = a.x + a.width / 2 - b.left - ARROW / 2;
      }
      al = Math.max(8, Math.min(al, b.w - 8 - ARROW));
      arrowStyle = b.pos === 'bottom' ? { top: -ARROW / 2, left: al } : { bottom: -ARROW / 2, left: al };
    } else {
      const at = Math.max(8, Math.min(a.y + a.height / 2 - b.top - ARROW / 2, b.h - 8 - ARROW));
      arrowStyle = b.pos === 'right' ? { left: -ARROW / 2, top: at } : { right: -ARROW / 2, top: at };
    }
  }

  // ── Animated nodes (in-scroll bubbles only) ────────────────────────────────
  // Both are stable: useMemo re-runs only when scrollYAtMeasure changes (i.e.
  // on a re-measurement triggered by focus, not during active scrolling).

  // translateY = scrollYAtMeasure − currentScrollY
  // Scrolling down 50 px → translateY = −50 → bubble moves up 50 px. ✓
  const translateY = useMemo(() => {
    if (!isScrollBubble) return null;
    return Animated.subtract(new Animated.Value(scrollYAtMeasure!), scrollAnimValue);
  }, [isScrollBubble, scrollYAtMeasure, scrollAnimValue]);

  // Animated opacity derived from the anchor's live screen Y:
  //   anchorScreenY = anchorDocY − scrollAnimValue
  //   anchorDocY    = anchor.y (screen Y at measure time) + scrollYAtMeasure
  //
  // Visible when minY < anchorScreenY < maxY, i.e.:
  //   anchorDocY − maxY < scrollAnimValue < anchorDocY − minY
  //
  // This correctly handles the common case where the anchor starts below the
  // viewport (anchorDocY > maxY) — the static `hidden` flag would permanently
  // suppress those bubbles, but this interpolation lets them appear as the
  // user scrolls down to reveal them.
  const animatedOpacity = useMemo(() => {
    if (!isScrollBubble || !measured) return null;
    const screen = Dimensions.get('window');
    const minY = 10;
    const maxY = screen.height - 96;
    const anchorDocY = b.spec.anchor.y + scrollYAtMeasure!;
    const FADE = 20;
    const lo = anchorDocY - maxY; // scrollY at which anchor enters view from bottom
    const hi = anchorDocY - minY; // scrollY at which anchor exits view at top
    return scrollAnimValue.interpolate({
      inputRange:  [lo - FADE, lo, hi, hi + FADE],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
  }, [isScrollBubble, measured, b.spec.anchor.y, scrollYAtMeasure, scrollAnimValue]);

  const opacityProp = animatedOpacity !== null
    ? animatedOpacity
    : shown ? 1 : 0;

  const transform = translateY !== null ? [{ translateY }] : undefined;

  // For in-scroll bubbles the translateY shifts the bubble off-screen when not
  // visible, so we can leave pointerEvents open ('box-none') to allow the ✕
  // close button to receive touches when the bubble is actually on screen.
  const ptrEvents: 'box-none' | 'none' = isScrollBubble
    ? (measured ? 'box-none' : 'none')
    : (shown ? 'box-none' : 'none');

  return (
    <Animated.View
      style={[
        styles.bubble,
        { maxWidth: maxW, top: b.top, left: b.left, opacity: opacityProp },
        transform ? { transform } : null,
      ]}
      pointerEvents={ptrEvents}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        onSizeChange(b.key, width, height);
      }}
    >
      {arrowStyle && <View style={[styles.arrow, arrowStyle]} pointerEvents="none" />}
      <Text style={styles.text} numberOfLines={0}>{b.spec.content}</Text>
      <TouchableOpacity
        style={styles.close}
        onPress={() => onDismiss(b.key)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="close" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

function TooltipOverlay({
  bubbles,
  onDismiss,
  scrollAnimValue,
}: {
  bubbles: [string, BubbleSpec][];
  onDismiss: (key: string) => void;
  scrollAnimValue: Animated.Value;
}) {
  // Measured bubble sizes keyed by tipKey (for centring + collision).
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});

  const handleSizeChange = useCallback((key: string, w: number, h: number) => {
    setSizes((prev) => {
      const cur = prev[key];
      if (cur && cur.w === w && cur.h === h) return prev;
      return { ...prev, [key]: { w, h } };
    });
  }, []);

  if (bubbles.length === 0) return null;

  const screen = Dimensions.get('window');
  const maxW = screen.width - 48; // room to expand before wrapping

  // Safe vertical band: above the bottom tab bar / home indicator.
  // Keep at 10 (not 96) so header-button anchors (y ≈ 55–85 on iOS/Android)
  // are not incorrectly marked hidden. The custom Header is absolutely
  // positioned in the same render tree, so measureInWindow returns real coords.
  const HEADER_INSET = 10;
  const BOTTOM_INSET = 96;
  const minY = HEADER_INSET;
  const maxY = screen.height - BOTTOM_INSET;

  // Compute each bubble's desired static rect (needs its measured size).
  // For in-scroll bubbles the static position is computed from the anchor at
  // measure time; the Animated transform in BubbleView then keeps it locked to
  // the content as the user scrolls — no re-computation needed during scroll.
  const computed: Placed[] = [];

  for (const [key, spec] of bubbles) {
    const a = spec.anchor;
    // Anchor must be within the visible scroll band to show the tip.
    const hidden = a.y < minY || a.y > maxY;
    const s = sizes[key];
    if (!s) {
      computed.push({ key, spec, top: -9999, left: -9999, w: 0, h: 0, pos: spec.position, moved: false, hidden });
      continue;
    }
    let pos = spec.position;
    // Flip top/bottom away from the header / tab bar so the bubble never sits
    // behind them.  Left/right are NOT flipped — the coordinate clamping below
    // keeps them on-screen, which is the right behaviour for full-width anchors
    // (buttons that span the whole screen width).
    // `disableFlip` opts a tip out of this entirely so it always stays on the
    // requested side (the speaker-card tip must always appear below its anchor).
    if (!spec.disableFlip) {
      if (pos === 'bottom' && a.y + a.height + GAP + s.h > maxY) pos = 'top';
      else if (pos === 'top' && a.y - GAP - s.h < minY) pos = 'bottom';
    }

    let top: number, left: number;
    if (pos === 'top' || pos === 'bottom') {
      const align = spec.bubbleAlign ?? 'center';
      if (align === 'left') {
        // Bubble left edge aligns with anchor left edge, clamped to screen margin.
        left = Math.max(MARGIN, a.x);
      } else if (align === 'right') {
        // Bubble right edge aligns with anchor right edge, clamped to screen margin.
        left = Math.min(screen.width - MARGIN - s.w, a.x + a.width - s.w);
      } else {
        left = Math.max(MARGIN, Math.min(a.x + a.width / 2 - s.w / 2, screen.width - s.w - MARGIN));
      }
      top = pos === 'bottom' ? a.y + a.height + GAP : a.y - GAP - s.h;
    } else {
      top = Math.max(minY, Math.min(a.y + a.height / 2 - s.h / 2, maxY - s.h));
      // Clamp to screen edges rather than flipping sides — this correctly handles
      // full-width anchors: 'right' lands near the right edge, 'left' near the left.
      if (pos === 'right') {
        left = Math.min(screen.width - MARGIN - s.w, a.x + a.width + GAP);
      } else {
        left = Math.max(MARGIN, a.x - GAP - s.w);
      }
    }
    computed.push({ key, spec, top, left, w: s.w, h: s.h, pos, moved: false, hidden });
  }

  // Collision avoidance: push overlapping (visible) bubbles downward.
  const accepted: Placed[] = [];
  const overlaps = (a: Placed, b: Placed) =>
    a.left < b.left + b.w && a.left + a.w > b.left && a.top < b.top + b.h && a.top + a.h > b.top;
  for (const b of [...computed].sort((p, q) => p.top - q.top)) {
    if (b.w === 0 || b.hidden) { accepted.push(b); continue; }
    let guard = 0;
    let changed = true;
    while (changed && guard++ < 20) {
      changed = false;
      for (const q of accepted) {
        if (q.w !== 0 && !q.hidden && overlaps(b, q)) {
          b.top = q.top + q.h + 6;
          b.moved = true;
          if (b.top + b.h > maxY - MARGIN) b.top = Math.max(minY, maxY - b.h - MARGIN);
          changed = true;
        }
      }
    }
    accepted.push(b);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {accepted.map((b) => (
        <BubbleView
          key={b.key}
          b={b}
          maxW={maxW}
          scrollAnimValue={scrollAnimValue}
          onDismiss={onDismiss}
          onSizeChange={handleSizeChange}
        />
      ))}
    </View>
  );
}

const BUBBLE_BG = 'rgba(0, 0, 0, 0.65)';
const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    zIndex: 9999,
    minWidth: 140,
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 0, // grow to fit content — no fixed height
    alignItems: 'flex-start',
    backgroundColor: BUBBLE_BG,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 26,
  },
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    backgroundColor: BUBBLE_BG,
    transform: [{ rotate: '45deg' }],
  },
  text: { flex: 1, flexShrink: 1, flexWrap: 'wrap', color: '#FFFFFF', fontSize: 13, lineHeight: 17 },
  close: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
  },
});

export const useTooltipContext = (): TooltipContextType => {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('useTooltipContext must be used within a TooltipProvider');
  return ctx;
};
