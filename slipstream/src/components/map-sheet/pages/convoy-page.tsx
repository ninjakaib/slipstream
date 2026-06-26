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
import { useAuth } from "@/contexts/auth-context";
import { useConvoyState } from "@/hooks/queries/use-convoy";
import { useFriends } from "@/hooks/queries/use-friends";
import { formatCarName } from "@/lib/format";
import type { ConvoyMemberOut, FriendProfile } from "@/lib/api/types.gen";

export function ConvoyPage() {
  const colors = useSheetColors();
  const {
    convoy,
    isLoading,
    isLeader,
    create,
    leave,
    end,
    invite,
    setGroupRoute,
  } = useConvoyState();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!convoy) {
    return <ConvoyEmpty colors={colors} onCreate={() => create.mutate(undefined)} creating={create.isPending} />;
  }

  return (
    <ConvoyLobby
      convoy={convoy}
      isLeader={isLeader}
      colors={colors}
      onLeave={() => leave.mutate()}
      onEnd={() => end.mutate()}
      onInvite={(userId) => invite.mutate(userId)}
      onSetRoute={(name, lat, lng) =>
        setGroupRoute.mutate({ destination_name: name, destination_lat: lat, destination_lng: lng })
      }
    />
  );
}

function ConvoyEmpty({
  colors,
  onCreate,
  creating,
}: {
  colors: ReturnType<typeof useSheetColors>;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="car.2.fill" tintColor={colors.textTertiary} size={40} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Convoy</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Start a convoy to drive together with friends in real-time.
      </Text>

      <Pressable style={styles.createButton} onPress={onCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <SymbolView name="plus" tintColor="#FFFFFF" size={18} />
            <Text style={styles.createButtonText}>Start a Convoy</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function ConvoyLobby({
  convoy,
  isLeader,
  colors,
  onLeave,
  onEnd,
  onInvite,
  onSetRoute,
}: {
  convoy: NonNullable<ReturnType<typeof useConvoyState>["convoy"]>;
  isLeader: boolean;
  colors: ReturnType<typeof useSheetColors>;
  onLeave: () => void;
  onEnd: () => void;
  onInvite: (userId: string) => void;
  onSetRoute: (name: string, lat: number, lng: number) => void;
}) {
  const { session } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.lobbyHeader}>
        <View style={styles.lobbyTitleRow}>
          <Text style={[styles.lobbyTitle, { color: colors.textPrimary }]}>{convoy.name}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{convoy.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.lobbySubtitle, { color: colors.textSecondary }]}>
          {convoy.member_count} {convoy.member_count === 1 ? "member" : "members"}
          {convoy.destination_name ? ` · → ${convoy.destination_name}` : ""}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.cardBackgroundElevated }]}
          onPress={() => setShowInvite(!showInvite)}
        >
          <SymbolView name="person.badge.plus" tintColor="#007AFF" size={18} />
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>Invite</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.cardBackgroundElevated }]}
          onPress={() => setShowRoute(!showRoute)}
        >
          <SymbolView name="map.fill" tintColor="#FF9500" size={18} />
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>Set Route</Text>
        </Pressable>
      </View>

      {showInvite && <InviteSection onInvite={onInvite} colors={colors} />}
      {showRoute && <RouteSection onSetRoute={onSetRoute} colors={colors} />}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Members</Text>
        <View style={[styles.memberList, { backgroundColor: colors.cardBackground }]}>
          {convoy.members?.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              isCurrentUser={member.user_id === session?.userId}
              colors={colors}
            />
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.leaveButton, isLeader && styles.endButton]}
        onPress={isLeader ? onEnd : onLeave}
      >
        <Text style={[styles.leaveButtonText, isLeader && styles.endButtonText]}>
          {isLeader ? "End Convoy" : "Leave Convoy"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function InviteSection({
  onInvite,
  colors,
}: {
  onInvite: (userId: string) => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const { data: friends } = useFriends();
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const handleInvite = (userId: string) => {
    onInvite(userId);
    setInvitedIds((prev) => new Set([...prev, userId]));
  };

  if (!friends || friends.length === 0) {
    return (
      <View style={styles.inviteSection}>
        <Text style={[styles.inviteEmpty, { color: colors.textSecondary }]}>
          No friends to invite yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.inviteSection}>
      {friends.map((friend) => (
        <InviteRow
          key={friend.id}
          friend={friend}
          invited={invitedIds.has(friend.id)}
          onInvite={() => handleInvite(friend.id)}
          colors={colors}
        />
      ))}
    </View>
  );
}

function InviteRow({
  friend,
  invited,
  onInvite,
  colors,
}: {
  friend: FriendProfile;
  invited: boolean;
  onInvite: () => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <View style={styles.inviteRow}>
      <View style={[styles.inviteAvatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={14} />
      </View>
      <Text style={[styles.inviteName, { color: colors.textPrimary }]} numberOfLines={1}>
        {friend.display_name ?? friend.username}
      </Text>
      <Pressable
        style={[styles.inviteButton, invited && styles.inviteButtonSent]}
        onPress={onInvite}
        disabled={invited}
      >
        <Text style={[styles.inviteButtonText, invited && styles.inviteButtonTextSent]}>
          {invited ? "Sent" : "Invite"}
        </Text>
      </Pressable>
    </View>
  );
}

function RouteSection({
  onSetRoute,
  colors,
}: {
  onSetRoute: (name: string, lat: number, lng: number) => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    // For now, use 0,0 coordinates — a proper implementation would use a place picker
    onSetRoute(name.trim(), 0, 0);
    setName("");
  };

  return (
    <View style={styles.routeSection}>
      <View style={[styles.routeInput, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="mappin" tintColor={colors.textTertiary} size={16} />
        <TextInput
          style={[styles.routeTextInput, { color: colors.textPrimary }]}
          placeholder="Destination name..."
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
      </View>
      <Pressable
        style={[styles.routeButton, !name.trim() && styles.routeButtonDisabled]}
        onPress={handleSubmit}
        disabled={!name.trim()}
      >
        <Text style={styles.routeButtonText}>Set</Text>
      </Pressable>
    </View>
  );
}

function MemberRow({
  member,
  isCurrentUser,
  colors,
}: {
  member: ConvoyMemberOut;
  isCurrentUser: boolean;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const carName =
    member.car_year && member.car_make && member.car_model
      ? formatCarName({ year: member.car_year, make: member.car_make, model: member.car_model })
      : null;

  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={16} />
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={[styles.memberName, { color: colors.textPrimary }]}>
            {isCurrentUser ? "You" : member.display_name ?? member.username}
          </Text>
          {member.role === "leader" && (
            <SymbolView name="crown.fill" tintColor="#FFD60A" size={12} />
          )}
        </View>
        {carName && (
          <Text style={[styles.memberCar, { color: colors.textSecondary }]}>{carName}</Text>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
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
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inviteSection: {
    marginBottom: 16,
    gap: 6,
  },
  inviteEmpty: {
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 12,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  inviteAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  inviteButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#007AFF",
  },
  inviteButtonSent: {
    backgroundColor: "rgba(142, 142, 147, 0.12)",
  },
  inviteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  inviteButtonTextSent: {
    color: "#8E8E93",
  },
  routeSection: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  routeInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeTextInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  routeButton: {
    backgroundColor: "#FF9500",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  routeButtonDisabled: {
    opacity: 0.4,
  },
  routeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
  leaveButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(142, 142, 147, 0.12)",
    marginTop: 8,
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
  },
  endButton: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  endButtonText: {
    color: "#FF3B30",
  },
});
