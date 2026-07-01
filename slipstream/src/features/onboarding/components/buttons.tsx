/**
 * Shared onboarding buttons.
 *
 * PrimaryButton — the white, glowing pill that drives the flow forward.
 * GhostPill     — a dark translucent pill used for secondary actions
 *                 (segmented choices, "Add a Car", country code, etc.).
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import * as Haptics from "expo-haptics";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Trailing SF Symbol (defaults to a right arrow). Pass null to hide. */
  icon?: SymbolViewProps["name"] | null;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon = "arrow.right",
}: PrimaryButtonProps) {
  const inert = disabled || loading;

  const handlePress = () => {
    if (inert) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View style={[styles.primaryGlow, inert && styles.primaryGlowOff]}>
      <Pressable
        onPress={handlePress}
        disabled={inert}
        style={({ pressed }) => [
          styles.primary,
          inert && styles.primaryDisabled,
          pressed && !inert && styles.primaryPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <View style={styles.primaryContent}>
            <Text style={styles.primaryLabel}>{label}</Text>
            {icon && (
              <SymbolView
                name={icon}
                size={18}
                tintColor="#000000"
                weight="bold"
                fallback={null}
              />
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

interface GhostPillProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Leading SF Symbol. */
  icon?: SymbolViewProps["name"];
  trailing?: React.ReactNode;
  style?: object;
}

export function GhostPill({
  label,
  onPress,
  selected = false,
  disabled = false,
  icon,
  trailing,
  style,
}: GhostPillProps) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ghost,
        selected && styles.ghostSelected,
        disabled && styles.ghostDisabled,
        pressed && !disabled && styles.ghostPressed,
        style,
      ]}
    >
      {icon && (
        <SymbolView
          name={icon}
          size={18}
          tintColor={selected ? "#000000" : "#FFFFFF"}
          weight="semibold"
          fallback={null}
        />
      )}
      <Text
        style={[styles.ghostLabel, selected && styles.ghostLabelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryGlow: {
    borderRadius: 999,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  primaryGlowOff: {
    shadowOpacity: 0,
  },
  primary: {
    height: 60,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryDisabled: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  primaryPressed: {
    backgroundColor: "#E6E6E6",
  },
  primaryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryLabel: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
  },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 999,
    paddingHorizontal: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  ghostSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  ghostDisabled: {
    opacity: 0.4,
  },
  ghostPressed: {
    opacity: 0.7,
  },
  ghostLabel: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  ghostLabelSelected: {
    color: "#000000",
  },
});
