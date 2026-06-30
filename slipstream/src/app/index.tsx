import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAuth } from "@/contexts/auth-context";
import { DebugPanel } from "@/components/debug-panel";
import { LiveMap } from "@/features/map/live-map";
import { useLocation } from "@/hooks/use-location";
import { useWebSocket } from "@/hooks/use-websocket";
import { useDriversStore } from "@/stores/drivers-store";
import { MapSheet } from "@/components/map-sheet/map-sheet";

const SERVER_URL = process.env.EXPO_PUBLIC_WS_URL ?? null;

export default function MapScreen() {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;

  const { drivers: wsDrivers, status, sendViewportUpdate, sendLocationUpdate, stats } =
    useWebSocket(SERVER_URL, token);

  const drivers = useDriversStore((s) => s.drivers);

  useEffect(() => {
    const store = useDriversStore.getState();
    const ids = Object.keys(wsDrivers);
    if (ids.length === 0) {
      store.clear();
      return;
    }
    store.setSnapshot(Object.values(wsDrivers));

    const currentIds = new Set(ids);
    for (const existingId of Object.keys(store.drivers)) {
      if (!currentIds.has(existingId)) {
        store.removeDriver(existingId);
      }
    }
  }, [wsDrivers]);

  useLocation({
    onLocationUpdate: sendLocationUpdate,
    enabled: status === "connected",
  });

  const [currentResolution, setCurrentResolution] = useState(0);
  const [cellCount, setCellCount] = useState(0);

  const handleCellsChanged = useCallback(
    (cells: string[], resolution: number) => {
      setCurrentResolution(resolution);
      setCellCount(cells.length);
      sendViewportUpdate(cells);
    },
    [sendViewportUpdate],
  );

  return (
    <View style={styles.container}>
      <LiveMap
        drivers={drivers}
        onCellsChanged={handleCellsChanged}
      />

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

      <MapSheet />

      {__DEV__ && (
        <DebugPanel
          status={status}
          driverCount={Object.keys(drivers).length}
          cellCount={cellCount}
          resolution={currentResolution}
          stats={stats}
        />
      )}
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
