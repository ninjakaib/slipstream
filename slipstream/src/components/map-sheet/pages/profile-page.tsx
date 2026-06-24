import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";

export function ProfilePage() {
  const colors = useSheetColors();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
            <SymbolView name="person.fill" tintColor={colors.textTertiary} size={32} />
          </View>
          <Pressable style={[styles.editAvatarButton, { borderColor: colors.borderSubtle }]}>
            <SymbolView name="camera.fill" tintColor="#FFFFFF" size={10} />
          </Pressable>
        </View>
        <Text style={[styles.displayName, { color: colors.textPrimary }]}>Driver</Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>@username</Text>
      </View>

      {/* Active Car Card */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Active Car</Text>
        <Pressable style={[styles.carCard, { backgroundColor: colors.cardBackgroundElevated }]}>
          <View style={styles.carIcon}>
            <SymbolView name="car.fill" tintColor="#57C7FF" size={22} />
          </View>
          <View style={styles.carInfo}>
            <Text style={[styles.carName, { color: colors.textPrimary }]}>2024 Nissan GT-R NISMO</Text>
            <Text style={[styles.carColor, { color: colors.textSecondary }]}>Pearl White · 600 HP</Text>
          </View>
          <SymbolView name="chevron.right" tintColor={colors.chevron} size={14} />
        </Pressable>
      </View>

      {/* Garage */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Garage</Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.garageGrid}>
          <GarageSlot car="2024 GT-R NISMO" active colors={colors} />
          <GarageSlot car="1999 Skyline R34" colors={colors} />
          <GarageSlot colors={colors} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Stats</Text>
        <View style={styles.statsRow}>
          <StatCard value="12" label="Drives" colors={colors} />
          <StatCard value="8" label="Friends" colors={colors} />
          <StatCard value="3" label="Convoys" colors={colors} />
        </View>
      </View>

      {/* Log Out */}
      <Pressable style={styles.logoutButton}>
        <SymbolView name="rectangle.portrait.and.arrow.right" tintColor="#FF3B30" size={16} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function GarageSlot({ car, active, colors }: { car?: string; active?: boolean; colors: ReturnType<typeof useSheetColors> }) {
  return (
    <View style={[styles.garageSlot, { backgroundColor: colors.cardBackground }, active && styles.garageSlotActive]}>
      {car ? (
        <>
          <SymbolView
            name="car.side.fill"
            tintColor={active ? "#57C7FF" : colors.textTertiary}
            size={20}
          />
          <Text style={[styles.garageCarName, { color: colors.textSecondary }, active && styles.garageCarNameActive]} numberOfLines={1}>
            {car}
          </Text>
        </>
      ) : (
        <>
          <SymbolView name="plus" tintColor={colors.chevron} size={20} />
          <Text style={[styles.garageAddText, { color: colors.chevron }]}>Add Car</Text>
        </>
      )}
    </View>
  );
}

function StatCard({ value, label, colors }: { value: string; label: string; colors: ReturnType<typeof useSheetColors> }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
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
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  displayName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  username: {
    fontSize: 15,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "500",
    color: "#007AFF",
    marginBottom: 10,
  },
  carCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  carIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(87, 199, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  carInfo: {
    flex: 1,
  },
  carName: {
    fontSize: 15,
    fontWeight: "600",
  },
  carColor: {
    fontSize: 13,
    marginTop: 2,
  },
  garageGrid: {
    flexDirection: "row",
    gap: 10,
  },
  garageSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  garageSlotActive: {
    borderColor: "rgba(87, 199, 255, 0.3)",
    backgroundColor: "rgba(87, 199, 255, 0.06)",
  },
  garageCarName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  garageCarNameActive: {
    color: "#57C7FF",
  },
  garageAddText: {
    fontSize: 11,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.08)",
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
