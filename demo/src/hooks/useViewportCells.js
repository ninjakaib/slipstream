/**
 * useViewportCells — debounced computation of H3 cells for the map viewport.
 *
 * Listens to map `moveend` events, computes the H3 cells covering the viewport,
 * and calls the onCellsChanged callback with the new cell array and resolution.
 */
import { useCallback, useEffect, useRef } from "react";
import { getViewportCells } from "../lib/spatial";

const DEBOUNCE_MS = 300;

/**
 * @param {mapboxgl.Map|null} map - The Mapbox GL map instance
 * @param {(cells: string[], resolution: number) => void} onCellsChanged - Called when viewport cells change
 * @param {object} options - Options passed to getViewportCells
 */
export function useViewportCells(map, onCellsChanged, options = {}) {
  const timeoutRef = useRef(null);
  const prevCellsRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const computeAndSend = useCallback(() => {
    if (!map) return;

    const { cells, resolution } = getViewportCells(map, optionsRef.current);

    // Only send if the cells actually changed
    const cellsKey = cells.slice().sort().join(",");
    if (cellsKey === prevCellsRef.current) return;

    prevCellsRef.current = cellsKey;
    onCellsChanged(cells, resolution);
  }, [map, onCellsChanged]);

  const debouncedCompute = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(computeAndSend, DEBOUNCE_MS);
  }, [computeAndSend]);

  useEffect(() => {
    if (!map) return;

    // Compute initial cells once the map is loaded
    const onLoad = () => computeAndSend();
    const onMoveEnd = () => debouncedCompute();

    if (map.loaded()) {
      computeAndSend();
    } else {
      map.on("load", onLoad);
    }

    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    return () => {
      map.off("load", onLoad);
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [map, computeAndSend, debouncedCompute]);

  // Re-compute when options change
  useEffect(() => {
    if (map && map.loaded()) {
      // Reset prev so the new computation triggers the callback
      prevCellsRef.current = null;
      computeAndSend();
    }
  }, [
    map,
    options.containmentMode,
    options.overrideResolution,
    options.serverOnly,
    computeAndSend,
  ]);
}
