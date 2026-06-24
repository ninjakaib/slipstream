import "@/polyfills";

import { ActivityIndicator, View, useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from "expo-router";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import LoginScreen from "@/features/auth/login-screen";

function RootContent() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="sheet"
        options={{
          presentation: "formSheet",
          gestureEnabled: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.12, 0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetLargestUndimmedDetentIndex: 2,
          sheetCornerRadius: 20,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
