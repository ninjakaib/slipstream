import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Mapbox, {
  Camera,
  Images,
  LocationPuck,
  MapView,
  ShapeSource,
  StyleImport,
  SymbolLayer,
  UserTrackingMode,
} from "@rnmapbox/maps";
import { SymbolView } from "expo-symbols";
import { GlassView } from "expo-glass-effect";

import { useViewportCells } from "@/hooks/use-viewport-cells";
import type { DriverData } from "@/hooks/use-websocket";
import type { ViewportBounds } from "@/lib/spatial";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

const DRIVER_ARROW_ICON = require("@/assets/images/driver-arrow.png");

interface LiveMapProps {
  drivers: Record<string, DriverData>;
  onCellsChanged: (cells: string[], resolution: number) => void;
}

function driversToGeoJSON(
  drivers: Record<string, DriverData>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = Object.values(drivers).map((driver) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [driver.lng, driver.lat],
    },
    properties: {
      user_id: driver.user_id,
      heading: driver.heading ?? 0,
      speed: driver.speed ?? 0,
      status: driver.status ?? "driving",
    },
  }));

  return { type: "FeatureCollection", features };
}

function getLightPreset(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

const DEFAULT_CAMERA = {
  centerCoordinate: [-118.2437, 34.0522],
  zoomLevel: 10.5,
} as const;

// off: not tracking, arrow outline
// follow: tracking location, filled arrow
// followHeading: tracking location + bearing, compass arrow
type TrackingState = "off" | "follow" | "followHeading";

export function LiveMap({ drivers, onCellsChanged }: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const { handleCameraChanged } = useViewportCells(onCellsChanged);
  const [tracking, setTracking] = useState<TrackingState>("off");
  const [show3d, setShow3d] = useState(false);

  // Any user gesture on the map resets tracking to off
  const handleCameraUpdate = useCallback(
    (state: { gestures: { isGestureActive: boolean } }) => {
      if (state.gestures.isGestureActive) {
        setTracking("off");
      }
    },
    [],
  );

  // Cycle: off → follow → followHeading → off
  const handleLocatePress = useCallback(() => {
    setTracking((prev) => {
      if (prev === "off") return "follow";
      if (prev === "follow") return "followHeading";
      return "off";
    });
  }, []);

  const handle3dPress = useCallback(() => {
    setShow3d((prev) => !prev);
  }, []);

  const geoJSON = useMemo(() => driversToGeoJSON(drivers), [drivers]);

  const onMapIdle = useCallback(
    (state: {
      properties: {
        center: GeoJSON.Position;
        bounds: { ne: GeoJSON.Position; sw: GeoJSON.Position };
        zoom: number;
        heading: number;
        pitch: number;
      };
    }) => {
      const { bounds, zoom } = state.properties;
      const viewportBounds: ViewportBounds = {
        ne: bounds.ne as [number, number],
        sw: bounds.sw as [number, number],
      };
      handleCameraChanged(viewportBounds, zoom);
    },
    [handleCameraChanged],
  );

  const followUserMode =
    tracking === "followHeading"
      ? UserTrackingMode.FollowWithHeading
      : UserTrackingMode.Follow;

  const lightPreset = useMemo(() => getLightPreset(), []);

  const locationIcon =
    tracking === "followHeading"
      ? "location.north.line.fill"
      : tracking === "follow"
        ? "location.fill"
        : "location";

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/standard"
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onMapIdle={onMapIdle}
        onCameraChanged={handleCameraUpdate}
      >
        <StyleImport
          id="basemap"
          existing
          config={{
            lightPreset,
            show3dObjects: show3d ? "true" : "false",
          }}
        />

        <Camera
          defaultSettings={{
            centerCoordinate: [...DEFAULT_CAMERA.centerCoordinate],
            zoomLevel: DEFAULT_CAMERA.zoomLevel,
          }}
          pitch={show3d ? 50 : 0}
          followUserLocation={tracking !== "off"}
          followUserMode={followUserMode}
          followZoomLevel={15}
          followPitch={show3d ? 50 : 0}
          animationDuration={500}
        />

        <LocationPuck
          visible={true}
          puckBearingEnabled={true}
          puckBearing="heading"
          pulsing={{
            isEnabled: true,
            color: "rgba(0, 122, 255, 0.25)",
            radius: "accuracy",
          }}
        />

        <Images images={{ "driver-arrow": DRIVER_ARROW_ICON }} />

        <ShapeSource id="drivers" shape={geoJSON}>
          <SymbolLayer id="drivers-layer" style={symbolStyle} />
        </ShapeSource>
      </MapView>

      {/* Map control buttons — liquid glass, Apple Maps style */}
      <View style={styles.controlStack}>
        <GlassView style={styles.glassContainer} glassEffectStyle="regular">
          {/* 3D toggle */}
          <Pressable
            style={styles.controlButton}
            onPress={handle3dPress}
            accessibilityLabel={show3d ? "Disable 3D" : "Enable 3D"}
            accessibilityRole="button"
          >
            <SymbolView
              name={show3d ? "building.2.fill" : "building.2"}
              tintColor={show3d ? "#007AFF" : "#1C1C1E"}
              size={20}
            />
          </Pressable>

          <View style={styles.separator} />

          {/* Location tracking */}
          <Pressable
            style={styles.controlButton}
            onPress={handleLocatePress}
            accessibilityLabel="Track my location"
            accessibilityRole="button"
          >
            <SymbolView
              name={locationIcon}
              tintColor={tracking !== "off" ? "#007AFF" : "#1C1C1E"}
              size={20}
            />
          </Pressable>
        </GlassView>
      </View>
    </View>
  );
}

const symbolStyle = {
  iconImage: "driver-arrow",
  iconSize: 0.4,
  iconRotate: ["get", "heading"] as unknown as number,
  iconRotationAlignment: "map" as const,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controlStack: {
    position: "absolute",
    bottom: 110,
    right: 12,
  },
  glassContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    marginHorizontal: 8,
  },
});
