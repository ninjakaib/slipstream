import { useEffect } from "react";
import type { RefObject } from "react";
import type { ShapeSource } from "@rnmapbox/maps";

import type { DriverData } from "@/hooks/use-websocket";
import { useDriversStore } from "@/stores/drivers-store";
import {
  REMOVAL_GRACE_MS,
  RENDER_DELAY_MS,
  interpolateAt,
  pushSample,
  type BufferMap,
  type DriverBuffer,
} from "./driver-buffer";

/** Must match the `id` prop on the drivers <ShapeSource> in live-map.tsx. */
export const DRIVERS_SOURCE_ID = "drivers";

type SetNativePropsArg = Parameters<ShapeSource["setNativeProps"]>[0];

interface UseDriverInterpolationArgs {
  shapeSourceRef: RefObject<ShapeSource | null>;
}

function sampleFromDriver(driver: DriverData) {
  return {
    lat: driver.lat,
    lng: driver.lng,
    heading: driver.heading ?? 0,
    speed: driver.speed ?? 0,
    status: driver.status ?? "driving",
    receivedAt: driver.updatedAt,
  };
}

/**
 * Reconcile the current store snapshot into the per-driver buffer.
 *  - New / moved driver (changed updatedAt) → push a sample.
 *  - Reappeared driver (was in grace) → clear its removal timer.
 *  - Missing driver → start a grace timer instead of deleting immediately, so
 *    a transient empty snapshot doesn't flicker markers.
 */
function syncBuffer(
  buffer: BufferMap,
  drivers: Record<string, DriverData>,
  now: number,
): void {
  for (const driver of Object.values(drivers)) {
    const existing = buffer.get(driver.user_id);
    if (existing && existing.curr.receivedAt === driver.updatedAt) {
      // Same sample; just make sure it isn't pending removal.
      if (existing.removeAfter !== undefined) existing.removeAfter = undefined;
      continue;
    }
    const next: DriverBuffer = pushSample(existing, sampleFromDriver(driver));
    buffer.set(driver.user_id, next);
  }

  for (const [id, buf] of buffer) {
    if (!drivers[id] && buf.removeAfter === undefined) {
      buf.removeAfter = now + REMOVAL_GRACE_MS;
    }
  }
}

/**
 * Drives smooth marker animation. Owns a per-driver position buffer and a
 * requestAnimationFrame loop that interpolates the display position ~1s in the
 * past and pushes it straight to the native ShapeSource via setNativeProps —
 * keeping React reconciliation out of the per-frame hot path.
 *
 * See docs/SMOOTH_ANIMATION_DESIGN.md and ./driver-buffer.ts.
 */
export function useDriverInterpolation({
  shapeSourceRef,
}: UseDriverInterpolationArgs): void {
  useEffect(() => {
    const buffer: BufferMap = new Map();

    // Seed from whatever is already in the store (subscribe only fires on change).
    syncBuffer(buffer, useDriversStore.getState().drivers, Date.now());

    const unsubscribe = useDriversStore.subscribe((state) => {
      syncBuffer(buffer, state.drivers, Date.now());
    });

    let rafId: number;
    let lastWasEmpty = false;

    const frame = () => {
      const now = Date.now();
      const renderTime = now - RENDER_DELAY_MS;
      const features: GeoJSON.Feature[] = [];

      for (const [id, buf] of buffer) {
        if (buf.removeAfter !== undefined && now >= buf.removeAfter) {
          buffer.delete(id);
          continue;
        }
        const display = interpolateAt(buf, renderTime);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [display.lng, display.lat] },
          properties: {
            user_id: id,
            heading: display.heading,
            speed: display.speed,
            status: display.status,
          },
        });
      }

      // Skip pushing repeated empty collections to avoid idle bridge traffic,
      // but always push the first empty one so cleared markers disappear.
      const isEmpty = features.length === 0;
      if (!isEmpty || !lastWasEmpty) {
        // This is rnmapbox's sanctioned per-frame animation path: pass a GeoJSON
        // object as `shape` (no id) and its setNativeProps override stringifies
        // it and pushes straight to the native source — no React render. The
        // public type is stricter (string shape + required id) than the runtime,
        // so we cast to the method's parameter type.
        const shape = {
          type: "FeatureCollection",
          features,
        } as unknown as SetNativePropsArg["shape"];
        shapeSourceRef.current?.setNativeProps({ shape } as SetNativePropsArg);
      }
      lastWasEmpty = isEmpty;

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      unsubscribe();
    };
  }, [shapeSourceRef]);
}
