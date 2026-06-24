/**
 * SheetPages — horizontally swipeable page container within the sheet.
 *
 * Uses a horizontal pan gesture to swipe between pages. Each page is a full-width
 * view that can contain its own scrollable content. The swipe syncs with the
 * tab bar's currentPage shared value for seamless animation.
 */
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { DiscoverPage } from "./pages/discover-page";
import { SocialPage } from "./pages/social-page";
import { ConvoyPage } from "./pages/convoy-page";
import { ProfilePage } from "./pages/profile-page";
import { SettingsPage } from "./pages/settings-page";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_COUNT = 5;

const SPRING_CONFIG = {
  damping: 24,
  stiffness: 280,
  mass: 0.7,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// Minimum swipe distance to trigger page change
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;
const VELOCITY_THRESHOLD = 400;

interface SheetPagesProps {
  currentPage: SharedValue<number>;
  sheetTranslateY: SharedValue<number>;
}

export function SheetPages({ currentPage, sheetTranslateY }: SheetPagesProps) {
  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = currentPage.value;
    })
    .onUpdate((event) => {
      const delta = -event.translationX / SCREEN_WIDTH;
      const newPage = startX.value + delta;

      // Rubber-band at edges
      if (newPage < 0) {
        currentPage.value = newPage * 0.3;
      } else if (newPage > PAGE_COUNT - 1) {
        const overshoot = newPage - (PAGE_COUNT - 1);
        currentPage.value = PAGE_COUNT - 1 + overshoot * 0.3;
      } else {
        currentPage.value = newPage;
      }
    })
    .onEnd((event) => {
      const velocity = -event.velocityX / SCREEN_WIDTH;
      let targetPage = Math.round(currentPage.value);

      // Factor in velocity for flick gestures
      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        if (event.velocityX < 0) {
          targetPage = Math.ceil(currentPage.value);
        } else {
          targetPage = Math.floor(currentPage.value);
        }
      }

      // Clamp
      targetPage = Math.max(0, Math.min(PAGE_COUNT - 1, targetPage));
      currentPage.value = withSpring(targetPage, SPRING_CONFIG);
    });

  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -currentPage.value * SCREEN_WIDTH }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <Animated.View style={[styles.pagesRow, pagesStyle]}>
          <View style={styles.page}>
            <DiscoverPage />
          </View>
          <View style={styles.page}>
            <SocialPage />
          </View>
          <View style={styles.page}>
            <ConvoyPage />
          </View>
          <View style={styles.page}>
            <ProfilePage />
          </View>
          <View style={styles.page}>
            <SettingsPage />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  pagesRow: {
    flexDirection: "row",
    width: SCREEN_WIDTH * PAGE_COUNT,
    height: "100%",
  },
  page: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
});
