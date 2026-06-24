/**
 * ProfilePage — User profile summary with avatar, car, and stats.
 *
 * Quick view of the user's identity — their display name, username,
 * active car, and garage overview. Tapping sections navigates to
 * full edit flows (future).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

export function ProfilePage() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <SymbolView name="person.fill" tintColor="#8E8E93" size={32} />
          </View>
          <Pressable style={styles.editAvatarButton}>
            <SymbolView name="camera.fill" tintColor="#FFFFFF" size={10} />
          </Pressable>
        </View>
        <Text style={styles.displayName}>Driver</Text>
        <Text style={styles.username}>@username</Text>
      </View>

      {/* Active Car Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Car</Text>
        <Pressable style={styles.carCard}>
          <View style={styles.carIcon}>
            <SymbolView name="car.fill" tintColor="#57C7FF" size={22} />
          </View>
          <View style={styles.carInfo}>
            <Text style={styles.carName}>2024 Nissan GT-R NISMO</Text>
            <Text style={styles.carColor}>Pearl White · 600 HP</Text>
          </View>
          <SymbolView name="chevron.right" tintColor="#48484A" size={14} />
        </Pressable>
      </View>

      {/* Garage */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Garage</Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.garageGrid}>
          <GarageSlot car="2024 GT-R NISMO" active />
          <GarageSlot car="1999 Skyline R34" />
          <GarageSlot />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statsRow}>
          <StatCard value="12" label="Drives" />
          <StatCard value="8" label="Friends" />
          <StatCard value="3" label="Convoys" />
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

function GarageSlot({ car, active }: { car?: string; active?: boolean }) {
  return (
    <View style={[styles.garageSlot, active && styles.garageSlotActive]}>
      {car ? (
        <>
          <SymbolView
            name="car.side.fill"
            tintColor={active ? "#57C7FF" : "#8E8E93"}
            size={20}
          />
          <Text style={[styles.garageCarName, active && styles.garageCarNameActive]} numberOfLines={1}>
            {car}
          </Text>
        </>
      ) : (
        <>
          <SymbolView name="plus" tintColor="#48484A" size={20} />
          <Text style={styles.garageAddText}>Add Car</Text>
        </>
      )}
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
    borderColor: "rgba(28, 28, 30, 0.9)",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  username: {
    fontSize: 15,
    color: "#8E8E93",
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
    color: "#8E8E93",
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
    backgroundColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
  },
  carColor: {
    fontSize: 13,
    color: "#8E8E93",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
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
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  garageCarNameActive: {
    color: "#57C7FF",
  },
  garageAddText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#48484A",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
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
