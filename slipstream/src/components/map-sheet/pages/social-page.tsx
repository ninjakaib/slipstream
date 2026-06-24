import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";

export function SocialPage() {
  const colors = useSheetColors();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with search action */}
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Friends</Text>
        <Pressable style={styles.addButton} accessibilityLabel="Find friends">
          <SymbolView name="person.badge.plus" tintColor="#007AFF" size={20} />
        </Pressable>
      </View>

      {/* Friend Requests Banner */}
      <Pressable style={[styles.requestsBanner, { backgroundColor: colors.cardBackgroundElevated }]}>
        <View style={styles.requestsBadge}>
          <Text style={styles.requestsBadgeText}>2</Text>
        </View>
        <Text style={[styles.requestsText, { color: colors.textPrimary }]}>Friend Requests</Text>
        <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={14} />
      </Pressable>

      {/* Online Friends */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Online — 3</Text>
        <View style={styles.friendsList}>
          <FriendRow username="mikeGTR" displayName="Mike Chen" car="2024 GT-R NISMO" status="driving" colors={colors} />
          <FriendRow username="sarahM4" displayName="Sarah Kim" car="2024 M4 Competition" status="parked" colors={colors} />
          <FriendRow username="alexRS" displayName="Alex Rivera" car="2022 911 GT3 RS" status="driving" colors={colors} />
        </View>
      </View>

      {/* Offline Friends */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Offline</Text>
        <View style={styles.friendsList}>
          <FriendRow username="jayZ4M" displayName="Jay Martinez" car="2023 BMW Z4 M" status="offline" colors={colors} />
          <FriendRow username="devSupra" displayName="Dev Patel" car="2024 GR Supra" status="offline" colors={colors} />
        </View>
      </View>
    </ScrollView>
  );
}

function FriendRow({
  displayName,
  car,
  status,
  colors,
}: {
  username: string;
  displayName: string;
  car: string;
  status: "driving" | "parked" | "offline";
  colors: ReturnType<typeof useSheetColors>;
}) {
  const statusColor =
    status === "driving"
      ? "#34C759"
      : status === "parked"
        ? "#FF9500"
        : "#48484A";

  const statusLabel =
    status === "driving"
      ? "Driving"
      : status === "parked"
        ? "Parked"
        : "Offline";

  return (
    <Pressable style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={18} />
        <View style={[styles.friendStatusDot, { backgroundColor: statusColor, borderColor: colors.borderSubtle }]} />
      </View>

      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]}>{displayName}</Text>
        <Text style={[styles.friendMeta, { color: colors.textSecondary }]}>
          {car} · {statusLabel}
        </Text>
      </View>

      {status !== "offline" && (
        <SymbolView name="location.fill" tintColor={statusColor} size={14} />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  requestsBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  requestsBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  requestsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  requestsText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
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
  friendsList: {
    gap: 4,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  friendStatusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "600",
  },
  friendMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
