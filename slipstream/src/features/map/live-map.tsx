/**
 * LiveMap — Mapbox map with real-time driver visualization.
 *
 * Uses a ShapeSource + SymbolLayer to render all drivers as
 * rotated arrow icons. This approach scales well to hundreds of drivers
 * with smooth GPU-accelerated rendering.
 *
 * Subscribes to the spatial WebSocket and updates viewport cells
 * as the user pans/zooms.
 */
import { useCallback, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import Mapbox, {
  Camera,
  Images,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";

import { useViewportCells } from "@/hooks/use-viewport-cells";
import type { DriverData } from "@/hooks/use-websocket";
import type { ViewportBounds } from "@/lib/spatial";

// Set the Mapbox access token
// TODO: Move to environment variable / app config
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

/** Arrow icon asset for driver markers */
const DRIVER_ARROW_ICON = require("@/assets/images/driver-arrow.png");

interface LiveMapProps {
  drivers: Record<string, DriverData>;
  onCellsChanged: (cells: string[], resolution: number) => void;
}

/**
 * Build a GeoJSON FeatureCollection from the drivers map.
 */
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

  return {
    type: "FeatureCollection",
    features,
  };
}

/** Initial camera position — Los Angeles */
const DEFAULT_CAMERA = {
  centerCoordinate: [-118.2437, 34.0522],
  zoomLevel: 10.5,
} as const;

export function LiveMap({ drivers, onCellsChanged }: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const { handleCameraChanged } = useViewportCells(onCellsChanged);

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

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      styleURL="mapbox://styles/mapbox/dark-v11"
      logoEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
      onMapIdle={onMapIdle}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [...DEFAULT_CAMERA.centerCoordinate],
          zoomLevel: DEFAULT_CAMERA.zoomLevel,
        }}
      />

      <Images images={{ "driver-arrow": DRIVER_ARROW_ICON }} />

      <ShapeSource id="drivers" shape={geoJSON}>
        <SymbolLayer
          id="drivers-layer"
          style={symbolStyle}
        />
      </ShapeSource>
    </MapView>
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
  map: {
    flex: 1,
  },
});
