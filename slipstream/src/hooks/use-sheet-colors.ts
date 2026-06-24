import { Platform, PlatformColor } from "react-native";

const iosColors = {
  textPrimary: PlatformColor("label"),
  textSecondary: PlatformColor("secondaryLabel"),
  textTertiary: PlatformColor("tertiaryLabel"),
  cardBackground: PlatformColor("tertiarySystemFill"),
  cardBackgroundElevated: PlatformColor("secondarySystemFill"),
  separator: PlatformColor("separator"),
  separatorLight: PlatformColor("separator"),
  tabHighlight: PlatformColor("systemFill"),
  tabSeparator: PlatformColor("separator"),
  avatarBackground: PlatformColor("quaternarySystemFill"),
  borderSubtle: PlatformColor("separator"),
  chevron: PlatformColor("tertiaryLabel"),
};

const fallbackLight = {
  textPrimary: "#000000",
  textSecondary: "#6B6B6B",
  textTertiary: "#8E8E93",
  cardBackground: "rgba(0, 0, 0, 0.03)",
  cardBackgroundElevated: "rgba(0, 0, 0, 0.05)",
  separator: "rgba(0, 0, 0, 0.08)",
  separatorLight: "rgba(0, 0, 0, 0.04)",
  tabHighlight: "rgba(0, 0, 0, 0.06)",
  tabSeparator: "rgba(0, 0, 0, 0.1)",
  avatarBackground: "rgba(0, 0, 0, 0.05)",
  borderSubtle: "rgba(0, 0, 0, 0.1)",
  chevron: "#48484A",
};

export type SheetColors = typeof fallbackLight;

export function useSheetColors(): SheetColors {
  if (Platform.OS === "ios") {
    return iosColors as unknown as SheetColors;
  }
  return fallbackLight;
}
