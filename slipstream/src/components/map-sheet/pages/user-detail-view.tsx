import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSheetColors } from "@/hooks/use-sheet-colors";
import { useUserProfile } from "@/hooks/queries/use-user-profile";
import { useRemoveFriend } from "@/hooks/queries/use-friends";
import { useConvoyState } from "@/hooks/queries/use-convoy";
import { useDriversStore } from "@/stores/drivers-store";
import { formatCarName } from "@/lib/format";
import type { PublicUserProfile } from "@/lib/api/types.gen";

interface UserDetailViewProps {
  userId: string;
  onBack: () => void;
}

export function UserDetailView({ userId, onBack }: UserDetailViewProps) {
  const colors = useSheetColors();
  const { data: user, isLoading } = useUserProfile(userId);
  const removeFriend = useRemoveFriend();
  const { convoy, invite } = useConvoyState();
  const driverIds = useDriversStore((s) => s.driverIds);

  const isOnline = driverIds.has(userId);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backButton} onPress={onBack}>
        <SymbolView name="chevron.left" tintColor="#007AFF" size={16} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
            <SymbolView name="person.fill" tintColor={colors.textTertiary} size={32} />
          </View>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#34C759" : "#48484A", borderColor: colors.borderSubtle }]} />
        </View>
        <Text style={[styles.displayName, { color: colors.textPrimary }]}>
          {user.display_name ?? user.username}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          @{user.username}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: isOnline ? "rgba(52, 199, 89, 0.12)" : colors.cardBackground }]}>
          <View style={[styles.statusDotSmall, { backgroundColor: isOnline ? "#34C759" : "#8E8E93" }]} />
          <Text style={[styles.statusText, { color: isOnline ? "#34C759" : colors.textSecondary }]}>
            {isOnline ? "Driving Now" : "Offline"}
          </Text>
        </View>
      </View>

      {user.active_car && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Active Car</Text>
          <View style={[styles.carCard, { backgroundColor: colors.cardBackgroundElevated }]}>
            <View style={styles.carIcon}>
              <SymbolView name="car.fill" tintColor="#57C7FF" size={22} />
            </View>
            <View style={styles.carInfo}>
              <Text style={[styles.carName, { color: colors.textPrimary }]}>
                {formatCarName(user.active_car)}
              </Text>
              <Text style={[styles.carColor, { color: colors.textSecondary }]}>
                {user.active_car.color}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        {convoy && (
          <Pressable
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => invite.mutate(userId)}
            disabled={invite.isPending}
          >
            <SymbolView name="person.badge.plus" tintColor="#FFFFFF" size={16} />
            <Text style={styles.actionButtonPrimaryText}>Invite to Convoy</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionButton, { backgroundColor: "rgba(255, 59, 48, 0.08)" }]}
          onPress={() => {
            removeFriend.mutate(userId);
            onBack();
          }}
        >
          <SymbolView name="person.badge.minus" tintColor="#FF3B30" size={16} />
          <Text style={styles.removeText}>Remove Friend</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  errorText: {
    fontSize: 15,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  username: {
    fontSize: 15,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
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
  actions: {
    gap: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionButtonPrimary: {
    backgroundColor: "#007AFF",
  },
  actionButtonPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  removeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
