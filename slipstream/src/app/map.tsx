/**
 * Map screen — real-time driver visualization.
 *
 * Connects to the spatial WebSocket and displays nearby drivers
 * on a Mapbox map. Viewport cell subscriptions are managed automatically
 * as the user pans and zooms.
 */
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { SymbolView } from "expo-symbols";

import { useAuth } from "@/contexts/auth-context";
import { DriverSheet } from "@/features/map/driver-sheet";
import { LiveMap } from "@/features/map/live-map";
import ProfileScreen from "@/features/profile/profile-screen";
import { useLocation } from "@/hooks/use-location";
import { useWebSocket } from "@/hooks/use-websocket";

const SERVER_URL = process.env.EXPO_PUBLIC_WS_URL ?? null;

export default function MapScreen() {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;

  const { drivers, status, sendViewportUpdate, sendLocationUpdate } =
    useWebSocket(SERVER_URL, token);

  useLocation({
    onLocationUpdate: sendLocationUpdate,
    enabled: status === "connected",
  });

  const [currentResolution, setCurrentResolution] = useState(0);
  const [profileVisible, setProfileVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const handleCellsChanged = useCallback(
    (cells: string[], resolution: number) => {
      setCurrentResolution(resolution);
      sendViewportUpdate(cells);
    },
    [sendViewportUpdate],
  );

  return (
    <View style={styles.container}>
      <LiveMap
        drivers={drivers}
        onCellsChanged={handleCellsChanged}
        onDriverSelected={setSelectedDriverId}
      />

      {/* Avatar — opens profile sheet */}
      <Pressable
        style={styles.avatarButton}
        onPress={() => setProfileVisible(true)}
        accessibilityLabel="Open profile"
        accessibilityRole="button"
      >
        <SymbolView
          name="person.crop.circle.fill"
          tintColor="#ffffff"
          size={32}
        />
      </Pressable>

      {/* Connection status indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            status === "connected" && styles.statusConnected,
            status === "connecting" && styles.statusConnecting,
            status === "disconnected" && styles.statusDisconnected,
          ]}
        />
      </View>

      {selectedDriverId && (
        <DriverSheet
          userId={selectedDriverId}
          onClose={() => setSelectedDriverId(null)}
        />
      )}

      <Modal
        visible={profileVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={styles.modalHeader}>
          <Pressable
            onPress={() => setProfileVisible(false)}
            hitSlop={12}
          >
            <SymbolView name="xmark.circle.fill" tintColor="#8E8E93" size={28} />
          </Pressable>
        </View>
        <ProfileScreen />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarButton: {
    position: "absolute",
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statusContainer: {
    position: "absolute",
    top: 60,
    right: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6b7280",
  },
  statusConnected: {
    backgroundColor: "#22c55e",
  },
  statusConnecting: {
    backgroundColor: "#f59e0b",
  },
  statusDisconnected: {
    backgroundColor: "#ef4444",
  },
  modalHeader: {
    backgroundColor: "#000",
    paddingTop: 16,
    paddingRight: 16,
    alignItems: "flex-end",
  },
});
