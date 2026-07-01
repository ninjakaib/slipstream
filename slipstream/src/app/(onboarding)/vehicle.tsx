/** Step: add one or more vehicles (cars/bikes). */
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  OnboardingScaffold,
  OnboardingTitle,
  OnboardingSubtitle,
  ONBOARDING_COLORS,
} from "@/features/onboarding/components/scaffold";
import { GhostPill, PrimaryButton } from "@/features/onboarding/components/buttons";
import { VehicleForm } from "@/features/onboarding/components/vehicle-form";
import {
  useOnboardingDraft,
  type VehicleKind,
} from "@/features/onboarding/onboarding-draft-context";
import { STEP_PROGRESS } from "@/features/onboarding/lib/steps";
import type { Glow } from "@/features/onboarding/components/halftone-background";
import { navPush, ONBOARDING_ROUTES } from "@/lib/nav";

const GLOWS: Glow[] = [
  { x: 0.5, y: 0.25, radius: 0.4, color: "#2D6CFF", opacity: 0.22 },
  { x: 0.5, y: 0.62, radius: 0.35, color: "#FF4D4D", opacity: 0.14 },
];

export default function VehicleScreen() {
  const { draft, addVehicle, removeVehicle } = useOnboardingDraft();
  const [formKind, setFormKind] = useState<VehicleKind | null>(null);

  const hasVehicles = draft.vehicles.length > 0;

  const handleContinue = () => navPush(ONBOARDING_ROUTES.units);

  if (formKind !== null) {
    return (
      <OnboardingScaffold
        progress={STEP_PROGRESS.vehicle}
        glows={GLOWS}
        keyboardAvoiding
      >
        <OnboardingTitle>Add your vehicle</OnboardingTitle>
        <OnboardingSubtitle>
          Add your car or bike details to continue. Photo is optional.
        </OnboardingSubtitle>

        <VehicleForm
          kind={formKind}
          onAdd={(v) => {
            addVehicle(v);
            setFormKind(null);
          }}
          onCancel={() => setFormKind(null)}
        />
      </OnboardingScaffold>
    );
  }

  return (
    <OnboardingScaffold progress={STEP_PROGRESS.vehicle} glows={GLOWS}>
      <OnboardingTitle>Add your vehicle</OnboardingTitle>
      <OnboardingSubtitle>
        Add your car or bike details to continue. Photo is optional.
      </OnboardingSubtitle>

      {!hasVehicles ? (
        <View style={styles.addRow}>
          <GhostPill
            label="Add a Car"
            icon="car.fill"
            onPress={() => setFormKind("car")}
            style={styles.addPill}
          />
          <GhostPill
            label="Add a Bike"
            icon="bicycle"
            onPress={() => setFormKind("bike")}
            style={styles.addPill}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {draft.vehicles.map((v) => (
            <View key={v.id} style={styles.vehicleCard}>
              {v.photoUri ? (
                <Image source={{ uri: v.photoUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <SymbolView
                    name={v.kind === "bike" ? "bicycle" : "car.fill"}
                    size={22}
                    tintColor={ONBOARDING_COLORS.textSecondary}
                    fallback={null}
                  />
                </View>
              )}
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleTitle}>
                  {v.year} {v.make}
                </Text>
                <Text style={styles.vehicleModel}>{v.model}</Text>
              </View>
              <Pressable
                onPress={() => removeVehicle(v.id)}
                hitSlop={8}
                style={styles.removeBtn}
              >
                <SymbolView name="xmark" size={12} tintColor="#FFFFFF" weight="bold" fallback={null} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => setFormKind("car")}
            style={styles.addAnother}
            hitSlop={6}
          >
            <SymbolView name="plus" size={14} tintColor={ONBOARDING_COLORS.textSecondary} fallback={null} />
            <Text style={styles.addAnotherText}>Add another vehicle</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.spacer} />

      {hasVehicles && (
        <PrimaryButton label="Continue" onPress={handleContinue} />
      )}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: "row", gap: 12, marginTop: 36 },
  addPill: { flex: 1 },
  list: { marginTop: 32, gap: 12 },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  thumb: { width: 60, height: 56, borderRadius: 12, backgroundColor: "#222" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1 },
  vehicleTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  vehicleModel: { color: ONBOARDING_COLORS.textSecondary, fontSize: 15, marginTop: 2 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  addAnother: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  addAnotherText: { color: ONBOARDING_COLORS.textSecondary, fontSize: 15, fontWeight: "600" },
  spacer: { flex: 1 },
});
