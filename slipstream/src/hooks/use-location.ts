/**
 * useLocation — foreground location tracking via expo-location.
 *
 * Requests permission, then watches the device position and exposes
 * the latest coordinates, heading, and speed. Fires a callback on each
 * update so callers can forward the position (e.g. over WebSocket).
 *
 * Runs as long as the component is mounted, regardless of which tab is active.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export interface LocationData {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
}

interface UseLocationOptions {
  /** Called on each position update (throttled by distanceInterval/timeInterval) */
  onLocationUpdate?: (location: LocationData) => void;
  /** Minimum distance in meters before a new update fires. Default 10m. */
  distanceInterval?: number;
  /** Minimum time in ms between updates. Default 1000ms (matches backend rate limit). */
  timeInterval?: number;
  /** Whether tracking is active. Default true. */
  enabled?: boolean;
}

interface UseLocationResult {
  location: LocationData | null;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
}

export function useLocation({
  onLocationUpdate,
  distanceInterval = 10,
  timeInterval = 1000,
  enabled = true,
}: UseLocationOptions = {}): UseLocationResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const callbackRef = useRef(onLocationUpdate);
  callbackRef.current = onLocationUpdate;

  const stopWatching = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopWatching();
      return;
    }

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        setError("Location permission not granted");
        return;
      }

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval,
          timeInterval,
        },
        (loc) => {
          const data: LocationData = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            heading: loc.coords.heading ?? 0,
            speed: Math.max(0, (loc.coords.speed ?? 0) * 2.237), // m/s → mph
          };
          setLocation(data);
          callbackRef.current?.(data);
        },
      );
    })();

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [enabled, distanceInterval, timeInterval, stopWatching]);

  return { location, permissionStatus, error };
}
