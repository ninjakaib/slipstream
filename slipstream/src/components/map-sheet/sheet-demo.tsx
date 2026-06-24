/**
 * Sheet Demo — standalone screen to test the MapSheet component
 * in isolation without needing the real map or backend connection.
 *
 * Shows a fake dark map background with the sheet overlaid on top.
 * Use this to iterate on animations, gestures, and page content.
 *
 * To use: temporarily replace the map.tsx content or add as a route.
 */
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MapSheet } from "@/components/map-sheet";

export default function SheetDemoScreen() {
  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      {/* Fake map background */}
      <View style={styles.fakeMap}>
        <View style={styles.gridOverlay}>
          {/* Subtle grid to simulate map tiles */}
          {Array.from({ length: 8 }).map((_, row) => (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: 6 }).map((_, col) => (
                <View key={col} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.centerMarker}>
          <View style={styles.markerDot} />
          <Text style={styles.markerLabel}>You are here</Text>
        </View>
      </View>

      {/* The sheet component */}
      <MapSheet
        initialSnap="half"
        onSnapChange={(snap) => {
          console.log("[Sheet] snapped to:", snap);
        }}
      />
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fakeMap: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-evenly",
    opacity: 0.15,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    flex: 1,
  },
  gridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4a4a6a",
  },
  centerMarker: {
    alignItems: "center",
    gap: 8,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  markerLabel: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
});
