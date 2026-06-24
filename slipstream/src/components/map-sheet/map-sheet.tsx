/**
 * MapSheet — Apple Maps-style bottom sheet with swipeable tab pages.
 *
 * Supports three snap points: collapsed (peek), half, and full.
 * Contains horizontally swipeable pages (Discover, Social, Convoy, Profile, Settings).
 * Uses react-native-reanimated + gesture-handler for butter-smooth 60fps animations.
 */
import { useCallback, useMemo, useRef } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetTabBar } from "./sheet-tab-bar";
import { SheetPages } from "./sheet-pages";

// --- Snap Point Configuration ---
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/** Distance from top of screen for each snap position */
const SNAP_POINTS = {
  collapsed: SCREEN_HEIGHT - 100, // Just the handle + peek content
  half: SCREEN_HEIGHT * 0.55, // ~45% of screen visible
  full: 60, // Near top, below status bar
} as const;

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 300,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// Velocity threshold for flick gestures (pixels/second)
const FLICK_VELOCITY = 500;

export type SheetSnapPoint = "collapsed" | "half" | "full";
export type SheetPage = "discover" | "social" | "convoy" | "profile" | "settings";

interface MapSheetProps {
  /** Called when snap point changes */
  onSnapChange?: (snap: SheetSnapPoint) => void;
  /** Initial snap point */
  initialSnap?: SheetSnapPoint;
}

export function MapSheet({ onSnapChange, initialSnap = "half" }: MapSheetProps) {
  const insets = useSafeAreaInsets();

  // Animated Y position (distance from top)
  const translateY = useSharedValue(SNAP_POINTS[initialSnap]);
  const contextY = useSharedValue(0);

  // Current page index for horizontal swipe
  const currentPage = useSharedValue(0);

  const snapTo = useCallback(
    (point: SheetSnapPoint) => {
      "worklet";
      translateY.value = withSpring(SNAP_POINTS[point], SPRING_CONFIG);
      if (onSnapChange) {
        runOnJS(onSnapChange)(point);
      }
    },
    [translateY, onSnapChange],
  );

  // Find nearest snap point
  const findNearestSnap = useCallback(
    (y: number, velocity: number): SheetSnapPoint => {
      "worklet";
      const points = [
        { key: "full" as const, y: SNAP_POINTS.full },
        { key: "half" as const, y: SNAP_POINTS.half },
        { key: "collapsed" as const, y: SNAP_POINTS.collapsed },
      ];

      // Flick up → go to next higher snap
      if (velocity < -FLICK_VELOCITY) {
        if (y < SNAP_POINTS.half) return "full";
        return "half";
      }

      // Flick down → go to next lower snap
      if (velocity > FLICK_VELOCITY) {
        if (y > SNAP_POINTS.half) return "collapsed";
        return "half";
      }

      // Otherwise snap to nearest
      let nearest = points[0];
      let minDist = Math.abs(y - points[0].y);
      for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(y - points[i].y);
        if (dist < minDist) {
          minDist = dist;
          nearest = points[i];
        }
      }
      return nearest.key;
    },
    [],
  );

  // Vertical pan gesture (drag sheet up/down)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newY = contextY.value + event.translationY;
      // Clamp with rubber-band effect at edges
      if (newY < SNAP_POINTS.full) {
        const overshoot = SNAP_POINTS.full - newY;
        translateY.value = SNAP_POINTS.full - overshoot * 0.3;
      } else if (newY > SNAP_POINTS.collapsed) {
        const overshoot = newY - SNAP_POINTS.collapsed;
        translateY.value = SNAP_POINTS.collapsed + overshoot * 0.3;
      } else {
        translateY.value = newY;
      }
    })
    .onEnd((event) => {
      const snap = findNearestSnap(translateY.value, event.velocityY);
      snapTo(snap);
    })
    .activeOffsetY([-10, 10]);

  // Animated styles
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Border radius shrinks as sheet approaches full height
  const containerStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      translateY.value,
      [SNAP_POINTS.full, SNAP_POINTS.full + 100],
      [0, 20],
      Extrapolation.CLAMP,
    );
    return {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
    };
  });

  // Handle bar opacity dims when fully expanded
  const handleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [SNAP_POINTS.full, SNAP_POINTS.full + 80],
      [0.3, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Content opacity fades when collapsed
  const contentOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [SNAP_POINTS.half, SNAP_POINTS.collapsed],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <Animated.View style={[styles.sheet, sheetStyle]}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Drag Handle */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleArea}>
            <Animated.View style={[styles.handle, handleStyle]} />
          </Animated.View>
        </GestureDetector>

        {/* Tab Bar */}
        <Animated.View style={contentOpacity}>
          <SheetTabBar currentPage={currentPage} />
        </Animated.View>

        {/* Swipeable Pages */}
        <Animated.View style={[styles.pagesContainer, contentOpacity]}>
          <SheetPages currentPage={currentPage} sheetTranslateY={translateY} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT,
    zIndex: 100,
  },
  container: {
    flex: 1,
    backgroundColor: Platform.select({
      ios: "rgba(28, 28, 30, 0.85)",
      default: "rgba(28, 28, 30, 0.95)",
    }),
    overflow: "hidden",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  handleArea: {
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  pagesContainer: {
    flex: 1,
  },
});
