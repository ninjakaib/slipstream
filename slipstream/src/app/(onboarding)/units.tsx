/** Step: preferred speed units. */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { SpeedUnit } from "@/lib/api/types.gen";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

const OPTIONS: { value: SpeedUnit; label: string }[] = [
  { value: "mph", label: "MPH" },
  { value: "kph", label: "KM/H" },
];

export default function UnitsScreen() {
  const speedUnit = useOnboardingStore((s) => s.speedUnit);
  const setSpeedUnit = useOnboardingStore((s) => s.setSpeedUnit);

  return (
    <OnboardingScaffold
      dismissKeyboardOnTap={false}
      footer={
        <PrimaryButton
          label="Continue"
          onPress={() => navPush(ONBOARDING_ROUTES.permissions)}
        />
      }
    >
      <OnboardingTitle>Choose your units</OnboardingTitle>
      <OnboardingSubtitle>How do you measure speed?</OnboardingSubtitle>

      <View style={styles.card}>
        <View style={styles.segment}>
          {OPTIONS.map((opt) => {
            const selected = speedUnit === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSpeedUnit(opt.value)}
                style={[styles.segmentItem, selected && styles.segmentItemSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {opt.label}
                </Text>
                {selected && (
                  <SymbolView name="checkmark" size={15} tintColor="#000" weight="bold" fallback={null} />
                )}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>You can change this later in Settings.</Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 32,
    padding: 8,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 60,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  segmentItemSelected: { backgroundColor: "#FFFFFF" },
  segmentText: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },
  segmentTextSelected: { color: "#000000" },
  note: {
    color: ONBOARDING_COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
});
