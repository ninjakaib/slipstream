/**
 * Buffer interpolation for smooth driver marker animation.
 *
 * The core idea (see docs/SMOOTH_ANIMATION_DESIGN.md): never predict the future,
 * render the recent past smoothly. We keep the last two received samples per
 * driver and, on each animation frame, interpolate the display position at a
 * time `RENDER_DELAY_MS` in the past — so we always interpolate between two
 * *known* positions rather than extrapolating into the unknown.
 *
 * This module is pure (no React, no side effects) so it can be unit-reasoned
 * about in isolation and driven by the requestAnimationFrame loop in
 * use-driver-interpolation.ts.
 */

/** How far behind real-time we render, in ms. One update interval (~1s). */
export const RENDER_DELAY_MS = 1000;

/**
 * How long to keep a driver's marker after it disappears from the store, in ms.
 * Absorbs transient empty snapshots so a one-frame blip doesn't flicker markers.
 */
export const REMOVAL_GRACE_MS = 2000;

/**
 * If the gap since a driver's last sample exceeds this, we snap on the next
 * sample instead of interpolating — the reconnect / long-stall case, where a
 * lerp across the gap would drag the marker in a straight line for seconds.
 */
export const RESET_GAP_MS = 5000;

export interface Sample {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  status: string;
  /** Client receive time (DriverData.updatedAt = Date.now() on receipt). */
  receivedAt: number;
}

export interface DriverBuffer {
  /** Previous sample; undefined until a second sample arrives (→ snap). */
  prev?: Sample;
  /** Most recent sample. */
  curr: Sample;
  /**
   * When set, the driver is gone from the store but still held on-map until
   * this timestamp (grace period). Cleared if the driver reappears.
   */
  removeAfter?: number;
}

/** Interpolated display state for a single driver at a given render time. */
export interface DisplayState {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  status: string;
}

export type BufferMap = Map<string, DriverBuffer>;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Shortest-arc heading interpolation. Rotating from 350° to 10° should sweep
 * +20° through north, not -340° the long way around.
 */
export function shortestArcHeading(from: number, to: number, t: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const result = from + delta * t;
  // Normalize into [0, 360).
  return ((result % 360) + 360) % 360;
}

/**
 * Insert a new sample into a driver's buffer, shifting curr → prev.
 * Returns a fresh buffer object. Handles two special cases:
 *  - First sample ever → no prev (interpolateAt will snap).
 *  - Gap since last sample > RESET_GAP_MS → reset to a single sample (snap),
 *    which prevents a long straight-line drag after a reconnect or stall.
 */
export function pushSample(
  existing: DriverBuffer | undefined,
  sample: Sample,
): DriverBuffer {
  if (!existing) {
    return { curr: sample };
  }

  const gap = sample.receivedAt - existing.curr.receivedAt;
  if (gap > RESET_GAP_MS) {
    // Treat as a fresh first sample — snap, then resume interpolating.
    return { curr: sample };
  }

  return { prev: existing.curr, curr: sample };
}

/**
 * Compute the display state for a driver at `renderTime`
 * (typically Date.now() - RENDER_DELAY_MS).
 *
 *  - No prev (first sample / just reset) → snap to curr.
 *  - renderTime within [prev, curr] → lerp position, shortest-arc heading.
 *  - renderTime >= curr (no newer sample yet) → hold at curr (t=1). A large gap
 *    keeps the marker held, producing a smooth stop rather than a jump.
 */
export function interpolateAt(
  buffer: DriverBuffer,
  renderTime: number,
): DisplayState {
  const { prev, curr } = buffer;

  if (!prev) {
    return toDisplay(curr);
  }

  const span = curr.receivedAt - prev.receivedAt;
  // Degenerate span (same timestamp) → just show curr.
  if (span <= 0) {
    return toDisplay(curr);
  }

  const t = clamp01((renderTime - prev.receivedAt) / span);

  return {
    lat: lerp(prev.lat, curr.lat, t),
    lng: lerp(prev.lng, curr.lng, t),
    heading: shortestArcHeading(prev.heading, curr.heading, t),
    speed: lerp(prev.speed, curr.speed, t),
    // Status is discrete — show the sample we're moving toward.
    status: curr.status,
  };
}

function toDisplay(s: Sample): DisplayState {
  return {
    lat: s.lat,
    lng: s.lng,
    heading: s.heading,
    speed: s.speed,
    status: s.status,
  };
}
