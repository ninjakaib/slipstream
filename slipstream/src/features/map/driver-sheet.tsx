import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { GlassView } from "expo-glass-effect";

import { getUserProfile, sendFriendRequest } from "@/lib/api";
import type { PublicUserProfile } from "@/lib/api";

interface DriverSheetProps {
  userId: string;
  onClose: () => void;
  onInviteToConvoy?: (userId: string) => void;
}

export function DriverSheet({ userId, onClose, onInviteToConvoy }: DriverSheetProps) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getUserProfile({ path: { user_id: userId } });
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, [userId]);

  const handleAddFriend = useCallback(async () => {
    const { error } = await sendFriendRequest({ body: { user_id: userId } });
    if (!error) setFriendRequestSent(true);
  }, [userId]);

  const handleInvite = useCallback(() => {
    onInviteToConvoy?.(userId);
  }, [userId, onInviteToConvoy]);

  if (loading) {
    return (
      <View style={styles.container}>
        <GlassView style={styles.sheet} glassEffectStyle="regular">
          <ActivityIndicator color="#fff" />
        </GlassView>
      </View>
    );
  }

  if (!profile) {
    onClose();
    return null;
  }

  const carText = profile.active_car
    ? `${String(profile.active_car.year)} ${profile.active_car.make} ${profile.active_car.model}`
    : null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <GlassView style={styles.sheet} glassEffectStyle="regular">
        {/* Handle */}
        <View style={styles.handle} />

        {/* Profile header */}
        <View style={styles.header}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <SymbolView name="person.fill" tintColor="#8E8E93" size={24} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.displayName}>
              {profile.display_name || profile.username}
            </Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {carText && <Text style={styles.carText}>{carText}</Text>}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, friendRequestSent && styles.actionButtonDisabled]}
            onPress={handleAddFriend}
            disabled={friendRequestSent}
          >
            <SymbolView
              name={friendRequestSent ? "checkmark" : "person.badge.plus"}
              tintColor="#fff"
              size={18}
            />
            <Text style={styles.actionLabel}>
              {friendRequestSent ? "Sent" : "Add Friend"}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleInvite}>
            <SymbolView name="car.2.fill" tintColor="#fff" size={18} />
            <Text style={styles.actionLabel}>Invite to Convoy</Text>
          </Pressable>
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  username: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  carText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
});
