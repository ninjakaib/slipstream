import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import {
  useConvoyState,
  useConvoyMessages,
  useSendConvoyMessage,
  useConvoyRoute,
} from "@/hooks/queries/use-convoy";
import { useFriends } from "@/hooks/queries/use-friends";
import { formatCarName } from "@/lib/format";
import type { ConvoyMemberOut, ConvoyMessageOut, FriendProfile } from "@/lib/api/types.gen";

type ConvoyTab = "members" | "chat" | "route";

export function ConvoyPage() {
  const colors = useSheetColors();
  const {
    convoy,
    isLoading,
    isLeader,
    convoyId,
    create,
    leave,
    end,
    invite,
    kick,
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
    <ConvoyActive
      convoy={convoy}
      convoyId={convoyId!}
      isLeader={isLeader}
      colors={colors}
      onLeave={() => {
        Alert.alert("Leave Convoy", "Are you sure you want to leave?", [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
        ]);
      }}
      onEnd={() => {
        Alert.alert("End Convoy", "This will end the convoy for all members.", [
          { text: "Cancel", style: "cancel" },
          { text: "End", style: "destructive", onPress: () => end.mutate() },
        ]);
      }}
      onInvite={(userId) => invite.mutate(userId)}
      onKick={(userId, name) => {
        Alert.alert("Kick Member", `Remove ${name} from the convoy?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Kick", style: "destructive", onPress: () => kick.mutate(userId) },
        ]);
      }}
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

function ConvoyActive({
  convoy,
  convoyId,
  isLeader,
  colors,
  onLeave,
  onEnd,
  onInvite,
  onKick,
  onSetRoute,
}: {
  convoy: NonNullable<ReturnType<typeof useConvoyState>["convoy"]>;
  convoyId: string;
  isLeader: boolean;
  colors: ReturnType<typeof useSheetColors>;
  onLeave: () => void;
  onEnd: () => void;
  onInvite: (userId: string) => void;
  onKick: (userId: string, name: string) => void;
  onSetRoute: (name: string, lat: number, lng: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<ConvoyTab>("members");

  return (
    <View style={styles.container}>
      <ConvoyHeader convoy={convoy} colors={colors} />

      <View style={styles.tabBar}>
        <TabButton label="Members" icon="person.2.fill" active={activeTab === "members"} onPress={() => setActiveTab("members")} colors={colors} />
        <TabButton label="Chat" icon="bubble.left.fill" active={activeTab === "chat"} onPress={() => setActiveTab("chat")} colors={colors} />
        <TabButton label="Route" icon="map.fill" active={activeTab === "route"} onPress={() => setActiveTab("route")} colors={colors} />
      </View>

      <View style={styles.tabContent}>
        {activeTab === "members" && (
          <MembersTab
            convoy={convoy}
            isLeader={isLeader}
            colors={colors}
            onInvite={onInvite}
            onKick={onKick}
          />
        )}
        {activeTab === "chat" && (
          <ChatTab convoyId={convoyId} colors={colors} />
        )}
        {activeTab === "route" && (
          <RouteTab convoyId={convoyId} colors={colors} onSetRoute={onSetRoute} />
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.footerButton, isLeader ? styles.endButtonStyle : styles.leaveButtonStyle]}
          onPress={isLeader ? onEnd : onLeave}
        >
          <SymbolView
            name={isLeader ? "xmark.circle.fill" : "arrow.left.circle.fill"}
            tintColor={isLeader ? "#FF3B30" : "#8E8E93"}
            size={16}
          />
          <Text style={[styles.footerButtonText, isLeader && styles.endButtonText]}>
            {isLeader ? "End Convoy" : "Leave Convoy"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConvoyHeader({
  convoy,
  colors,
}: {
  convoy: NonNullable<ReturnType<typeof useConvoyState>["convoy"]>;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerTop}>
        <View style={styles.headerTitle}>
          <Text style={[styles.convoyName, { color: colors.textPrimary }]}>{convoy.name}</Text>
          <View style={[styles.statusBadge, convoy.status === "active" && styles.statusBadgeActive]}>
            <Text style={[styles.statusBadgeText, convoy.status === "active" && styles.statusBadgeTextActive]}>
              {convoy.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {convoy.member_count} {convoy.member_count === 1 ? "member" : "members"}
          {convoy.destination_name ? ` · → ${convoy.destination_name}` : ""}
        </Text>
      </View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
  colors,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <SymbolView name={icon as any} tintColor={active ? "#007AFF" : colors.textTertiary} size={16} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function MembersTab({
  convoy,
  isLeader,
  colors,
  onInvite,
  onKick,
}: {
  convoy: NonNullable<ReturnType<typeof useConvoyState>["convoy"]>;
  isLeader: boolean;
  colors: ReturnType<typeof useSheetColors>;
  onInvite: (userId: string) => void;
  onKick: (userId: string, name: string) => void;
}) {
  const { session } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <ScrollView style={styles.tabScrollView} contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      <Pressable
        style={[styles.inviteToggle, { backgroundColor: colors.cardBackgroundElevated }]}
        onPress={() => setShowInvite(!showInvite)}
      >
        <SymbolView name="person.badge.plus" tintColor="#007AFF" size={18} />
        <Text style={[styles.inviteToggleText, { color: colors.textPrimary }]}>Invite Friends</Text>
        <SymbolView name={showInvite ? "chevron.up" : "chevron.down"} tintColor={colors.textTertiary} size={12} />
      </Pressable>

      {showInvite && <InviteSection onInvite={onInvite} convoy={convoy} colors={colors} />}

      <View style={styles.membersList}>
        {convoy.members?.map((member) => (
          <MemberRow
            key={member.user_id}
            member={member}
            isCurrentUser={member.user_id === session?.userId}
            isLeader={isLeader}
            colors={colors}
            onKick={() => onKick(member.user_id, member.display_name ?? member.username)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function InviteSection({
  onInvite,
  convoy,
  colors,
}: {
  onInvite: (userId: string) => void;
  convoy: NonNullable<ReturnType<typeof useConvoyState>["convoy"]>;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const { data: friends } = useFriends();
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const memberIds = new Set(convoy.members?.map((m) => m.user_id) ?? []);
  const availableFriends = friends?.filter((f) => !memberIds.has(f.id)) ?? [];

  const handleInvite = (userId: string) => {
    onInvite(userId);
    setInvitedIds((prev) => new Set([...prev, userId]));
  };

  if (availableFriends.length === 0) {
    return (
      <View style={styles.inviteSection}>
        <Text style={[styles.inviteEmpty, { color: colors.textSecondary }]}>
          {friends?.length === 0 ? "No friends to invite yet." : "All friends are already in the convoy."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.inviteSection}>
      {availableFriends.map((friend) => (
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

function MemberRow({
  member,
  isCurrentUser,
  isLeader,
  colors,
  onKick,
}: {
  member: ConvoyMemberOut;
  isCurrentUser: boolean;
  isLeader: boolean;
  colors: ReturnType<typeof useSheetColors>;
  onKick: () => void;
}) {
  const carName =
    member.car_year && member.car_make && member.car_model
      ? formatCarName({ year: member.car_year, make: member.car_make, model: member.car_model })
      : null;

  return (
    <View style={[styles.memberRow, { backgroundColor: colors.cardBackground }]}>
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
      {isLeader && !isCurrentUser && member.role !== "leader" && (
        <Pressable style={styles.kickButton} onPress={onKick}>
          <SymbolView name="xmark" tintColor="#FF3B30" size={12} />
        </Pressable>
      )}
    </View>
  );
}

function ChatTab({
  convoyId,
  colors,
}: {
  convoyId: string;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const { data: messages, isLoading } = useConvoyMessages(convoyId);
  const sendMessage = useSendConvoyMessage(convoyId);
  const [text, setText] = useState("");
  const { session } = useAuth();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
    setText("");
  };

  if (isLoading) {
    return (
      <View style={styles.chatLoading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={200}
    >
      {(!messages || messages.length === 0) ? (
        <View style={styles.chatEmpty}>
          <SymbolView name="bubble.left.and.bubble.right" tintColor={colors.textTertiary} size={32} />
          <Text style={[styles.chatEmptyText, { color: colors.textSecondary }]}>
            No messages yet. Say something!
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isOwn={item.sender_id === session?.userId} colors={colors} />
          )}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.chatInputBar, { backgroundColor: colors.cardBackgroundElevated }]}>
        <TextInput
          style={[styles.chatInput, { color: colors.textPrimary }]}
          placeholder="Message..."
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline={false}
        />
        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
        >
          <SymbolView name="arrow.up.circle.fill" tintColor={text.trim() ? "#007AFF" : colors.textTertiary} size={28} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  isOwn,
  colors,
}: {
  message: ConvoyMessageOut;
  isOwn: boolean;
  colors: ReturnType<typeof useSheetColors>;
}) {
  if (message.message_type === "system") {
    return (
      <View style={styles.systemMessage}>
        <Text style={[styles.systemMessageText, { color: colors.textTertiary }]}>
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageBubbleRow, isOwn && styles.messageBubbleRowOwn]}>
      <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : { backgroundColor: colors.cardBackgroundElevated }]}>
        {!isOwn && message.sender_username && (
          <Text style={styles.messageSender}>@{message.sender_username}</Text>
        )}
        <Text style={[styles.messageText, isOwn && styles.messageTextOwn, !isOwn && { color: colors.textPrimary }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function RouteTab({
  convoyId,
  colors,
  onSetRoute,
}: {
  convoyId: string;
  colors: ReturnType<typeof useSheetColors>;
  onSetRoute: (name: string, lat: number, lng: number) => void;
}) {
  const { data: route, isLoading } = useConvoyRoute(convoyId);
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSetRoute(name.trim(), 0, 0);
    setName("");
  };

  return (
    <ScrollView style={styles.tabScrollView} contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <ActivityIndicator style={styles.routeLoading} />
      ) : route ? (
        <View style={[styles.activeRoute, { backgroundColor: colors.cardBackgroundElevated }]}>
          <View style={styles.routeIconContainer}>
            <SymbolView name="mappin.circle.fill" tintColor="#FF9500" size={28} />
          </View>
          <View style={styles.activeRouteInfo}>
            <Text style={[styles.activeRouteName, { color: colors.textPrimary }]}>
              {route.destination_name}
            </Text>
            <Text style={[styles.activeRouteMeta, { color: colors.textSecondary }]}>
              Set by @{route.set_by_username}
            </Text>
          </View>
          <View style={styles.activeRouteBadge}>
            <Text style={styles.activeRouteBadgeText}>ACTIVE</Text>
          </View>
        </View>
      ) : (
        <View style={styles.noRoute}>
          <SymbolView name="map" tintColor={colors.textTertiary} size={28} />
          <Text style={[styles.noRouteText, { color: colors.textSecondary }]}>
            No route set yet
          </Text>
        </View>
      )}

      <View style={styles.setRouteSection}>
        <Text style={[styles.setRouteLabel, { color: colors.textSecondary }]}>Set Destination</Text>
        <View style={styles.setRouteRow}>
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
            style={[styles.routeSubmitButton, !name.trim() && styles.routeSubmitDisabled]}
            onPress={handleSubmit}
            disabled={!name.trim()}
          >
            <Text style={styles.routeSubmitText}>Set</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    gap: 4,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  convoyName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  statusBadge: {
    backgroundColor: "rgba(142, 142, 147, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 0.5,
  },
  statusBadgeTextActive: {
    color: "#34C759",
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(142, 142, 147, 0.08)",
  },
  tabButtonActive: {
    backgroundColor: "rgba(0, 122, 255, 0.1)",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
  },
  tabLabelActive: {
    color: "#007AFF",
  },
  tabContent: {
    flex: 1,
  },
  tabScrollView: {
    flex: 1,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  inviteToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inviteToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  inviteSection: {
    marginBottom: 16,
    gap: 4,
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
  membersList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  kickButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatContainer: {
    flex: 1,
  },
  chatLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingBottom: 60,
  },
  chatEmptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  systemMessage: {
    alignItems: "center",
    paddingVertical: 4,
  },
  systemMessageText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  messageBubbleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  messageBubbleRowOwn: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  messageBubbleOwn: {
    backgroundColor: "#007AFF",
  },
  messageSender: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: "#FFFFFF",
  },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  routeLoading: {
    marginTop: 40,
  },
  activeRoute: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 20,
  },
  routeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 149, 0, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeRouteInfo: {
    flex: 1,
  },
  activeRouteName: {
    fontSize: 16,
    fontWeight: "600",
  },
  activeRouteMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  activeRouteBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeRouteBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34C759",
    letterSpacing: 0.5,
  },
  noRoute: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  noRouteText: {
    fontSize: 14,
  },
  setRouteSection: {
    gap: 8,
  },
  setRouteLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  setRouteRow: {
    flexDirection: "row",
    gap: 10,
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
  routeSubmitButton: {
    backgroundColor: "#FF9500",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  routeSubmitDisabled: {
    opacity: 0.4,
  },
  routeSubmitText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  leaveButtonStyle: {
    backgroundColor: "rgba(142, 142, 147, 0.12)",
  },
  endButtonStyle: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  endButtonText: {
    color: "#FF3B30",
  },
});
