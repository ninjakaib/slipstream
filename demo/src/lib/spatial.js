/**
 * Spatial helpers — H3 cell computation for viewport subscription.
 *
 * Maps the Mapbox zoom level to the appropriate H3 resolution,
 * then computes which cells tile the current viewport bounds.
 */
import {
  polygonToCells,
  polygonToCellsExperimental,
  POLYGON_TO_CELLS_FLAGS,
} from "h3-js";

/**
 * Supported H3 resolutions (must match the server's INDEX_RESOLUTIONS).
 */
export const SERVER_RESOLUTIONS = [1, 2, 3, 4, 5];

/** All valid H3 resolutions for preview purposes. */
export const ALL_RESOLUTIONS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];

/** Containment modes available for polygonToCellsExperimental. */
export const CONTAINMENT_MODES = {
  center: { flag: POLYGON_TO_CELLS_FLAGS.containmentCenter, label: "Center" },
  full: { flag: POLYGON_TO_CELLS_FLAGS.containmentFull, label: "Full" },
  overlapping: {
    flag: POLYGON_TO_CELLS_FLAGS.containmentOverlapping,
    label: "Overlapping",
  },
  overlappingBbox: {
    flag: POLYGON_TO_CELLS_FLAGS.containmentOverlappingBbox,
    label: "Overlap BBox",
  },
};

/**
 * Map a Mapbox zoom level to an H3 resolution.
 *
 * When serverOnly is true, this maps to resolutions 1-5.
 * When serverOnly is false, this extends to higher resolutions for preview.
 */
export function zoomToResolution(zoom, serverOnly = true) {
  if (serverOnly) {
    if (zoom >= 13) return 5;
    if (zoom >= 10) return 4;
    if (zoom >= 7) return 3;
    if (zoom >= 5) return 2;
    return 1;
  }
  // Extended mapping for preview (all resolutions)
  if (zoom >= 17) return 10;
  if (zoom >= 16) return 9;
  if (zoom >= 15) return 8;
  if (zoom >= 14) return 7;
  if (zoom >= 13) return 6;
  if (zoom >= 11) return 5;
  if (zoom >= 9) return 4;
  if (zoom >= 7) return 3;
  if (zoom >= 5) return 2;
  if (zoom >= 3) return 1;
  return 0;
}

/**
 * Compute the H3 cells covering the current map viewport.
 *
 * @param {mapboxgl.Map} map - The Mapbox GL map instance.
 * @param {object} options
 * @param {number|null} options.overrideResolution - Force a specific resolution (null = auto from zoom)
 * @param {string} options.containmentMode - Key from CONTAINMENT_MODES
 * @param {boolean} options.serverOnly - If true, clamp to SERVER_RESOLUTIONS
 * @returns {{ cells: string[], resolution: number }} The cells and resolution used.
 */
export function getViewportCells(map, options = {}) {
  const {
    overrideResolution = null,
    containmentMode = "overlapping",
    serverOnly = true,
  } = options;

  const bounds = map.getBounds();
  const zoom = map.getZoom();

  // Determine resolution
  let resolution;
  if (overrideResolution !== null) {
    resolution = overrideResolution;
  } else {
    resolution = zoomToResolution(zoom, serverOnly);
  }

  // Clamp to server resolutions if needed
  if (serverOnly) {
    const minRes = Math.min(...SERVER_RESOLUTIONS);
    const maxRes = Math.max(...SERVER_RESOLUTIONS);
    resolution = Math.max(minRes, Math.min(maxRes, resolution));
  }

  // Build a polygon from the map's viewport corners
  // h3-js expects [lat, lng] pairs
  const nw = bounds.getNorthWest();
  const ne = bounds.getNorthEast();
  const se = bounds.getSouthEast();
  const sw = bounds.getSouthWest();

  const ring = [
    [nw.lat, nw.lng],
    [ne.lat, ne.lng],
    [se.lat, se.lng],
    [sw.lat, sw.lng],
    [nw.lat, nw.lng], // close the ring
  ];

  try {
    let cells;
    const modeConfig = CONTAINMENT_MODES[containmentMode];

    if (containmentMode === "center") {
      // Use the standard function for center containment (original behavior)
      cells = polygonToCells([ring], resolution);
    } else if (modeConfig) {
      // Use experimental function with the specified flag
      cells = polygonToCellsExperimental([ring], resolution, modeConfig.flag);
    } else {
      // Fallback
      cells = polygonToCells([ring], resolution);
    }

    // Cap at 64 cells (server maximum)
    return { cells: cells.slice(0, 64), resolution };
  } catch (e) {
    console.warn("H3 polygonToCells failed:", e);
    return { cells: [], resolution };
  }
}
