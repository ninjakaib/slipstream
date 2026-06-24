import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";

export function DiscoverPage() {
  const colors = useSheetColors();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="magnifyingglass" tintColor={colors.textTertiary} size={16} />
        <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>
          Search places or drivers...
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickActionCard icon="plus.circle.fill" label="Start Convoy" color="#34C759" colors={colors} />
        <QuickActionCard icon="road.lanes" label="Find Drives" color="#007AFF" colors={colors} />
        <QuickActionCard icon="mappin.circle.fill" label="Set Destination" color="#FF9500" colors={colors} />
      </View>

      {/* Nearby Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Nearby Now</Text>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <NearbyDriverRow username="@mikeGTR" car="2024 Nissan GT-R" distance="0.4 mi" status="driving" colors={colors} />
          <View style={[styles.rowSeparator, { backgroundColor: colors.separator }]} />
          <NearbyDriverRow username="@sarahM4" car="2024 BMW M4" distance="1.2 mi" status="parked" colors={colors} />
          <View style={[styles.rowSeparator, { backgroundColor: colors.separator }]} />
          <NearbyDriverRow username="@alexRS" car="2022 Porsche 911" distance="2.8 mi" status="driving" colors={colors} />
        </View>
      </View>

      {/* Popular Drives */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Popular Drives</Text>
        <View style={styles.driveCards}>
          <DriveCard title="Pacific Coast Highway" subtitle="Malibu → Santa Barbara" distance="92 mi" colors={colors} />
          <DriveCard title="Mulholland Drive" subtitle="Hollywood → Calabasas" distance="21 mi" colors={colors} />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickActionCard({
  icon,
  label,
  color,
  colors,
}: {
  icon: string;
  label: string;
  color: string;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <Pressable style={[styles.actionCard, { backgroundColor: colors.cardBackgroundElevated }]}>
      <SymbolView name={icon as any} tintColor={color} size={24} />
      <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function NearbyDriverRow({
  username,
  car,
  distance,
  status,
  colors,
}: {
  username: string;
  car: string;
  distance: string;
  status: "driving" | "parked";
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <View style={styles.driverRow}>
      <View style={[styles.statusDot, status === "driving" ? styles.dotDriving : styles.dotParked]} />
      <View style={styles.driverInfo}>
        <Text style={[styles.driverUsername, { color: colors.textPrimary }]}>{username}</Text>
        <Text style={[styles.driverCar, { color: colors.textSecondary }]}>{car}</Text>
      </View>
      <Text style={[styles.driverDistance, { color: colors.textSecondary }]}>{distance}</Text>
    </View>
  );
}

function DriveCard({
  title,
  subtitle,
  distance,
  colors,
}: {
  title: string;
  subtitle: string;
  distance: string;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <Pressable style={[styles.driveCard, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.driveIcon}>
        <SymbolView name="road.lanes" tintColor="#007AFF" size={20} />
      </View>
      <View style={styles.driveInfo}>
        <Text style={[styles.driveTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.driveSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.driveDistance, { color: colors.textSecondary }]}>{distance}</Text>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchPlaceholder: {
    fontSize: 16,
    flex: 1,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotDriving: {
    backgroundColor: "#34C759",
  },
  dotParked: {
    backgroundColor: "#FF9500",
  },
  driverInfo: {
    flex: 1,
  },
  driverUsername: {
    fontSize: 15,
    fontWeight: "600",
  },
  driverCar: {
    fontSize: 13,
    marginTop: 2,
  },
  driverDistance: {
    fontSize: 13,
    fontWeight: "500",
  },
  driveCards: {
    gap: 10,
  },
  driveCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  driveIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  driveInfo: {
    flex: 1,
  },
  driveTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  driveSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  driveDistance: {
    fontSize: 13,
    fontWeight: "500",
  },
});
