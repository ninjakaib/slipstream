/**
 * Spatial helpers — H3 cell computation for viewport subscription.
 *
 * Maps the Mapbox zoom level to the appropriate H3 resolution,
 * then computes which cells tile the current viewport bounds.
 */
import { polygonToCells } from "h3-js";

/**
 * Map a Mapbox zoom level to an H3 resolution.
 *
 * The mapping is chosen so that the number of cells covering the viewport
 * stays reasonable (roughly 10-50 cells) at any zoom level.
 */
export function zoomToResolution(zoom) {
  if (zoom >= 13) return 7; // Street level (~1.4 km cells)
  if (zoom >= 10.5) return 6; // Neighborhood (~3.7 km cells)
  if (zoom >= 7.5) return 5; // District/city (~9.8 km cells)
  return 4; // Metro overview (~26 km cells)
}

/**
 * Compute the H3 cells covering the current map viewport.
 *
 * @param {mapboxgl.Map} map - The Mapbox GL map instance.
 * @returns {{ cells: string[], resolution: number }} The cells and resolution used.
 */
export function getViewportCells(map) {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const resolution = zoomToResolution(zoom);

  // Build a polygon from the map's viewport corners
  // h3-js polygonToCells expects [lat, lng] pairs (not GeoJSON order)
  const nw = bounds.getNorthWest();
  const ne = bounds.getNorthEast();
  const se = bounds.getSouthEast();
  const sw = bounds.getSouthWest();

  // Outer ring of the viewport polygon
  const ring = [
    [nw.lat, nw.lng],
    [ne.lat, ne.lng],
    [se.lat, se.lng],
    [sw.lat, sw.lng],
    [nw.lat, nw.lng], // close the ring
  ];

  try {
    // polygonToCells expects [outerRing, ...holes] where each ring is [[lat, lng], ...]
    const cells = polygonToCells([ring], resolution);
    // Cap at 64 cells (server maximum)
    return { cells: cells.slice(0, 64), resolution };
  } catch (e) {
    console.warn("H3 polygonToCells failed:", e);
    return { cells: [], resolution };
  }
}
