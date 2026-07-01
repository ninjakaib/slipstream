/**
 * Email login / register — the username + password fallback. Kept available
 * for users who don't want Apple/Google and to ease local development.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import {
  HalftoneBackground,
  type Glow,
} from "@/features/onboarding/components/halftone-background";
import { OnboardingInput } from "@/features/onboarding/components/onboarding-input";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { ONBOARDING_COLORS } from "@/features/onboarding/components/scaffold";
import { navBack } from "@/lib/nav";

type Mode = "login" | "register";

const GLOWS: Glow[] = [
  { x: 0.3, y: 0.3, radius: 0.4, color: "#2D6CFF", opacity: 0.22 },
];

export default function EmailAuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      // Auth gate routes onward on success.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <HalftoneBackground glows={GLOWS} />
      <View style={{ height: insets.top }} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={navBack} hitSlop={10} style={styles.back}>
            <SymbolView
              name="chevron.left"
              size={16}
              tintColor="#FFFFFF"
              weight="semibold"
              fallback={null}
            />
          </Pressable>

          <Text style={styles.title}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "login"
              ? "Sign in with your email and password."
              : "Sign up with your email and password to get started."}
          </Text>

          <View style={styles.form}>
            <OnboardingInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <OnboardingInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === "login" ? "password" : "newPassword"}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              label={mode === "login" ? "Log In" : "Create Account"}
              icon={null}
              loading={loading}
              onPress={handleSubmit}
            />
          </View>

          <Pressable
            onPress={() => {
              setMode((m) => (m === "login" ? "register" : "login"));
              setError(null);
            }}
            hitSlop={8}
            style={styles.switch}
          >
            <Text style={styles.switchText}>
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text style={styles.switchLink}>
                {mode === "login" ? "Sign up" : "Log in"}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ONBOARDING_COLORS.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    color: ONBOARDING_COLORS.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 28,
  },
  form: { gap: 14 },
  error: { color: "#FF6B6B", fontSize: 14, textAlign: "center" },
  switch: { marginTop: 24, alignItems: "center" },
  switchText: { color: ONBOARDING_COLORS.textSecondary, fontSize: 15 },
  switchLink: { color: "#2D8CFF", fontWeight: "700" },
});
