/**
 * Map screen — real-time driver visualization.
 *
 * Connects to the spatial WebSocket and displays nearby drivers
 * on a Mapbox map. Viewport cell subscriptions are managed automatically
 * as the user pans and zooms.
 */
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { LiveMap } from "@/features/map/live-map";
import { useLocation } from "@/hooks/use-location";
import { useWebSocket } from "@/hooks/use-websocket";

// TODO: Replace with actual auth flow and dynamic server URL
const SERVER_URL = process.env.EXPO_PUBLIC_WS_URL ?? null;
const TOKEN = process.env.EXPO_PUBLIC_DEV_TOKEN ?? null;

export default function MapScreen() {
  const { drivers, status, sendViewportUpdate, sendLocationUpdate } =
    useWebSocket(SERVER_URL, TOKEN);

  useLocation({
    onLocationUpdate: sendLocationUpdate,
    enabled: status === "connected",
  });

  const [currentResolution, setCurrentResolution] = useState(0);

  const handleCellsChanged = useCallback(
    (cells: string[], resolution: number) => {
      setCurrentResolution(resolution);
      sendViewportUpdate(cells);
    },
    [sendViewportUpdate],
  );

  return (
    <View style={styles.container}>
      <LiveMap drivers={drivers} onCellsChanged={handleCellsChanged} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
