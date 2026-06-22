/**
 * useViewportCells — debounced computation of H3 cells for the map viewport.
 *
 * Listens to camera state changes from rnmapbox, computes the H3 cells
 * covering the viewport, and calls the onCellsChanged callback.
 *
 * Unlike the web version which listens to map events directly, this hook
 * is driven by the camera state passed in from the MapView's onCameraChanged
 * callback.
 */
import { useCallback, useRef } from "react";

import { getViewportCells, type ViewportBounds } from "@/lib/spatial";

const DEBOUNCE_MS = 300;

interface UseViewportCellsResult {
  /**
   * Call this from the map's onCameraChanged / onMapIdle handler
   * with the current bounds and zoom.
   */
  handleCameraChanged: (bounds: ViewportBounds, zoom: number) => void;
}

/**
 * @param onCellsChanged - Called when viewport cells change.
 */
export function useViewportCells(
  onCellsChanged: (cells: string[], resolution: number) => void,
): UseViewportCellsResult {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCellsKeyRef = useRef<string | null>(null);

  const computeAndSend = useCallback(
    (bounds: ViewportBounds, zoom: number) => {
      const { cells, resolution } = getViewportCells(bounds, zoom);

      // Only send if the cells actually changed
      const cellsKey = cells.slice().sort().join(",");
      if (cellsKey === prevCellsKeyRef.current) return;

      prevCellsKeyRef.current = cellsKey;
      onCellsChanged(cells, resolution);
    },
    [onCellsChanged],
  );

  const handleCameraChanged = useCallback(
    (bounds: ViewportBounds, zoom: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        computeAndSend(bounds, zoom);
      }, DEBOUNCE_MS);
    },
    [computeAndSend],
  );

  return { handleCameraChanged };
}
