import { useColorScheme } from "@/hooks/use-color-scheme";

const sheetColors = {
  light: {
    textPrimary: "#000000",
    textSecondary: "#6B6B6B",
    textTertiary: "#8E8E93",
    cardBackground: "rgba(0, 0, 0, 0.03)",
    cardBackgroundElevated: "rgba(0, 0, 0, 0.04)",
    separator: "rgba(0, 0, 0, 0.06)",
    separatorLight: "rgba(0, 0, 0, 0.04)",
    tabHighlight: "rgba(0, 0, 0, 0.06)",
    tabSeparator: "rgba(0, 0, 0, 0.1)",
    avatarBackground: "rgba(0, 0, 0, 0.05)",
    borderSubtle: "rgba(255, 255, 255, 0.8)",
    chevron: "#48484A",
  },
  dark: {
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0A5",
    textTertiary: "#8E8E93",
    cardBackground: "rgba(255, 255, 255, 0.06)",
    cardBackgroundElevated: "rgba(255, 255, 255, 0.08)",
    separator: "rgba(255, 255, 255, 0.08)",
    separatorLight: "rgba(255, 255, 255, 0.05)",
    tabHighlight: "rgba(255, 255, 255, 0.1)",
    tabSeparator: "rgba(255, 255, 255, 0.12)",
    avatarBackground: "rgba(255, 255, 255, 0.08)",
    borderSubtle: "rgba(0, 0, 0, 0.3)",
    chevron: "#A0A0A5",
  },
};

export type SheetColors = typeof sheetColors.light;

export function useSheetColors(): SheetColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? sheetColors.dark : sheetColors.light;
}
