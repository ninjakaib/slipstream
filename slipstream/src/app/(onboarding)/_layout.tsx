import { Stack } from "expo-router";

import { OnboardingDraftProvider } from "@/features/onboarding/onboarding-draft-context";

export const unstable_settings = {
  initialRouteName: "intro",
};

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000" },
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="intro" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="name" />
        <Stack.Screen name="username" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="vehicle" />
        <Stack.Screen name="units" />
        <Stack.Screen name="permissions" />
      </Stack>
    </OnboardingDraftProvider>
  );
}
