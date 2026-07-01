/**
 * OnboardingInput — the rounded, dark text field used throughout onboarding,
 * with optional leading/trailing adornments and a soft focus glow.
 */
import { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { ONBOARDING_COLORS } from "@/features/onboarding/components/scaffold";

interface OnboardingInputProps extends TextInputProps {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const OnboardingInput = forwardRef<TextInput, OnboardingInputProps>(
  function OnboardingInput({ leading, trailing, style, onFocus, onBlur, ...rest }, ref) {
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.wrap, focused && styles.wrapFocused]}>
        {leading}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={ONBOARDING_COLORS.textMuted}
          selectionColor="#2D6CFF"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 60,
    borderRadius: 999,
    paddingHorizontal: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  wrapFocused: {
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  input: {
    flex: 1,
    color: ONBOARDING_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "500",
    paddingVertical: 16,
  },
});
