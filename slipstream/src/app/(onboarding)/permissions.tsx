/** Final step: request device permissions, then persist the draft and finish. */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { PrimaryButton } from "@/features/onboarding/components/buttons";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useOnboarding } from "@/contexts/onboarding-context";
import {
  requestLocationAlways,
  requestMotion,
  requestNotifications,
  checkLocationAlways,
  checkMotion,
  checkNotifications,
} from "@/features/onboarding/lib/permissions";

type PermKey = "location" | "motion" | "notifications";
type PermState = "idle" | "pending" | "granted" | "denied";

interface PermRow {
  key: PermKey;
  icon: SymbolViewProps["name"];
  title: string;
  description: string;
  request: () => Promise<boolean>;
  check: () => Promise<boolean>;
}

const ROWS: PermRow[] = [
  {
    key: "location",
    icon: "location.fill",
    title: "Enable Always Allow",
    description:
      'Select "While Using App" first, then "Always Allow" on the second location prompt.',
    request: requestLocationAlways,
    check: checkLocationAlways,
  },
  {
    key: "motion",
    icon: "figure.walk.motion",
    title: "Enable Motion Access",
    description: 'Select "Allow" so SlipStream can confirm you are in a moving car.',
    request: requestMotion,
    check: checkMotion,
  },
  {
    key: "notifications",
    icon: "bell.fill",
    title: "Enable Notifications",
    description: 'Select "Allow" so you get drive recaps and safety alerts.',
    request: requestNotifications,
    check: checkNotifications,
  },
];

export default function PermissionsScreen() {
  const submit = useOnboardingStore((s) => s.submit);
  const { complete } = useOnboarding();

  const [states, setStates] = useState<Record<PermKey, PermState>>({
    location: "idle",
    motion: "idle",
    notifications: "idle",
  });
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reconcile the UI with the real device permissions. Runs on mount and every
  // time the app returns to the foreground (e.g. after the user grants/revokes
  // a permission from Settings), so the buttons always reflect reality.
  const syncStates = useCallback(async () => {
    const results = await Promise.all(ROWS.map((row) => row.check()));
    setStates((prev) => {
      const next = { ...prev };
      ROWS.forEach((row, i) => {
        if (prev[row.key] === "pending") return; // don't clobber an in-flight request
        if (results[i]) next[row.key] = "granted";
        else if (prev[row.key] === "granted") next[row.key] = "idle"; // revoked from Settings
      });
      return next;
    });
  }, []);

  useEffect(() => {
    syncStates();
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") syncStates();
    });
    return () => sub.remove();
  }, [syncStates]);

  const handleRequest = async (row: PermRow) => {
    // Once denied, iOS won't re-prompt — send the user to Settings instead.
    if (states[row.key] === "denied") {
      Linking.openSettings();
      return;
    }
    setStates((s) => ({ ...s, [row.key]: "pending" }));
    const granted = await row.request();
    setStates((s) => ({ ...s, [row.key]: granted ? "granted" : "denied" }));
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    try {
      await submit();
      await complete(); // flips the gate to the main app
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish setup. Try again.");
      setFinishing(false);
    }
  };

  return (
    <OnboardingScaffold
      dismissKeyboardOnTap={false}
      footer={
        <>
          {error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton
            label="Continue"
            icon="arrow.right"
            loading={finishing}
            onPress={handleFinish}
          />
        </>
      }
    >
      <OnboardingTitle>Enable permissions</OnboardingTitle>
      <OnboardingSubtitle>
        Turn on permissions for automatic drive tracking to work properly.
      </OnboardingSubtitle>

      <View style={styles.rows}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.iconCircle}>
              <SymbolView name={row.icon} size={18} tintColor="#FFFFFF" fallback={null} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowDesc}>{row.description}</Text>
            </View>
            <View style={styles.btnSlot}>
              <EnableButton state={states[row.key]} onPress={() => handleRequest(row)} />
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

function EnableButton({
  state,
  onPress,
}: {
  state: PermState;
  onPress: () => void;
}) {
  if (state === "granted") {
    return (
      <View style={[styles.enableBtn, styles.enabledBtn]}>
        <SymbolView name="checkmark" size={14} tintColor="#000" weight="bold" fallback={null} />
      </View>
    );
  }
  if (state === "pending") {
    return (
      <View style={styles.enableBtn}>
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.enableBtn, pressed && styles.pressed]}
    >
      <Text style={styles.enableText} numberOfLines={1}>
        {state === "denied" ? "Retry" : "Enable"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 28, gap: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  // Fixed-width slot, right-aligned, so the text column stays put whether the
  // control is the full-width "Enable" pill or the compact checkmark circle.
  btnSlot: { width: 84, alignItems: "flex-end", justifyContent: "center" },
  rowTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  rowDesc: {
    color: ONBOARDING_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  enableBtn: {
    width: 84,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  enabledBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF" },
  enableText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  error: { color: "#FF6B6B", fontSize: 14, textAlign: "center", marginBottom: 12 },
});
