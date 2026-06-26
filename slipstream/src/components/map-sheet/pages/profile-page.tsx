import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";
import { useAuth } from "@/contexts/auth-context";
import { useProfile } from "@/hooks/queries/use-profile";
import { useCars, useActivateCar } from "@/hooks/queries/use-cars";
import { useFriends } from "@/hooks/queries/use-friends";
import { formatCarName } from "@/lib/format";
import type { CarResponse } from "@/lib/api/types.gen";

export function ProfilePage() {
  const colors = useSheetColors();
  const { logout } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: cars, isLoading: carsLoading } = useCars();
  const { data: friends } = useFriends();
  const activateCar = useActivateCar();

  if (profileLoading || carsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activeCar = cars?.find((c) => c.is_active);
  const displayCars = cars?.slice(0, 3) ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
            <SymbolView name="person.fill" tintColor={colors.textTertiary} size={32} />
          </View>
        </View>
        <Text style={[styles.displayName, { color: colors.textPrimary }]}>
          {profile?.display_name ?? profile?.username ?? "Driver"}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          @{profile?.username}
        </Text>
      </View>

      {activeCar && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Active Car</Text>
          <View style={[styles.carCard, { backgroundColor: colors.cardBackgroundElevated }]}>
            <View style={styles.carIcon}>
              <SymbolView name="car.fill" tintColor="#57C7FF" size={22} />
            </View>
            <View style={styles.carInfo}>
              <Text style={[styles.carName, { color: colors.textPrimary }]}>
                {formatCarName(activeCar)}
              </Text>
              <Text style={[styles.carColor, { color: colors.textSecondary }]}>
                {activeCar.color}
              </Text>
            </View>
          </View>
        </View>
      )}

      {displayCars.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Garage</Text>
            {(cars?.length ?? 0) > 3 && (
              <Pressable>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.garageGrid}>
            {displayCars.map((car) => (
              <GarageSlot
                key={car.id}
                car={car}
                colors={colors}
                onPress={() => {
                  if (!car.is_active) activateCar.mutate(car.id);
                }}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Stats</Text>
        <View style={styles.statsRow}>
          <StatCard value={String(friends?.length ?? 0)} label="Friends" colors={colors} />
          <StatCard value="--" label="Drives" colors={colors} />
          <StatCard value="--" label="Convoys" colors={colors} />
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <SymbolView name="rectangle.portrait.and.arrow.right" tintColor="#FF3B30" size={16} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function GarageSlot({
  car,
  colors,
  onPress,
}: {
  car: CarResponse;
  colors: ReturnType<typeof useSheetColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.garageSlot, { backgroundColor: colors.cardBackground }, car.is_active && styles.garageSlotActive]}
      onPress={onPress}
    >
      <SymbolView
        name="car.side.fill"
        tintColor={car.is_active ? "#57C7FF" : colors.textTertiary}
        size={20}
      />
      <Text
        style={[styles.garageCarName, { color: colors.textSecondary }, car.is_active && styles.garageCarNameActive]}
        numberOfLines={1}
      >
        {formatCarName(car)}
      </Text>
    </Pressable>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
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
