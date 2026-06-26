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
import {
  useFriends,
  useFriendRequests,
  useAcceptFriend,
  useDeclineFriend,
  useSendFriendRequest,
} from "@/hooks/queries/use-friends";
import { useUserSearch } from "@/hooks/queries/use-user-search";
import { useDriversStore } from "@/stores/drivers-store";
import { formatCarName } from "@/lib/format";
import type { FriendProfile, FriendRequestOut, UserSearchResult } from "@/lib/api/types.gen";

export function SocialPage() {
  const colors = useSheetColors();
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests } = useFriendRequests();
  const driverIds = useDriversStore((s) => s.driverIds);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRequests, setShowRequests] = useState(false);

  const onlineFriends = friends?.filter((f) => driverIds.has(f.id)) ?? [];
  const offlineFriends = friends?.filter((f) => !driverIds.has(f.id)) ?? [];
  const requestCount = requests?.length ?? 0;

  if (friendsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Friends</Text>
        <Pressable
          style={[styles.addButton, showSearch && styles.addButtonActive]}
          onPress={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearchQuery("");
          }}
        >
          <SymbolView
            name={showSearch ? "xmark" : "person.badge.plus"}
            tintColor="#007AFF"
            size={showSearch ? 16 : 20}
          />
        </Pressable>
      </View>

      {showSearch && (
        <SearchSection
          query={searchQuery}
          onQueryChange={setSearchQuery}
          colors={colors}
        />
      )}

      {requestCount > 0 && (
        <Pressable
          style={[styles.requestsBanner, { backgroundColor: colors.cardBackgroundElevated }]}
          onPress={() => setShowRequests(!showRequests)}
        >
          <View style={styles.requestsBadge}>
            <Text style={styles.requestsBadgeText}>{requestCount}</Text>
          </View>
          <Text style={[styles.requestsText, { color: colors.textPrimary }]}>Friend Requests</Text>
          <SymbolView
            name={showRequests ? "chevron.down" : "chevron.right"}
            tintColor={colors.textTertiary}
            size={14}
          />
        </Pressable>
      )}

      {showRequests && requests && requests.length > 0 && (
        <View style={styles.requestsList}>
          {requests.map((req) => (
            <RequestRow key={req.request_id} request={req} colors={colors} />
          ))}
        </View>
      )}

      {onlineFriends.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Online — {onlineFriends.length}
          </Text>
          <View style={styles.friendsList}>
            {onlineFriends.map((friend) => (
              <FriendRow key={friend.id} friend={friend} status="driving" colors={colors} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {onlineFriends.length > 0 ? "Offline" : `All Friends — ${offlineFriends.length}`}
        </Text>
        {offlineFriends.length === 0 && friends?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No friends yet. Tap + to search and add friends.
            </Text>
          </View>
        ) : (
          <View style={styles.friendsList}>
            {offlineFriends.map((friend) => (
              <FriendRow key={friend.id} friend={friend} status="offline" colors={colors} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SearchSection({
  query,
  onQueryChange,
  colors,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { data: results, isLoading } = useUserSearch(debouncedQuery);
  const sendRequest = useSendFriendRequest();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const handleChangeText = (text: string) => {
    onQueryChange(text);
    clearTimeout((handleChangeText as any)._timer);
    (handleChangeText as any)._timer = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 300);
  };

  const handleSend = (userId: string) => {
    sendRequest.mutate(userId, {
      onSuccess: () => setSentIds((prev) => new Set([...prev, userId])),
    });
  };

  return (
    <View style={styles.searchSection}>
      <View style={[styles.searchBar, { backgroundColor: colors.cardBackgroundElevated }]}>
        <SymbolView name="magnifyingglass" tintColor={colors.textTertiary} size={16} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search by username..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleChangeText}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {isLoading && <ActivityIndicator style={styles.searchLoading} />}
      {results && results.length > 0 && (
        <View style={styles.searchResults}>
          {results.map((user) => (
            <SearchResultRow
              key={user.id}
              user={user}
              sent={sentIds.has(user.id)}
              onSend={() => handleSend(user.id)}
              colors={colors}
            />
          ))}
        </View>
      )}
      {debouncedQuery.length >= 2 && !isLoading && results?.length === 0 && (
        <Text style={[styles.noResults, { color: colors.textSecondary }]}>No users found</Text>
      )}
    </View>
  );
}

function SearchResultRow({
  user,
  sent,
  onSend,
  colors,
}: {
  user: UserSearchResult;
  sent: boolean;
  onSend: () => void;
  colors: ReturnType<typeof useSheetColors>;
}) {
  return (
    <View style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={18} />
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]}>
          {user.display_name ?? user.username}
        </Text>
        <Text style={[styles.friendMeta, { color: colors.textSecondary }]}>@{user.username}</Text>
      </View>
      <Pressable
        style={[styles.sendButton, sent && styles.sendButtonSent]}
        onPress={onSend}
        disabled={sent}
      >
        <Text style={[styles.sendButtonText, sent && styles.sendButtonTextSent]}>
          {sent ? "Sent" : "Add"}
        </Text>
      </Pressable>
    </View>
  );
}

function RequestRow({
  request,
  colors,
}: {
  request: FriendRequestOut;
  colors: ReturnType<typeof useSheetColors>;
}) {
  const accept = useAcceptFriend();
  const decline = useDeclineFriend();
  const [handled, setHandled] = useState(false);

  if (handled) return null;

  return (
    <View style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={18} />
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]}>
          {request.from_user.display_name ?? request.from_user.username}
        </Text>
        <Text style={[styles.friendMeta, { color: colors.textSecondary }]}>
          @{request.from_user.username}
        </Text>
      </View>
      <View style={styles.requestActions}>
        <Pressable
          style={styles.acceptButton}
          onPress={() => {
            accept.mutate(request.request_id);
            setHandled(true);
          }}
        >
          <SymbolView name="checkmark" tintColor="#FFFFFF" size={14} />
        </Pressable>
        <Pressable
          style={styles.declineButton}
          onPress={() => {
            decline.mutate(request.request_id);
            setHandled(true);
          }}
        >
          <SymbolView name="xmark" tintColor="#8E8E93" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function FriendRow({
  friend,
  status,
  colors,
}: {
  friend: FriendProfile;
  status: "driving" | "offline";
  colors: ReturnType<typeof useSheetColors>;
}) {
  const statusColor = status === "driving" ? "#34C759" : "#48484A";
  const carText = friend.active_car ? formatCarName(friend.active_car) : undefined;

  return (
    <Pressable style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: colors.avatarBackground }]}>
        <SymbolView name="person.fill" tintColor={colors.textTertiary} size={18} />
        <View style={[styles.friendStatusDot, { backgroundColor: statusColor, borderColor: colors.borderSubtle }]} />
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]}>
          {friend.display_name ?? friend.username}
        </Text>
        <Text style={[styles.friendMeta, { color: colors.textSecondary }]}>
          {carText ? `${carText} · ` : ""}@{friend.username}
        </Text>
      </View>
      {status === "driving" && (
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
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
  addButtonActive: {
    backgroundColor: "rgba(0, 122, 255, 0.25)",
  },
  searchSection: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  searchLoading: {
    marginTop: 12,
  },
  searchResults: {
    marginTop: 8,
    gap: 4,
  },
  noResults: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
  },
  sendButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#007AFF",
  },
  sendButtonSent: {
    backgroundColor: "rgba(142, 142, 147, 0.12)",
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sendButtonTextSent: {
    color: "#8E8E93",
  },
  requestsBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
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
  requestsList: {
    marginBottom: 16,
    gap: 4,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(142, 142, 147, 0.12)",
    alignItems: "center",
    justifyContent: "center",
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
  emptyState: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
