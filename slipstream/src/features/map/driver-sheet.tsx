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

import { sendFriendRequest } from "@/lib/api";
import { useUserProfile } from "@/hooks/queries/use-user-profile";
import { useSelectedDriverStore } from "@/stores/selected-driver-store";

export function DriverSheet() {
  const { selectedDriverId, clearSelection } = useSelectedDriverStore();
  const { data: profile, isLoading, error } = useUserProfile(selectedDriverId);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  // Log lifecycle for debugging
  useEffect(() => {
    console.log("[DriverSheet] mounted/updated", {
      selectedDriverId,
      isLoading,
      hasProfile: !!profile,
      error: error?.message,
    });
  }, [selectedDriverId, isLoading, profile, error]);

  const handleAddFriend = useCallback(async () => {
    if (!selectedDriverId) return;
    const { error: reqError } = await sendFriendRequest({ body: { user_id: selectedDriverId } });
    if (!reqError) setFriendRequestSent(true);
  }, [selectedDriverId]);

  const handleInvite = useCallback(() => {
    // TODO: implement convoy invite
    console.log("[DriverSheet] invite to convoy:", selectedDriverId);
  }, [selectedDriverId]);

  // Reset friend request state when driver changes
  useEffect(() => {
    setFriendRequestSent(false);
  }, [selectedDriverId]);

  // Don't render if no driver selected
  if (!selectedDriverId) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={clearSelection} />
        <GlassView style={styles.sheet} glassEffectStyle="regular">
          <ActivityIndicator color="#fff" />
        </GlassView>
      </View>
    );
  }

  if (error || !profile) {
    console.warn("[DriverSheet] No profile or error, dismissing", { error: error?.message });
    return null;
  }

  const carText = profile.active_car
    ? `${String(profile.active_car.year)} ${profile.active_car.make} ${profile.active_car.model}`
    : null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.backdrop} onPress={clearSelection} />
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
