/**
 * Onboarding screen scaffold + shared typography.
 *
 * The chrome (halftone background + progress header) lives once in
 * `(onboarding)/_layout.tsx`, so this only lays out a step's own body: a padded
 * content region (tap anywhere to dismiss the keyboard) and an optional footer
 * that sticks to the bottom and rises with the keyboard.
 */
import type { ReactNode } from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  type TextProps,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_COLORS = {
  background: "#000000",
  textPrimary: "#FFFFFF",
  textSecondary: "#9A9AA2",
  textMuted: "#6E6E76",
};

interface ScaffoldProps {
  children: ReactNode;
  /** Bottom-pinned content (e.g. the Continue button) that rises with the keyboard. */
  footer?: ReactNode;
  /** Tap anywhere in the content region to dismiss the keyboard. Default true. */
  dismissKeyboardOnTap?: boolean;
}

export function OnboardingScaffold({
  children,
  footer,
  dismissKeyboardOnTap = true,
}: ScaffoldProps) {
  const insets = useSafeAreaInsets();

  const content = <View style={styles.content}>{children}</View>;

  return (
    <View style={styles.root}>
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback
          accessible={false}
          onPress={() => Keyboard.dismiss()}
        >
          {content}
        </TouchableWithoutFeedback>
      ) : (
        content
      )}

      {footer && (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            {footer}
          </View>
        </KeyboardStickyView>
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
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
