/** Step: display name. */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
} from "@/features/onboarding/components/scaffold";
import { OnboardingInput } from "@/features/onboarding/components/onboarding-input";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { useOnboardingDraft } from "@/features/onboarding/onboarding-draft-context";
import { STEP_PROGRESS } from "@/features/onboarding/lib/steps";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

export default function NameScreen() {
  const { draft, setDisplayName } = useOnboardingDraft();
  const [value, setValue] = useState(draft.displayName);

  const canContinue = value.trim().length > 0;

  const handleContinue = () => {
    setDisplayName(value.trim());
    navPush(ONBOARDING_ROUTES.username);
  };

  return (
    <OnboardingScaffold progress={STEP_PROGRESS.name} keyboardAvoiding>
      <OnboardingTitle>What's your name?</OnboardingTitle>
      <OnboardingSubtitle>This is how other drivers will see you.</OnboardingSubtitle>

      <View style={styles.form}>
        <OnboardingInput
          placeholder="Your name"
          value={value}
          onChangeText={setValue}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={100}
          onSubmitEditing={canContinue ? handleContinue : undefined}
        />

        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </View>

      <View style={styles.spacer} />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 32, gap: 28 },
  spacer: { flex: 1 },
});
