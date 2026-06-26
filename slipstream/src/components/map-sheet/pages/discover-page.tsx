import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";
import { useDriversStore } from "@/stores/drivers-store";
import { useUserSearch } from "@/hooks/queries/use-user-search";
import { useConvoyState } from "@/hooks/queries/use-convoy";
import type { UserSearchResult } from "@/lib/api/types.gen";

export function DiscoverPage() {
  const colors = useSheetColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const drivers = useDriversStore((s) => s.drivers);
  const { create: createConvoy } = useConvoyState();

  const { data: searchResults, isLoading: searching } = useUserSearch(debouncedQuery);
  const isSearching = searchQuery.length > 0;

  const driverList = Object.values(drivers).slice(0, 5);
  const nearbyCount = Object.keys(drivers).length;

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 300);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.searchBar, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="magnifyingglass" tintColor={colors.textTertiary} size={16} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search drivers..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(""); setDebouncedQuery(""); }}>
            <SymbolView name="xmark.circle.fill" tintColor={colors.textTertiary} size={18} />
          </Pressable>
        )}
      </View>

      {isSearching ? (
        <SearchResults results={searchResults} loading={searching} colors={colors} />
      ) : (
        <>
          <View style={styles.quickActions}>
            <QuickActionCard
              icon="plus.circle.fill"
              label="Start Convoy"
              color="#34C759"
              colors={colors}
              onPress={() => createConvoy.mutate(undefined)}
            />
            <QuickActionCard icon="road.lanes" label="Find Drives" color="#007AFF" colors={colors} />
            <QuickActionCard icon="mappin.circle.fill" label="Set Destination" color="#FF9500" colors={colors} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Nearby Now{nearbyCount > 0 ? ` — ${nearbyCount}` : ""}
            </Text>
            {driverList.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No drivers nearby. Check back when you're out driving.
                </Text>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                {driverList.map((driver, index) => (
                  <View key={driver.user_id}>
                    {index > 0 && <View style={[styles.rowSeparator, { backgroundColor: colors.separator }]} />}
                    <NearbyDriverRow driver={driver} colors={colors} />
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Popular Drives</Text>
            <View style={styles.driveCards}>
              <DriveCard title="Pacific Coast Highway" subtitle="Malibu → Santa Barbara" distance="92 mi" colors={colors} />
              <DriveCard title="Mulholland Drive" subtitle="Hollywood → Calabasas" distance="21 mi" colors={colors} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SearchResults({
  results,
  loading,
  colors,
}: {
  results: UserSearchResult[] | undefined;
  loading: boolean;
  colors: ReturnType<typeof useSheetColors>;
}) {
  if (loading) {
    return <ActivityIndicator style={styles.searchLoading} />;
  }

  if (!results || results.length === 0) {
    return (
      <Text style={[styles.noResults, { color: colors.textSecondary }]}>
        No users found
      </Text>
    );
  }

  return (
    <View style={styles.searchResultsList}>
      {results.map((user) => (
        <Pressable key={user.id} style={styles.searchResultRow}>
          <View style={[styles.searchAvatar, { backgroundColor: colors.avatarBackground }]}>
            <SymbolView name="person.fill" tintColor={colors.textTertiary} size={18} />
          </View>
          <View style={styles.searchInfo}>
            <Text style={[styles.searchName, { color: colors.textPrimary }]}>
              {user.display_name ?? user.username}
            </Text>
            <Text style={[styles.searchUsername, { color: colors.textSecondary }]}>
              @{user.username}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function QuickActionCard({
  icon,
  label,
  color,
  colors,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  colors: ReturnType<typeof useSheetColors>;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.actionCard, { backgroundColor: colors.cardBackgroundElevated }]} onPress={onPress}>
      <SymbolView name={icon as any} tintColor={color} size={24} />
      <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function NearbyDriverRow({
  driver,
  colors,
}: {
  driver: { user_id: string; status: string; speed: number };
  colors: ReturnType<typeof useSheetColors>;
}) {
  const isDriving = driver.status === "driving" || driver.speed > 0;

  return (
    <View style={styles.driverRow}>
      <View style={[styles.statusDot, isDriving ? styles.dotDriving : styles.dotParked]} />
      <View style={styles.driverInfo}>
        <Text style={[styles.driverUsername, { color: colors.textPrimary }]}>
          Driver
        </Text>
        <Text style={[styles.driverCar, { color: colors.textSecondary }]}>
          {isDriving ? `${Math.round(driver.speed)} mph` : "Parked"}
        </Text>
      </View>
      <Text style={[styles.driverDistance, { color: colors.textSecondary }]}>
        {isDriving ? "Driving" : "Parked"}
      </Text>
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
    paddingVertical: 10,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  searchLoading: {
    marginTop: 40,
  },
  noResults: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  searchResultsList: {
    gap: 4,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInfo: {
    flex: 1,
  },
  searchName: {
    fontSize: 15,
    fontWeight: "600",
  },
  searchUsername: {
    fontSize: 13,
    marginTop: 2,
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
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 16,
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
