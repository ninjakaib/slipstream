import "@/polyfills";

import { ActivityIndicator, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { OnboardingProvider, useOnboarding } from "@/contexts/onboarding-context";
import { queryClient } from "@/lib/query-client";

function RootNavigator() {
  const { status: authStatus } = useAuth();
  const { status: onboardingStatus } = useOnboarding();

  const isAuthed = authStatus === "authenticated";
  const isLoading =
    authStatus === "loading" || (isAuthed && onboardingStatus === "loading");

  if (isLoading) {
    // The animated splash overlay covers this; show a neutral fallback.
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const onboarded = onboardingStatus === "complete";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#000" },
      }}
    >
      <Stack.Protected guard={isAuthed && onboarded}>
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthed && !onboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthed}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <OnboardingProvider>
              <AnimatedSplashOverlay />
              <RootNavigator />
            </OnboardingProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
