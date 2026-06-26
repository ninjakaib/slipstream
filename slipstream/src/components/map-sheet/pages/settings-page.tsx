import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";
import { useAuth } from "@/contexts/auth-context";
import { useProfile, useUpdateProfile } from "@/hooks/queries/use-profile";
import { deleteAccount } from "@/lib/api/sdk.gen";
import type { VisibilityMode } from "@/lib/api/types.gen";

const VISIBILITY_CYCLE: VisibilityMode[] = ["on", "friends_only", "ghost"];
const VISIBILITY_LABELS: Record<VisibilityMode, string> = {
  on: "Everyone",
  friends_only: "Friends Only",
  ghost: "Ghost",
};

export function SettingsPage() {
  const colors = useSheetColors();
  const { logout } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const cycleVisibility = () => {
    if (!profile) return;
    const currentIndex = VISIBILITY_CYCLE.indexOf(profile.visibility);
    const next = VISIBILITY_CYCLE[(currentIndex + 1) % VISIBILITY_CYCLE.length];
    updateProfile.mutate({ visibility: next });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteAccount();
            await logout();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Privacy</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow
            icon="eye.fill"
            iconColor="#34C759"
            label="Visibility"
            value={VISIBILITY_LABELS[profile?.visibility ?? "on"]}
            onPress={cycleVisibility}
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow
            icon="person.text.rectangle.fill"
            iconColor="#8E8E93"
            label="Username"
            value={`@${profile?.username ?? ""}`}
            colors={colors}
          />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow
            icon="envelope.fill"
            iconColor="#8E8E93"
            label="Email"
            value={profile?.email ?? "Not set"}
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow
            icon="info.circle.fill"
            iconColor="#8E8E93"
            label="Version"
            value="1.0.0"
            colors={colors}
          />
        </View>
      </View>

      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteText}>Delete Account</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  colors,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <SymbolView name={icon as any} tintColor={iconColor} size={16} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {onPress && (
        <SymbolView name="chevron.right" tintColor={colors.chevron} size={12} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 10,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.06)",
    marginTop: 8,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FF3B30",
  },
});
