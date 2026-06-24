/**
 * SettingsPage — App preferences and configuration.
 *
 * Visibility, speed units, discovery radius, account management.
 * Each row is tappable to toggle or navigate to a picker.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

export function SettingsPage() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Visibility */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="eye.fill"
            iconColor="#34C759"
            label="Visibility"
            value="On"
            hasChevron
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="location.circle.fill"
            iconColor="#007AFF"
            label="Discovery Radius"
            value="25 mi"
            hasChevron
          />
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="speedometer"
            iconColor="#FF9500"
            label="Speed Unit"
            value="mph"
            hasChevron
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="moon.fill"
            iconColor="#AF52DE"
            label="Map Style"
            value="Auto"
            hasChevron
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="bell.fill"
            iconColor="#FF3B30"
            label="Notifications"
            value="On"
            hasChevron
          />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="person.text.rectangle.fill"
            iconColor="#8E8E93"
            label="Username"
            value="@username"
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="envelope.fill"
            iconColor="#8E8E93"
            label="Email"
            value="user@email.com"
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="key.fill"
            iconColor="#8E8E93"
            label="Change Password"
            hasChevron
          />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="info.circle.fill"
            iconColor="#8E8E93"
            label="Version"
            value="1.0.0"
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="doc.text.fill"
            iconColor="#8E8E93"
            label="Terms of Service"
            hasChevron
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="hand.raised.fill"
            iconColor="#8E8E93"
            label="Privacy Policy"
            hasChevron
          />
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
}: {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  hasChevron?: boolean;
}) {
  return (
    <Pressable style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <SymbolView name={icon as any} tintColor={iconColor} size={16} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {hasChevron && (
        <SymbolView name="chevron.right" tintColor="#48484A" size={12} />
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
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
  },
  rowValue: {
    fontSize: 15,
    color: "#8E8E93",
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
