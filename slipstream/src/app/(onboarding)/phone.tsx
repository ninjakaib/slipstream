/** Step: phone number with country code + light numbering-rule validation. */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { OnboardingInput } from "@/features/onboarding/components/onboarding-input";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import {
  SelectSheet,
  type SelectOption,
} from "@/features/onboarding/components/select-sheet";
import { useOnboardingDraft } from "@/features/onboarding/onboarding-draft-context";
import { STEP_PROGRESS } from "@/features/onboarding/lib/steps";
import { COUNTRIES, isValidPhone } from "@/features/onboarding/lib/countries";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

export default function PhoneScreen() {
  const { draft, setCountry, setPhoneNumber } = useOnboardingDraft();
  const [number, setNumber] = useState(draft.phoneNumber);
  const [pickerOpen, setPickerOpen] = useState(false);

  const valid = isValidPhone(draft.country, number);

  const countryOptions = useMemo<SelectOption[]>(
    () =>
      COUNTRIES.map((c) => ({
        label: `${c.flag}  ${c.name}  ${c.dial}`,
        value: c.code,
      })),
    [],
  );

  const handleContinue = () => {
    setPhoneNumber(number);
    navPush(ONBOARDING_ROUTES.vehicle);
  };

  return (
    <OnboardingScaffold progress={STEP_PROGRESS.phone} keyboardAvoiding>
      <OnboardingTitle>Add your phone number</OnboardingTitle>
      <OnboardingSubtitle>
        Required for account safety and recovery. No verification code required.
      </OnboardingSubtitle>

      <View style={styles.form}>
        <View style={styles.row}>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.countryPill, pressed && styles.pressed]}
          >
            <Text style={styles.flag}>{draft.country.flag}</Text>
            <Text style={styles.dial}>{draft.country.dial}</Text>
            <SymbolView
              name="chevron.up.chevron.down"
              size={13}
              tintColor={ONBOARDING_COLORS.textSecondary}
              fallback={null}
            />
          </Pressable>

          <View style={styles.numberField}>
            <OnboardingInput
              placeholder="Phone number"
              value={number}
              onChangeText={setNumber}
              keyboardType="number-pad"
              autoFocus
              maxLength={18}
              style={styles.numberInput}
            />
          </View>
        </View>

        <Text style={styles.helper}>
          We'll validate this with your country's numbering rules.
        </Text>

        <View style={styles.lockChip}>
          <SymbolView name="lock.fill" size={12} tintColor={ONBOARDING_COLORS.textSecondary} fallback={null} />
          <Text style={styles.lockText}>We only use this for account recovery</Text>
        </View>

        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!valid}
        />
      </View>

      <View style={styles.spacer} />

      <SelectSheet
        visible={pickerOpen}
        title="Country"
        searchable
        searchPlaceholder="Search country"
        options={countryOptions}
        selectedValue={draft.country.code}
        onSelect={(code) => {
          const next = COUNTRIES.find((c) => c.code === code);
          if (next) setCountry(next);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 28, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  countryPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 7,
    height: 60,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pressed: { opacity: 0.7 },
  flag: { fontSize: 20 },
  dial: { color: ONBOARDING_COLORS.textPrimary, fontSize: 18, fontWeight: "600" },
  numberField: { flex: 1 },
  numberInput: { fontSize: 18 },
  helper: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 14,
    paddingHorizontal: 6,
  },
  lockChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  lockText: { color: ONBOARDING_COLORS.textSecondary, fontSize: 13, fontWeight: "500" },
  spacer: { flex: 1 },
});
