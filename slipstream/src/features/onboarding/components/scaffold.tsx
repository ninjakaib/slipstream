/**
 * Onboarding screen scaffold + shared typography.
 *
 * Provides the common chrome — black field, halftone backdrop, safe-area
 * insets, the progress header, and horizontal padding — so each step only
 * has to lay out its own body.
 */
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  type TextProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HalftoneBackground,
  type Glow,
} from "@/features/onboarding/components/halftone-background";
import { OnboardingHeader } from "@/features/onboarding/components/onboarding-header";

export const ONBOARDING_COLORS = {
  background: "#000000",
  textPrimary: "#FFFFFF",
  textSecondary: "#9A9AA2",
  textMuted: "#6E6E76",
};

interface ScaffoldProps {
  children: ReactNode;
  /** 0–1 progress for the header track. Omit to hide the header entirely. */
  progress?: number;
  showBack?: boolean;
  onBack?: () => void;
  glows?: Glow[];
  /** Avoid the keyboard (screens with a text field + bottom button). */
  keyboardAvoiding?: boolean;
}

export function OnboardingScaffold({
  children,
  progress,
  showBack = true,
  onBack,
  glows,
  keyboardAvoiding = false,
}: ScaffoldProps) {
  const insets = useSafeAreaInsets();

  const body = (
    <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      {progress !== undefined && (
        <View style={styles.headerWrap}>
          <OnboardingHeader
            progress={progress}
            showBack={showBack}
            onBack={onBack}
          />
        </View>
      )}
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <HalftoneBackground glows={glows} />
      <View style={{ height: insets.top }} />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

export function OnboardingTitle({ style, ...rest }: TextProps) {
  return <Text style={[styles.title, style]} {...rest} />;
}

export function OnboardingSubtitle({ style, ...rest }: TextProps) {
  return <Text style={[styles.subtitle, style]} {...rest} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ONBOARDING_COLORS.background },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerWrap: {
    marginBottom: 28,
  },
  title: {
    color: ONBOARDING_COLORS.textPrimary,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
    marginTop: 10,
  },
});
