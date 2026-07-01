/** Step: display name. */
import { StyleSheet, View } from "react-native";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
} from "@/features/onboarding/components/scaffold";
import { OnboardingInput } from "@/features/onboarding/components/onboarding-input";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

export default function NameScreen() {
  const displayName = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);

  const canContinue = displayName.trim().length > 0;

  const handleContinue = () => {
    setDisplayName(displayName.trim());
    navPush(ONBOARDING_ROUTES.username);
  };

  return (
    <OnboardingScaffold
      footer={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      <OnboardingTitle>What's your name?</OnboardingTitle>
      <OnboardingSubtitle>This is how other drivers will see you.</OnboardingSubtitle>

      <View style={styles.form}>
        <OnboardingInput
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={100}
          onSubmitEditing={canContinue ? handleContinue : undefined}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 32 },
});
