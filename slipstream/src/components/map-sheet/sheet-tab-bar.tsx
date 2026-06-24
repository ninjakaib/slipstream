/**
 * SheetTabBar — horizontal tab indicator for the sheet pages.
 *
 * Displays pill-shaped indicators that animate as the user swipes between pages.
 * Tapping a tab scrolls to that page. Uses a subtle capsule highlight for the active tab.
 */
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { SymbolView } from "expo-symbols";

import type { SheetPage } from "./map-sheet";

interface Tab {
  key: SheetPage;
  label: string;
  icon: string;
  iconFilled: string;
}

const TABS: Tab[] = [
  { key: "discover", label: "Discover", icon: "magnifyingglass", iconFilled: "magnifyingglass" },
  { key: "social", label: "Friends", icon: "person.2", iconFilled: "person.2.fill" },
  { key: "convoy", label: "Convoy", icon: "car.2", iconFilled: "car.2.fill" },
  { key: "profile", label: "Profile", icon: "person.crop.circle", iconFilled: "person.crop.circle.fill" },
  { key: "settings", label: "Settings", icon: "gearshape", iconFilled: "gearshape.fill" },
];

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 250,
  mass: 0.6,
};

interface SheetTabBarProps {
  currentPage: SharedValue<number>;
}

export function SheetTabBar({ currentPage }: SheetTabBarProps) {
  const handleTabPress = useCallback(
    (index: number) => {
      currentPage.value = withSpring(index, SPRING_CONFIG);
    },
    [currentPage],
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab, index) => (
          <TabItem
            key={tab.key}
            tab={tab}
            index={index}
            currentPage={currentPage}
            onPress={handleTabPress}
          />
        ))}
      </View>
      <View style={styles.separator} />
    </View>
  );
}

interface TabItemProps {
  tab: Tab;
  index: number;
  currentPage: SharedValue<number>;
  onPress: (index: number) => void;
}

function TabItem({ tab, index, currentPage, onPress }: TabItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = Math.abs(currentPage.value - index) < 0.5;

    const scale = interpolate(
      Math.abs(currentPage.value - index),
      [0, 0.5, 1],
      [1, 0.95, 0.9],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      Math.abs(currentPage.value - index),
      [0, 1],
      [1, 0.5],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(currentPage.value - index),
      [0, 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
    };
  });

  return (
    <Pressable
      style={styles.tabButton}
      onPress={() => onPress(index)}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.tabHighlight, backgroundStyle]} />
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <SymbolView
          name={tab.icon as any}
          tintColor="#FFFFFF"
          size={18}
        />
        <Text style={styles.tabLabel}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
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
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  tabHighlight: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 8,
    marginHorizontal: 8,
  },
});
