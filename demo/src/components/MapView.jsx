/**
 * MapView — Mapbox GL JS map with real-time driver visualization.
 *
 * Uses a GeoJSON source + symbol layer to render all drivers as
 * rotated arrow icons. This approach scales well to hundreds of drivers
 * with smooth rendering since it's GPU-accelerated.
 *
 * Optionally renders the H3 hex grid overlay showing which cells
 * the viewer is currently subscribed to.
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cellToBoundary } from "h3-js";

import { useViewportCells } from "../hooks/useViewportCells";

// SVG arrow icon as a data URL — a simple chevron pointing up
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#6366f1" stroke="#fff" stroke-width="1.5"/>
</svg>`;

const ARROW_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ARROW_SVG)}`;

/**
 * Build a GeoJSON FeatureCollection from the drivers map.
 */
function driversToGeoJSON(drivers) {
  const features = Object.values(drivers).map((driver) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [driver.lng, driver.lat],
    },
    properties: {
      user_id: driver.user_id,
      heading: driver.heading || 0,
      speed: driver.speed || 0,
      status: driver.status || "driving",
    },
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

const SOURCE_ID = "drivers";
const LAYER_ID = "drivers-layer";
const HEX_SOURCE_ID = "hex-grid";
const HEX_FILL_LAYER_ID = "hex-grid-fill";
const HEX_LINE_LAYER_ID = "hex-grid-line";

/**
 * Build a GeoJSON FeatureCollection of hex polygons from H3 cell IDs.
 */
function cellsToGeoJSON(cells) {
  const features = cells.map((cellId) => {
    // cellToBoundary returns [[lat, lng], ...] — we need [[lng, lat], ...] for GeoJSON
    const boundary = cellToBoundary(cellId);
    const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
    // Close the polygon ring
    coordinates.push(coordinates[0]);

    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coordinates],
      },
      properties: {
        cell_id: cellId,
      },
    };
  });

  return { type: "FeatureCollection", features };
}

/**
 * @param {{ drivers: object, onCellsChanged: function, showHexGrid: boolean, viewportCells: string[] }} props
 */
export function MapView({
  drivers,
  onCellsChanged,
  showHexGrid,
  viewportCells,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const sourceReadyRef = useRef(false);

  // Initialize the map
  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-118.2437, 34.0522], // Los Angeles
      zoom: 10.5,
      pitch: 0,
    });

    mapRef.current = mapInstance;

    mapInstance.on("load", () => {
      // Load the arrow icon
      const img = new Image(24, 24);
      img.onload = () => {
        if (!mapInstance.hasImage("driver-arrow")) {
          mapInstance.addImage("driver-arrow", img, { sdf: false });
        }

        // Add empty GeoJSON source for drivers
        mapInstance.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add symbol layer for drivers
        mapInstance.addLayer({
          id: LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          layout: {
            "icon-image": "driver-arrow",
            "icon-size": 1.2,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });

        // Add hex grid source and layers (initially hidden)
        mapInstance.addSource(HEX_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        mapInstance.addLayer({
          id: HEX_FILL_LAYER_ID,
          type: "fill",
          source: HEX_SOURCE_ID,
          paint: {
            "fill-color": "#6366f1",
            "fill-opacity": 0.08,
          },
          layout: {
            visibility: "none",
          },
        });

        mapInstance.addLayer({
          id: HEX_LINE_LAYER_ID,
          type: "line",
          source: HEX_SOURCE_ID,
          paint: {
            "line-color": "#6366f1",
            "line-opacity": 0.5,
            "line-width": 1.5,
          },
          layout: {
            visibility: "none",
          },
        });

        sourceReadyRef.current = true;
        setMap(mapInstance);
      };
      img.src = ARROW_IMAGE_URL;
    });

    return () => {
      mapInstance.remove();
    };
  }, []);

  // Update the GeoJSON source whenever drivers change
  useEffect(() => {
    if (!map || !sourceReadyRef.current) return;

    const source = map.getSource(SOURCE_ID);
    if (source) {
      source.setData(driversToGeoJSON(drivers));
    }
  }, [map, drivers]);

  // Update hex grid data whenever viewport cells change
  useEffect(() => {
    if (!map || !sourceReadyRef.current) return;

    const source = map.getSource(HEX_SOURCE_ID);
    if (source) {
      source.setData(cellsToGeoJSON(viewportCells));
    }
  }, [map, viewportCells]);

  // Toggle hex grid layer visibility
  useEffect(() => {
    if (!map || !sourceReadyRef.current) return;

    const visibility = showHexGrid ? "visible" : "none";
    map.setLayoutProperty(HEX_FILL_LAYER_ID, "visibility", visibility);
    map.setLayoutProperty(HEX_LINE_LAYER_ID, "visibility", visibility);
  }, [map, showHexGrid]);

  // Subscribe to viewport cells
  useViewportCells(map, onCellsChanged);

  return <div id="map-container" ref={mapContainerRef} />;
}
