/**
 * Intro — a brief welcome with the SlipStream car spotlit, then continues to
 * the details. Tap anywhere to advance immediately, or it auto-advances.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { navReplace, ONBOARDING_ROUTES } from "@/lib/nav";

const AUTO_ADVANCE_MS = 2400;

export default function IntroScreen() {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0.6);

  const advance = () => navReplace(ONBOARDING_ROUTES.name);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
    scale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });
    glow.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100 }),
          withTiming(0.6, { duration: 1100 }),
        ),
        -1,
        true,
      ),
    );

    const t = setTimeout(advance, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.9 + glow.value * 0.25 }],
  }));

  return (
    <Pressable style={styles.flex} onPress={advance}>
      <OnboardingScaffold dismissKeyboardOnTap={false}>
        <View style={styles.body}>
          <View style={styles.stage}>
            <Animated.View style={[styles.spotlight, glowStyle]} />
            <Animated.Text style={[styles.car, carStyle]}>🏎️</Animated.Text>
          </View>

          <OnboardingTitle style={styles.title}>
            Let's get you set up
          </OnboardingTitle>
          <OnboardingSubtitle style={styles.subtitle}>
            We just need a few details to personalize your experience. This will
            only take a minute.
          </OnboardingSubtitle>
        </View>

        <Text style={styles.hint}>Tap to continue</Text>
      </OnboardingScaffold>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: "center", alignItems: "center" },
  stage: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  spotlight: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,80,80,0.18)",
  },
  car: { fontSize: 110 },
  title: { textAlign: "center", fontSize: 36 },
  subtitle: { textAlign: "center", paddingHorizontal: 8 },
  hint: {
    color: ONBOARDING_COLORS.textMuted,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    paddingBottom: 8,
  },
});
