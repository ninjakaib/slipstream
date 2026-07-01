/**
 * OnboardingHeader — the back button + progress track shown at the top of
 * every onboarding step. The fill animates in on mount so advancing a step
 * reads as the bar growing.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { navBack } from "@/lib/nav";

interface OnboardingHeaderProps {
  /** 0–1 fraction of the flow completed at this step. */
  progress: number;
  showBack?: boolean;
  onBack?: () => void;
}

export function OnboardingHeader({
  progress,
  showBack = true,
  onBack,
}: OnboardingHeaderProps) {
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 450,
    });
  }, [progress, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const handleBack = () => {
    Haptics.selectionAsync();
    if (onBack) onBack();
    else navBack();
  };

  return (
    <View style={styles.row}>
      {showBack && (
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <SymbolView
            name="chevron.left"
            size={16}
            tintColor="#FFFFFF"
            weight="semibold"
            fallback={null}
          />
        </Pressable>
      )}

      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 36,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
});
