/**
 * Spatial helpers — H3 cell computation for viewport subscription.
 *
 * Maps the Mapbox zoom level to the appropriate H3 resolution,
 * then computes which cells tile the current viewport bounds.
 *
 * Ported from demo/src/lib/spatial.js for React Native / TypeScript.
 */
import { polygonToCellsExperimental, POLYGON_TO_CELLS_FLAGS } from "h3-js";

/**
 * Supported H3 resolutions (must match the server's INDEX_RESOLUTIONS).
 */
export const SERVER_RESOLUTIONS = [1, 2, 3, 4, 5] as const;

/** Maximum cells the server accepts per viewport update. */
export const MAX_VIEWPORT_CELLS = 64;

/**
 * Map a Mapbox zoom level to an H3 resolution.
 * Clamps to SERVER_RESOLUTIONS (1–5).
 */
export function zoomToResolution(zoom: number): number {
  if (zoom >= 13) return 5;
  if (zoom >= 10) return 4;
  if (zoom >= 7) return 3;
  if (zoom >= 5) return 2;
  return 1;
}

/**
 * Viewport bounds as provided by rnmapbox's getVisibleBounds().
 * Format: [[neLng, neLat], [swLng, swLat]]
 */
export interface ViewportBounds {
  ne: [number, number]; // [longitude, latitude]
  sw: [number, number]; // [longitude, latitude]
}

/**
 * Compute the H3 cells covering a rectangular viewport.
 *
 * @param bounds - Northeast and southwest corners from the map.
 * @param zoom - Current map zoom level.
 * @returns The cells and resolution used.
 */
export function getViewportCells(
  bounds: ViewportBounds,
  zoom: number,
): { cells: string[]; resolution: number } {
  const resolution = zoomToResolution(zoom);

  const { ne, sw } = bounds;

  // h3-js polygonToCells expects [lat, lng] pairs
  const neLat = ne[1];
  const neLng = ne[0];
  const swLat = sw[1];
  const swLng = sw[0];

  // Build a polygon ring from the viewport corners (lat, lng order for h3-js)
  const ring: [number, number][] = [
    [neLat, swLng], // NW
    [neLat, neLng], // NE
    [swLat, neLng], // SE
    [swLat, swLng], // SW
    [neLat, swLng], // close ring
  ];

  try {
    const cells = polygonToCellsExperimental([ring], resolution, POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
    return { cells: cells.slice(0, MAX_VIEWPORT_CELLS), resolution };
  } catch (e) {
    console.warn("H3 polygonToCells failed:", e);
    return { cells: [], resolution };
  }
}
