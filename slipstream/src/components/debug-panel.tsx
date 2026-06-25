import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ConnectionStatus, WebSocketStats } from "@/hooks/use-websocket";

interface DebugPanelProps {
  status: ConnectionStatus;
  driverCount: number;
  cellCount: number;
  resolution: number;
  stats: WebSocketStats;
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "never";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function DebugPanel({
  status,
  driverCount,
  cellCount,
  resolution,
  stats,
}: DebugPanelProps) {
  const [, setTick] = useState(0);

  // Re-render every second to keep relative timestamps fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>WS: {status}</Text>
      <Text style={styles.text}>Drivers: {driverCount}</Text>
      <Text style={styles.text}>Cells: {cellCount}</Text>
      <Text style={styles.text}>H3 res: {resolution}</Text>
      <Text style={styles.text}>Msgs: {stats.messagesReceived}</Text>
      <Text style={styles.text}>
        Last: {formatRelativeTime(stats.lastMessageAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 100,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11,
    fontFamily: "Menlo",
    lineHeight: 16,
  },
});
