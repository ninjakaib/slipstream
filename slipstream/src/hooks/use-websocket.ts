/**
 * useWebSocket — manages the WebSocket connection to the spatial server.
 *
 * Handles:
 * - Connection lifecycle (connect, reconnect on drop)
 * - Sending viewport_update messages
 * - Receiving viewport_snapshot, driver_moved, driver_exited events
 * - Maintaining the drivers state map (user_id → driver data)
 *
 * Ported from demo/src/hooks/useWebSocket.js for React Native / TypeScript.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface DriverData {
  user_id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  status: string;
  updatedAt: number;
}

export interface WebSocketStats {
  messagesReceived: number;
  lastMessageAt: number | null;
}

interface WebSocketMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface UseWebSocketResult {
  drivers: Record<string, DriverData>;
  status: ConnectionStatus;
  sendViewportUpdate: (cells: string[]) => void;
  stats: WebSocketStats;
}

/**
 * @param serverUrl - Base URL of the backend server (e.g. "ws://192.168.1.100:8000")
 * @param token - JWT access token. Connection is only attempted when non-null.
 */
export function useWebSocket(
  serverUrl: string | null,
  token: string | null,
): UseWebSocketResult {
  const [drivers, setDrivers] = useState<Record<string, DriverData>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [stats, setStats] = useState<WebSocketStats>({
    messagesReceived: 0,
    lastMessageAt: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef({ messagesReceived: 0 });
  const mountedRef = useRef(true);

  // Track the latest viewport cells to re-send on reconnect
  const lastViewportRef = useRef<string[] | null>(null);

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || !serverUrl || !mountedRef.current) return;

    cleanup();
    setStatus("connecting");

    const wsUrl = `${serverUrl}/ws/live?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Re-send last viewport if we're reconnecting
      if (lastViewportRef.current) {
        ws.send(
          JSON.stringify({
            type: "viewport_update",
            payload: { cells: lastViewportRef.current },
          }),
        );
      }
    };

    ws.onmessage = (event: WebSocketMessageEvent) => {
      if (!mountedRef.current) return;

      statsRef.current.messagesReceived++;
      setStats({
        messagesReceived: statsRef.current.messagesReceived,
        lastMessageAt: Date.now(),
      });

      try {
        const message: WebSocketMessage = JSON.parse(
          event.data as string,
        );
        handleMessage(message);
      } catch (e) {
        console.warn("Failed to parse WS message:", e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Auto-reconnect
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current && token) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    };

    ws.onerror = (error) => {
      console.warn("WebSocket error:", error);
    };
  }, [token, serverUrl, cleanup]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    const { type, payload } = message;

    switch (type) {
      case "viewport_snapshot": {
        const snapshotDrivers = (payload?.drivers ?? []) as DriverData[];
        setDrivers((prev) => {
          const next = { ...prev };
          for (const driver of snapshotDrivers) {
            next[driver.user_id] = {
              ...driver,
              updatedAt: Date.now(),
            };
          }
          return next;
        });
        break;
      }

      case "driver_moved": {
        const moved = payload as unknown as DriverData;
        setDrivers((prev) => ({
          ...prev,
          [moved.user_id]: {
            ...moved,
            updatedAt: Date.now(),
          },
        }));
        break;
      }

      case "driver_exited": {
        const exitedId = payload?.user_id as string;
        setDrivers((prev) => {
          const next = { ...prev };
          delete next[exitedId];
          return next;
        });
        break;
      }

      case "heartbeat_ack":
        break;

      case "error":
        console.warn("Server error:", payload?.message);
        break;

      default:
        console.log("Unknown message type:", type, payload);
    }
  }, []);

  /**
   * Send a viewport_update to the server with the current H3 cells.
   */
  const sendViewportUpdate = useCallback((cells: string[]) => {
    lastViewportRef.current = cells;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "viewport_update",
          payload: { cells },
        }),
      );
    }
  }, []);

  // Connect when token becomes available
  useEffect(() => {
    if (token && serverUrl) {
      connect();
    } else {
      cleanup();
      setStatus("disconnected");
      setDrivers({});
    }

    return () => {
      cleanup();
    };
  }, [token, serverUrl, connect, cleanup]);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { drivers, status, sendViewportUpdate, stats };
}
