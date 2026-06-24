import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";

export function ConvoyPage() {
  const colors = useSheetColors();
  const inConvoy = false;

  if (!inConvoy) {
    return <ConvoyEmpty colors={colors} />;
  }

  return <ConvoyLobby colors={colors} />;
}

function ConvoyEmpty({ colors }: { colors: ReturnType<typeof useSheetColors> }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="car.2.fill" tintColor={colors.textTertiary} size={40} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Convoy</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Start a convoy to drive together with friends in real-time.
      </Text>

      <Pressable style={styles.createButton}>
        <SymbolView name="plus" tintColor="#FFFFFF" size={18} />
        <Text style={styles.createButtonText}>Start a Convoy</Text>
      </Pressable>

      <Pressable style={styles.joinButton}>
        <Text style={styles.joinButtonText}>Browse Nearby Convoys</Text>
      </Pressable>
    </View>
  );
}

function ConvoyLobby({ colors }: { colors: ReturnType<typeof useSheetColors> }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Convoy Header */}
      <View style={styles.lobbyHeader}>
        <View style={styles.lobbyTitleRow}>
          <Text style={[styles.lobbyTitle, { color: colors.textPrimary }]}>PCH Sunset Cruise</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>ACTIVE</Text>
          </View>
        </View>
        <Text style={[styles.lobbySubtitle, { color: colors.textSecondary }]}>
          4 members · Started 12 min ago
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickAction icon="hand.raised.fill" label="Pull Over" color="#FF9500" colors={colors} />
        <QuickAction icon="fuelpump.fill" label="Gas Stop" color="#34C759" colors={colors} />
        <QuickAction icon="tortoise.fill" label="Slow Down" color="#FF3B30" colors={colors} />
        <QuickAction icon="arrow.triangle.merge" label="Regroup" color="#007AFF" colors={colors} />
      </View>

      {/* Members */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Members</Text>
        <View style={[styles.memberList, { backgroundColor: colors.cardBackground }]}>
          <MemberRow name="You" car="2024 GT-R" role="leader" colors={colors} />
          <MemberRow name="Mike Chen" car="M4 Competition" role="member" colors={colors} />
          <MemberRow name="Sarah Kim" car="911 GT3 RS" role="member" colors={colors} />
          <MemberRow name="Alex Rivera" car="GR Supra" role="member" colors={colors} />
        </View>
      </View>

      {/* Chat Entry */}
      <Pressable style={styles.chatButton}>
        <SymbolView name="bubble.left.fill" tintColor="#007AFF" size={18} />
        <Text style={styles.chatButtonText}>Open Chat</Text>
        <View style={styles.chatBadge}>
          <Text style={styles.chatBadgeText}>3</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

function QuickAction({
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
    <Pressable style={styles.quickActionButton}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
        <SymbolView name={icon as any} tintColor={color} size={18} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function MemberRow({
  name,
  car,
  role,
  colors,
}: {
  name: string;
  car: string;
  role: "leader" | "member";
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={16} />
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={[styles.memberName, { color: colors.textPrimary }]}>{name}</Text>
          {role === "leader" && (
            <SymbolView name="crown.fill" tintColor="#FFD60A" size={12} />
          )}
        </View>
        <Text style={[styles.memberCar, { color: colors.textSecondary }]}>{car}</Text>
      </View>
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
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
    width: "100%",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  joinButton: {
    paddingVertical: 12,
    marginTop: 4,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#007AFF",
  },
  lobbyHeader: {
    marginBottom: 20,
  },
  lobbyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lobbyTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  statusBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#34C759",
    letterSpacing: 0.5,
  },
  lobbySubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  quickActionButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  memberList: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
  },
  memberCar: {
    fontSize: 13,
    marginTop: 1,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },
  chatBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  chatBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
