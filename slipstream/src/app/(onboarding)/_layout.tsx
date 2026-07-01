/**
 * Onboarding layout — owns the chrome shared by every step so it stays put
 * while only the screen content slides:
 *   • one static HalftoneBackground (no per-screen glow switching)
 *   • one persistent progress bar + back button, driven by the current route
 *   • a transparent Stack so the content animates over the shared background
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import { useOnboardingStore } from "@/stores/onboarding-store";
import {
  HalftoneBackground,
  type Glow,
} from "@/features/onboarding/components/halftone-background";
import { OnboardingHeader } from "@/features/onboarding/components/onboarding-header";
import { STEP_PROGRESS } from "@/features/onboarding/lib/steps";

export const unstable_settings = {
  initialRouteName: "intro",
};

/** One shared backdrop for the whole flow — deliberately consistent between steps. */
const SHARED_GLOWS: Glow[] = [
  { x: 0.5, y: 0.32, radius: 0.45, color: "#2D6CFF", opacity: 0.22 },
  { x: 0.5, y: 0.78, radius: 0.4, color: "#FF4D4D", opacity: 0.12 },
];

export default function OnboardingLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const step = segments[segments.length - 1] as keyof typeof STEP_PROGRESS;
  const progress = STEP_PROGRESS[step] ?? 0;
  const showBack = step !== "intro";

  return (
    <View style={styles.root}>
      <HalftoneBackground glows={SHARED_GLOWS} />

      <View style={{ height: insets.top }} />
      <View style={styles.headerWrap}>
        <OnboardingHeader progress={progress} showBack={showBack} />
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      >
        <Stack.Screen
          name="intro"
          options={{ gestureEnabled: false, animation: "fade" }}
        />
        <Stack.Screen name="name" />
        <Stack.Screen name="username" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="vehicle" />
        <Stack.Screen name="units" />
        <Stack.Screen name="permissions" />
      </Stack>

      <OnboardingHydrator />
    </View>
  );
}

/** Seeds the store's currentUsername + prefills from the server profile, once. */
function OnboardingHydrator() {
  const { session } = useAuth();
  const hydrate = useOnboardingStore((s) => s.hydrate);
  const reset = useOnboardingStore((s) => s.reset);
  const username = session?.username ?? "";

  useEffect(() => {
    // Clear any leftover draft (e.g. from a previous account this session),
    // then prefill from the current user's server profile.
    reset();
    hydrate(username);
    // Run once per mount; username is stable for the onboarding session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
