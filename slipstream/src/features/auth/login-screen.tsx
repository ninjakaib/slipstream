import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import { Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "react-native";

type Mode = "login" | "register";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const [mode, setMode] = useState<Mode>("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, displayName.trim() || undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.text }]}>SlipStream</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Find your crew. Hit the road.
          </Text>
        </View>

        <View style={styles.form}>
          {mode === "register" && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.backgroundElement, color: colors.text },
              ]}
              placeholder="Display name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "login" ? "Log In" : "Create Account"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          {mode === "register" ? (
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already have an account?{" "}
              <Text
                style={styles.footerLink}
                onPress={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Log in
              </Text>
            </Text>
          ) : (
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Don't have an account?{" "}
              <Text
                style={styles.footerLink}
                onPress={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Sign up
              </Text>
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.six,
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    marginTop: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  error: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.five,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    color: "#3B82F6",
    fontWeight: "600",
  },
});
