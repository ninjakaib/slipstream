/**
 * Welcome — the unauthenticated entry screen. Sign in with Apple (native),
 * Google (stubbed for now), or fall back to email username/password.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import {
  HalftoneBackground,
  type Glow,
} from "@/features/onboarding/components/halftone-background";
import { ONBOARDING_COLORS } from "@/features/onboarding/components/scaffold";
import { navPush, AUTH_ROUTES } from "@/lib/nav";

const GLOWS: Glow[] = [
  { x: 0.5, y: 0.55, radius: 0.45, color: "#2D6CFF", opacity: 0.3 },
  { x: 0.2, y: 0.78, radius: 0.3, color: "#7A3DFF", opacity: 0.16 },
  { x: 0.85, y: 0.82, radius: 0.3, color: "#FF4D4D", opacity: 0.12 },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithApple } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
      // On success the auth gate swaps this screen for onboarding/app.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apple sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () => {
    setError("Google sign-in is coming soon. Use Apple or email for now.");
  };

  return (
    <View style={styles.root}>
      <HalftoneBackground glows={GLOWS} />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Let's Go{"\n"}For a Drive</Text>
          <Text style={styles.subtitle}>Track every drive, automatically</Text>
        </View>

        <View style={styles.actions}>
          {error && <Text style={styles.error}>{error}</Text>}

          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={30}
              style={styles.appleButton}
              onPress={handleApple}
            />
          ) : (
            <Pressable
              onPress={handleApple}
              disabled={busy}
              style={({ pressed }) => [
                styles.appleFallback,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.appleFallbackText}></Text>
              <Text style={styles.appleFallbackText}> Sign in with Apple</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleGoogle}
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          >
            <View style={styles.googleG}>
              <Text style={styles.googleGText}>G</Text>
            </View>
            <Text style={styles.googleText}>Sign in with Google</Text>
          </Pressable>

          <Pressable onPress={() => navPush(AUTH_ROUTES.login)} hitSlop={8}>
            <Text style={styles.emailLink}>Continue with email</Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ONBOARDING_COLORS.background },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  hero: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#EDEDED",
    fontSize: 46,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 18,
    fontWeight: "500",
    marginTop: 14,
  },
  actions: {
    gap: 14,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 2,
  },
  appleButton: {
    height: 60,
    width: "100%",
  },
  appleFallback: {
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  appleFallbackText: { color: "#000", fontSize: 18, fontWeight: "600" },
  googleButton: {
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleG: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  googleGText: { color: "#4285F4", fontSize: 16, fontWeight: "800" },
  googleText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  pressed: { opacity: 0.85 },
  emailLink: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
  },
  legal: {
    color: ONBOARDING_COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
