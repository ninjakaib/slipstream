import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";

export function SettingsPage() {
  const colors = useSheetColors();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Settings</Text>

      {/* Visibility */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Privacy</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow icon="eye.fill" iconColor="#34C759" label="Visibility" value="On" hasChevron colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="location.circle.fill" iconColor="#007AFF" label="Discovery Radius" value="25 mi" hasChevron colors={colors} />
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow icon="speedometer" iconColor="#FF9500" label="Speed Unit" value="mph" hasChevron colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="moon.fill" iconColor="#AF52DE" label="Map Style" value="Auto" hasChevron colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="bell.fill" iconColor="#FF3B30" label="Notifications" value="On" hasChevron colors={colors} />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow icon="person.text.rectangle.fill" iconColor="#8E8E93" label="Username" value="@username" colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="envelope.fill" iconColor="#8E8E93" label="Email" value="user@email.com" colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="key.fill" iconColor="#8E8E93" label="Change Password" hasChevron colors={colors} />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <SettingsRow icon="info.circle.fill" iconColor="#8E8E93" label="Version" value="1.0.0" colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="doc.text.fill" iconColor="#8E8E93" label="Terms of Service" hasChevron colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.separatorLight }]} />
          <SettingsRow icon="hand.raised.fill" iconColor="#8E8E93" label="Privacy Policy" hasChevron colors={colors} />
        </View>
      </View>

      {/* Danger Zone */}
      <Pressable style={styles.deleteButton}>
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
  hasChevron,
  colors,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  hasChevron?: boolean;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <Pressable style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <SymbolView name={icon as any} tintColor={iconColor} size={16} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {hasChevron && (
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
