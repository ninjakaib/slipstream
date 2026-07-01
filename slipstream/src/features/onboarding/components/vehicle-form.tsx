/**
 * VehicleForm — inline form for adding a car or bike: optional photo,
 * year, make (from a searchable list or a custom value), and model.
 *
 * Renders directly in the page flow (not a modal) so the halftone
 * background shows through the translucent field pills.
 */
import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ONBOARDING_COLORS } from "@/features/onboarding/components/scaffold";
import {
  SelectSheet,
  type SelectOption,
} from "@/features/onboarding/components/select-sheet";
import { makesFor } from "@/features/onboarding/lib/vehicle-makes";
import type {
  VehicleDraft,
  VehicleKind,
} from "@/features/onboarding/onboarding-draft-context";

const CUSTOM = "__custom__";
const CURRENT_YEAR = new Date().getFullYear() + 1;
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) =>
  String(CURRENT_YEAR - i),
);

interface VehicleFormProps {
  kind: VehicleKind;
  onAdd: (v: Omit<VehicleDraft, "id">) => void;
  onCancel: () => void;
}

export function VehicleForm({ kind, onAdd, onCancel }: VehicleFormProps) {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [make, setMake] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const [yearOpen, setYearOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);

  const noun = kind === "bike" ? "Bike" : "Car";

  const makeOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = makesFor(kind).map((m) => ({
      label: m,
      value: m,
    }));
    return [{ label: "Custom Make", value: CUSTOM, accent: true }, ...list];
  }, [kind]);

  const yearOptions = useMemo<SelectOption[]>(
    () => YEARS.map((y) => ({ label: y, value: y })),
    [],
  );

  const resolvedMake = customMode ? customMake.trim() : make;
  const makeLabel = customMode ? "Custom Make" : make || "Select";
  const canAdd =
    resolvedMake.length > 0 && model.trim().length > 0 && year.length === 4;

  const handleAdd = () => {
    if (!canAdd) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd({
      kind,
      year: Number(year),
      make: resolvedMake,
      model: model.trim(),
      photoUri,
    });
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={pickPhoto} style={styles.photoBox}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoEmpty}>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>Optional</Text>
            </View>
            <SymbolView
              name="camera.fill"
              size={26}
              tintColor={ONBOARDING_COLORS.textSecondary}
              fallback={null}
            />
            <Text style={styles.photoTitle}>
              Add a side-profile {kind} photo
            </Text>
            <Text style={styles.photoHint}>Optional now, can upload later</Text>
          </View>
        )}
      </Pressable>

      <FieldPill label="Year" value={year} onPress={() => setYearOpen(true)} />
      <FieldPill
        label="Make"
        value={makeLabel}
        placeholder={make === "" && !customMode}
        onPress={() => setMakeOpen(true)}
      />

      {customMode && (
        <View style={styles.inputPill}>
          <TextInput
            style={styles.input}
            placeholder={`Make (e.g. ${
              kind === "bike" ? "Ducati, KTM, Triumph" : "Toyota, BMW"
            })`}
            placeholderTextColor={ONBOARDING_COLORS.textMuted}
            value={customMake}
            onChangeText={setCustomMake}
            autoCapitalize="words"
          />
        </View>
      )}

      <View style={styles.inputPill}>
        <TextInput
          style={styles.input}
          placeholder={
            kind === "bike"
              ? "Model (e.g. Street Triple, R1)"
              : "Model (e.g. Civic, M3, Model 3)"
          }
          placeholderTextColor={ONBOARDING_COLORS.textMuted}
          value={model}
          onChangeText={setModel}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.infoRow}>
        <SymbolView
          name="info.circle"
          size={15}
          tintColor={ONBOARDING_COLORS.textMuted}
          fallback={null}
        />
        <Text style={styles.infoText}>
          No photo? Totally fine. You can add one later for car art.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleAdd}
          disabled={!canAdd}
          style={({ pressed }) => [
            styles.addBtn,
            !canAdd && styles.addBtnDisabled,
            pressed && canAdd && styles.pressed,
          ]}
        >
          <Text style={[styles.addText, !canAdd && styles.addTextDisabled]}>
            Add {noun}
          </Text>
        </Pressable>
      </View>

      <SelectSheet
        visible={yearOpen}
        title="Year"
        options={yearOptions}
        selectedValue={year}
        onSelect={setYear}
        onClose={() => setYearOpen(false)}
      />
      <SelectSheet
        visible={makeOpen}
        title="Make"
        searchable
        searchPlaceholder="Search make"
        options={makeOptions}
        selectedValue={customMode ? CUSTOM : make}
        onSelect={(v) => {
          if (v === CUSTOM) {
            setCustomMode(true);
            setMake("");
          } else {
            setCustomMode(false);
            setMake(v);
          }
        }}
        onClose={() => setMakeOpen(false)}
      />
    </View>
  );
}

function FieldPill({
  label,
  value,
  placeholder = false,
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fieldPill, pressed && styles.pressed]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueWrap}>
        <Text style={[styles.fieldValue, placeholder && styles.fieldPlaceholder]}>
          {value}
        </Text>
        <SymbolView
          name="chevron.down"
          size={13}
          tintColor={ONBOARDING_COLORS.textSecondary}
          fallback={null}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 28 },
  photoBox: { marginBottom: 14 },
  photo: { width: "100%", height: 150, borderRadius: 16 },
  photoEmpty: {
    height: 130,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  optionalBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  optionalText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  photoTitle: { color: ONBOARDING_COLORS.textSecondary, fontSize: 15, fontWeight: "600" },
  photoHint: { color: ONBOARDING_COLORS.textMuted, fontSize: 13 },
  fieldPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 58,
    borderRadius: 999,
    paddingHorizontal: 22,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  fieldLabel: { color: ONBOARDING_COLORS.textSecondary, fontSize: 16, fontWeight: "500" },
  fieldValueWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  fieldPlaceholder: { color: ONBOARDING_COLORS.textMuted },
  inputPill: {
    height: 58,
    borderRadius: 999,
    paddingHorizontal: 22,
    marginBottom: 12,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  input: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  infoText: { flex: 1, color: ONBOARDING_COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cancelText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  addBtn: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  addBtnDisabled: { backgroundColor: "rgba(255,255,255,0.14)" },
  addText: { color: "#000000", fontSize: 17, fontWeight: "700" },
  addTextDisabled: { color: "rgba(255,255,255,0.5)" },
  pressed: { opacity: 0.7 },
});
