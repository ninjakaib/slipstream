/** Step: unique username, validated live against the backend. */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { OnboardingInput } from "@/features/onboarding/components/onboarding-input";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { useOnboardingDraft } from "@/features/onboarding/onboarding-draft-context";
import { STEP_PROGRESS } from "@/features/onboarding/lib/steps";
import { checkUsername } from "@/lib/api/sdk.gen";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

type Status = "idle" | "checking" | "available" | "unavailable";

export default function UsernameScreen() {
  const { draft, setUsername } = useOnboardingDraft();
  const [value, setValue] = useState(draft.username);
  const [status, setStatus] = useState<Status>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const handle = value.trim();
    setReason(null);

    if (handle.length === 0) {
      setStatus("idle");
      return;
    }
    if (handle.length < 3) {
      setStatus("unavailable");
      setReason("Must be at least 3 characters.");
      return;
    }

    setStatus("checking");
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await checkUsername({ query: { username: handle } });
        if (id !== reqId.current) return; // a newer keystroke superseded this
        if (data?.available) {
          setStatus("available");
        } else {
          setStatus("unavailable");
          setReason(data?.reason ?? "That username is taken.");
        }
      } catch {
        if (id !== reqId.current) return;
        setStatus("unavailable");
        setReason("Couldn't check right now. Try again.");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [value]);

  const handleContinue = () => {
    setUsername(value.trim());
    navPush(ONBOARDING_ROUTES.phone);
  };

  return (
    <OnboardingScaffold progress={STEP_PROGRESS.username} keyboardAvoiding>
      <OnboardingTitle>Pick a username</OnboardingTitle>
      <OnboardingSubtitle>
        This is your unique handle. It can't be changed later.
      </OnboardingSubtitle>

      <View style={styles.form}>
        <OnboardingInput
          placeholder="username"
          value={value}
          onChangeText={(t) => setValue(t.replace(/\s/g, ""))}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={status === "available" ? handleContinue : undefined}
          leading={<Text style={styles.at}>@</Text>}
          trailing={<StatusIndicator status={status} />}
        />

        <StatusLine status={status} reason={reason} handle={value.trim()} />

        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={status !== "available"}
        />
      </View>

      <View style={styles.spacer} />
    </OnboardingScaffold>
  );
}

function StatusIndicator({ status }: { status: Status }) {
  if (status === "checking") return <ActivityIndicator color="#FFFFFF" />;
  if (status === "available") {
    return (
      <View style={[styles.badge, styles.badgeOk]}>
        <SymbolView name="checkmark" size={13} tintColor="#000" weight="bold" fallback={null} />
      </View>
    );
  }
  if (status === "unavailable") {
    return (
      <View style={[styles.badge, styles.badgeBad]}>
        <SymbolView name="xmark" size={12} tintColor="#FFF" weight="bold" fallback={null} />
      </View>
    );
  }
  return null;
}

function StatusLine({
  status,
  reason,
  handle,
}: {
  status: Status;
  reason: string | null;
  handle: string;
}) {
  if (status === "available") {
    return (
      <Text style={styles.statusLine}>
        <Text style={styles.ok}>Username is available</Text>
        <Text style={styles.muted}>{`  ·  @${handle.toLowerCase()}`}</Text>
      </Text>
    );
  }
  if (status === "unavailable" && reason) {
    return <Text style={[styles.statusLine, styles.bad]}>{reason}</Text>;
  }
  if (status === "checking") {
    return <Text style={[styles.statusLine, styles.muted]}>Checking availability…</Text>;
  }
  return (
    <Text style={[styles.statusLine, styles.muted]}>
      3–20 characters. Letters, numbers, and underscores.
    </Text>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 28, gap: 14 },
  spacer: { flex: 1 },
  at: { color: ONBOARDING_COLORS.textSecondary, fontSize: 18, fontWeight: "600" },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOk: { backgroundColor: "#FFFFFF" },
  badgeBad: { backgroundColor: "#FF4D4D" },
  statusLine: { fontSize: 14, fontWeight: "500", paddingHorizontal: 6 },
  ok: { color: "#46D27E" },
  bad: { color: "#FF6B6B" },
  muted: { color: ONBOARDING_COLORS.textMuted },
});
