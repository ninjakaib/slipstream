/**
 * DiscoverPage — the default "home" page of the sheet.
 *
 * Shows a search bar, quick actions (Start Convoy, Find Drives),
 * and recommendations for nearby drives/destinations.
 * This is what the user sees when they first pull up the sheet.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

export function DiscoverPage() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <SymbolView name="magnifyingglass" tintColor="#8E8E93" size={16} />
        <Text style={styles.searchPlaceholder}>Search places or drivers...</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="plus.circle.fill"
          label="Start Convoy"
          color="#34C759"
        />
        <QuickActionCard
          icon="road.lanes"
          label="Find Drives"
          color="#007AFF"
        />
        <QuickActionCard
          icon="mappin.circle.fill"
          label="Set Destination"
          color="#FF9500"
        />
      </View>

      {/* Nearby Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nearby Now</Text>
        <View style={styles.card}>
          <NearbyDriverRow
            username="@mikeGTR"
            car="2024 Nissan GT-R"
            distance="0.4 mi"
            status="driving"
          />
          <View style={styles.rowSeparator} />
          <NearbyDriverRow
            username="@sarahM4"
            car="2024 BMW M4"
            distance="1.2 mi"
            status="parked"
          />
          <View style={styles.rowSeparator} />
          <NearbyDriverRow
            username="@alexRS"
            car="2022 Porsche 911"
            distance="2.8 mi"
            status="driving"
          />
        </View>
      </View>

      {/* Popular Drives */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Drives</Text>
        <View style={styles.driveCards}>
          <DriveCard
            title="Pacific Coast Highway"
            subtitle="Malibu → Santa Barbara"
            distance="92 mi"
          />
          <DriveCard
            title="Mulholland Drive"
            subtitle="Hollywood → Calabasas"
            distance="21 mi"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickActionCard({
  icon,
  label,
  color,
}: {
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <Pressable style={styles.actionCard}>
      <SymbolView name={icon as any} tintColor={color} size={24} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function NearbyDriverRow({
  username,
  car,
  distance,
  status,
}: {
  username: string;
  car: string;
  distance: string;
  status: "driving" | "parked";
}) {
  return (
    <View style={styles.driverRow}>
      <View style={[styles.statusDot, status === "driving" ? styles.dotDriving : styles.dotParked]} />
      <View style={styles.driverInfo}>
        <Text style={styles.driverUsername}>{username}</Text>
        <Text style={styles.driverCar}>{car}</Text>
      </View>
      <Text style={styles.driverDistance}>{distance}</Text>
    </View>
  );
}

function DriveCard({
  title,
  subtitle,
  distance,
}: {
  title: string;
  subtitle: string;
  distance: string;
}) {
  return (
    <Pressable style={styles.driveCard}>
      <View style={styles.driveIcon}>
        <SymbolView name="road.lanes" tintColor="#007AFF" size={20} />
      </View>
      <View style={styles.driveInfo}>
        <Text style={styles.driveTitle}>{title}</Text>
        <Text style={styles.driveSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.driveDistance}>{distance}</Text>
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
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: "#8E8E93",
    flex: 1,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
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
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
    color: "#FFFFFF",
  },
  driverCar: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  driverDistance: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  driveCards: {
    gap: 10,
  },
  driveCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
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
    color: "#FFFFFF",
  },
  driveSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  driveDistance: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
});
