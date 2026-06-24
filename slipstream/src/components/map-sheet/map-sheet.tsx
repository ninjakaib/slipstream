import { useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import type { DetentChangeEvent } from "@lodev09/react-native-true-sheet";
import { SymbolView } from "expo-symbols";

import { useSheetColors, type SheetColors } from "@/hooks/use-sheet-colors";
import { DiscoverPage } from "@/components/map-sheet/pages/discover-page";
import { SocialPage } from "@/components/map-sheet/pages/social-page";
import { ConvoyPage } from "@/components/map-sheet/pages/convoy-page";
import { ProfilePage } from "@/components/map-sheet/pages/profile-page";
import { SettingsPage } from "@/components/map-sheet/pages/settings-page";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PAGE_COUNT = 5;
const HEADER_HEIGHT = 64;
const CONTENT_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT;

const SPRING_CONFIG = {
  damping: 24,
  stiffness: 280,
  mass: 0.7,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

const VELOCITY_THRESHOLD = 400;

export type SheetPage = "discover" | "social" | "convoy" | "profile" | "settings";

interface Tab {
  key: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: "discover", icon: "magnifyingglass" },
  { key: "social", icon: "person.2" },
  { key: "convoy", icon: "car.2" },
  { key: "profile", icon: "person.crop.circle" },
  { key: "settings", icon: "gearshape" },
];

export function MapSheet() {
  const sheetRef = useRef<TrueSheet>(null);
  const currentPage = useSharedValue(0);
  const colors = useSheetColors();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTabPress = (index: number) => {
    currentPage.value = withSpring(index, SPRING_CONFIG);
    if (!isExpanded) {
      sheetRef.current?.resize(1);
    }
  };

  const handleDetentChange = (event: DetentChangeEvent) => {
    setIsExpanded(event.nativeEvent.index > 0);
  };

  return (
    <TrueSheet
      ref={sheetRef}
      detents={[0.08, 0.5, 1]}
      initialDetentIndex={0}
      dimmed={false}
      grabber={false}
      dismissible={false}
      onDetentChange={handleDetentChange}
      header={
        <View style={styles.tabBarContainer}>
          <View style={styles.tabRow}>
            {TABS.map((tab, index) => (
              <TabItem
                key={tab.key}
                tab={tab}
                index={index}
                currentPage={currentPage}
                colors={colors}
                onPress={handleTabPress}
              />
            ))}
          </View>
        </View>
      }
    >
      <GestureHandlerRootView style={styles.container}>
        <Pages currentPage={currentPage} />
      </GestureHandlerRootView>
    </TrueSheet>
  );
}

function TabItem({
  tab,
  index,
  currentPage,
  colors,
  onPress,
}: {
  tab: Tab;
  index: number;
  currentPage: SharedValue<number>;
  colors: SheetColors;
  onPress: (index: number) => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(currentPage.value - index);
    const opacity = 1 - distance * 0.4;
    const scale = 1 - distance * 0.05;
    return {
      opacity: Math.max(0.35, Math.min(1, opacity)),
      transform: [{ scale: Math.max(0.9, Math.min(1, scale)) }],
    };
  });

  const highlightStyle = useAnimatedStyle(() => {
    const distance = Math.abs(currentPage.value - index);
    return {
      opacity: distance < 0.5 ? 1 - distance * 2 : 0,
    };
  });

  return (
    <Pressable style={styles.tabButton} onPress={() => onPress(index)}>
      <Animated.View style={[styles.tabHighlight, { backgroundColor: colors.tabHighlight }, highlightStyle]} />
      <Animated.View style={animatedStyle}>
        <SymbolView name={tab.icon as any} tintColor={colors.textPrimary} size={22} />
      </Animated.View>
    </Pressable>
  );
}

function Pages({ currentPage }: { currentPage: SharedValue<number> }) {
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
      let targetPage = Math.round(currentPage.value);
      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        targetPage = event.velocityX < 0
          ? Math.ceil(currentPage.value)
          : Math.floor(currentPage.value);
      }
      targetPage = Math.max(0, Math.min(PAGE_COUNT - 1, targetPage));
      currentPage.value = withSpring(targetPage, SPRING_CONFIG);
    });

  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -currentPage.value * SCREEN_WIDTH }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.pagesContainer}>
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
    height: CONTENT_HEIGHT,
  },
  tabBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: 44,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  tabHighlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
  },
  pagesContainer: {
    height: CONTENT_HEIGHT,
    overflow: "hidden",
  },
  pagesRow: {
    flexDirection: "row",
    height: CONTENT_HEIGHT,
    width: SCREEN_WIDTH * PAGE_COUNT,
  },
  page: {
    width: SCREEN_WIDTH,
    height: CONTENT_HEIGHT,
  },
});
