import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import Mapbox, {
  Camera,
  CircleLayer,
  Images,
  LocationPuck,
  MapView,
  ShapeSource,
  StyleImport,
  SymbolLayer,
  UserTrackingMode,
} from "@rnmapbox/maps";
import type { MapState } from "@rnmapbox/maps";
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
  onDriverSelected?: (userId: string) => void;
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

// off: not tracking (outline arrow)
// follow: tracking location (filled arrow)
// followHeading: tracking location + device compass heading (compass arrow)
// driving: racing cam — follows course, high pitch, close zoom
type TrackingState = "off" | "follow" | "followHeading" | "driving";

export function LiveMap({ drivers, onCellsChanged, onDriverSelected }: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const { handleCameraChanged } = useViewportCells(onCellsChanged);
  const [tracking, setTracking] = useState<TrackingState>("off");
  const [show3d, setShow3d] = useState(false);
  const expandAnim = useRef(new Animated.Value(1)).current;

  const animateExpand = useCallback(
    (expanded: boolean) => {
      Animated.spring(expandAnim, {
        toValue: expanded ? 1 : 0,
        useNativeDriver: false,
        tension: 200,
        friction: 20,
      }).start();
    },
    [expandAnim],
  );

  const handleCameraUpdate = useCallback(
    (state: MapState) => {
      if (state.gestures.isGestureActive) {
        setTracking((prev) => {
          if (prev === "driving") {
            animateExpand(true);
          }
          return "off";
        });
      }
      const { bounds, zoom } = state.properties;
      const viewportBounds: ViewportBounds = {
        ne: bounds.ne as [number, number],
        sw: bounds.sw as [number, number],
      };
      handleCameraChanged(viewportBounds, zoom);
    },
    [animateExpand, handleCameraChanged],
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

  const handleDrivingPress = useCallback(() => {
    setTracking((prev) => {
      if (prev === "driving") {
        animateExpand(true);
        return "off";
      }
      animateExpand(false);
      return "driving";
    });
  }, [animateExpand]);

  const handleDriverPress = useCallback(
    (event: { features: Array<GeoJSON.Feature> }) => {
      const feature = event.features?.[0];
      const userId = feature?.properties?.user_id as string | undefined;
      if (userId) onDriverSelected?.(userId);
    },
    [onDriverSelected],
  );

  const geoJSON = useMemo(() => driversToGeoJSON(drivers), [drivers]);

  const onMapIdle = useCallback(
    (state: MapState) => {
      const { bounds, zoom } = state.properties;
      const viewportBounds: ViewportBounds = {
        ne: bounds.ne as [number, number],
        sw: bounds.sw as [number, number],
      };
      handleCameraChanged(viewportBounds, zoom);
    },
    [handleCameraChanged],
  );

  const isDriving = tracking === "driving";
  const isFollowing = tracking !== "off";

  const followUserMode = (() => {
    switch (tracking) {
      case "followHeading":
        return UserTrackingMode.FollowWithHeading;
      case "driving":
        return UserTrackingMode.FollowWithCourse;
      default:
        return UserTrackingMode.Follow;
    }
  })();

  const followPitch = isDriving ? 75 : show3d ? 50 : 0;
  const followZoom = isDriving ? 17.5 : 13.5;

  const lightPreset = useMemo(() => getLightPreset(), []);

  const locationIcon =
    tracking === "followHeading"
      ? "location.north.line.fill"
      : tracking === "follow"
        ? "location.fill"
        : "location";

  const otherButtonsStyle = {
    opacity: expandAnim,
    height: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 89],
    }),
    overflow: "hidden" as const,
  };

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
            show3dObjects: isDriving || show3d ? "true" : "false",
          }}
        />

        <Camera
          defaultSettings={{
            centerCoordinate: [...DEFAULT_CAMERA.centerCoordinate],
            zoomLevel: DEFAULT_CAMERA.zoomLevel,
          }}
          pitch={show3d ? 50 : 0}
          followUserLocation={isFollowing}
          followUserMode={followUserMode}
          followZoomLevel={followZoom}
          followPitch={followPitch}
          animationDuration={isDriving ? 300 : 500}
          
        />

        <LocationPuck
          visible={true}
          puckBearingEnabled={true}
          puckBearing={isDriving ? "course" : "heading"}
          pulsing={{
            isEnabled: !isDriving,
            color: "rgba(0, 122, 255, 0.25)",
            radius: "accuracy",
          }}
        />

        <Images images={{ "driver-arrow": DRIVER_ARROW_ICON }} />

        <ShapeSource id="drivers" shape={geoJSON} onPress={handleDriverPress} hitbox={{ width: 44, height: 44 }}>
          <CircleLayer id="drivers-circle" style={circleStyle} />
          <SymbolLayer id="drivers-arrow" style={symbolStyle} />
        </ShapeSource>
      </MapView>

      {/* Map control buttons — liquid glass */}
      <View style={styles.controlStack}>
        <GlassView style={styles.glassContainer} glassEffectStyle="regular">
          <Animated.View style={otherButtonsStyle}>
            {/* 3D toggle */}
            <Pressable
              style={styles.controlButton}
              onPress={handle3dPress}
              accessibilityLabel={show3d ? "Disable 3D" : "Enable 3D"}
              accessibilityRole="button"
            >
              <SymbolView
                name={show3d ? "building.2.fill" : "building.2"}
                tintColor={show3d ? "#007AFF" : "#FFFFFF"}
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
                tintColor={isFollowing && !isDriving ? "#007AFF" : "#FFFFFF"}
                size={20}
              />
            </Pressable>

            <View style={styles.separator} />
          </Animated.View>

          {/* Driving mode */}
          <Pressable
            style={styles.controlButton}
            onPress={handleDrivingPress}
            accessibilityLabel={isDriving ? "Exit driving mode" : "Enter driving mode"}
            accessibilityRole="button"
          >
            <SymbolView
              name={isDriving ? "car.side.fill" : "car.side"}
              tintColor={isDriving ? "#007AFF" : "#FFFFFF"}
              size={20}
            />
          </Pressable>
        </GlassView>
      </View>
    </View>
  );
}

const circleStyle = {
  circleRadius: 16,
  circleColor: "#007AFF",
  circleStrokeWidth: 2,
  circleStrokeColor: "#ffffff",
  circleOpacity: 0.9,
};

const symbolStyle = {
  iconImage: "driver-arrow",
  iconSize: 0.3,
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
    borderRadius: 22,
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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 8,
  },
});
