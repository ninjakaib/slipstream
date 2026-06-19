/**
 * useWebSocket — manages the WebSocket connection to the spatial server.
 *
 * Handles:
 * - Connection lifecycle (connect, reconnect on drop)
 * - Sending viewport_update messages
 * - Receiving viewport_snapshot, driver_moved, driver_exited events
 * - Maintaining the drivers state map (user_id → driver data)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const RECONNECT_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * @typedef {'disconnected' | 'connecting' | 'connected'} ConnectionStatus
 */

/**
 * @param {string|null} token - JWT access token. Connection is only attempted when non-null.
 * @returns {{ drivers, status, sendViewportUpdate, stats }}
 */
export function useWebSocket(token) {
  const [drivers, setDrivers] = useState({});
  const [status, setStatus] = useState('disconnected');
  const [stats, setStats] = useState({ messagesReceived: 0, lastMessageAt: null });

  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const statsRef = useRef({ messagesReceived: 0 });
  const mountedRef = useRef(true);

  // Track the latest viewport cells to re-send on reconnect
  const lastViewportRef = useRef(null);

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
    if (!token || !mountedRef.current) return;

    cleanup();
    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Re-send last viewport if we're reconnecting
      if (lastViewportRef.current) {
        ws.send(JSON.stringify({
          type: 'viewport_update',
          payload: { cells: lastViewportRef.current },
        }));
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      statsRef.current.messagesReceived++;
      setStats({
        messagesReceived: statsRef.current.messagesReceived,
        lastMessageAt: Date.now(),
      });

      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.warn('Failed to parse WS message:', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
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
      console.warn('WebSocket error:', error);
    };
  }, [token, cleanup]);

  const handleMessage = useCallback((message) => {
    const { type, payload } = message;

    switch (type) {
      case 'viewport_snapshot':
        // Bulk add/update drivers from snapshot
        setDrivers((prev) => {
          const next = { ...prev };
          for (const driver of payload.drivers) {
            next[driver.user_id] = {
              ...driver,
              updatedAt: Date.now(),
            };
          }
          return next;
        });
        break;

      case 'driver_moved':
        // Update or add a single driver
        setDrivers((prev) => ({
          ...prev,
          [payload.user_id]: {
            ...payload,
            updatedAt: Date.now(),
          },
        }));
        break;

      case 'driver_exited':
        // Remove a driver
        setDrivers((prev) => {
          const next = { ...prev };
          delete next[payload.user_id];
          return next;
        });
        break;

      case 'heartbeat_ack':
        // No-op, connection is alive
        break;

      case 'error':
        console.warn('Server error:', payload.message);
        break;

      default:
        console.log('Unknown message type:', type, payload);
    }
  }, []);

  /**
   * Send a viewport_update to the server with the current H3 cells.
   * @param {string[]} cells - Array of H3 cell IDs
   */
  const sendViewportUpdate = useCallback((cells) => {
    lastViewportRef.current = cells;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'viewport_update',
        payload: { cells },
      }));
    }
  }, []);

  // Connect when token becomes available
  useEffect(() => {
    if (token) {
      connect();
    } else {
      cleanup();
      setStatus('disconnected');
      setDrivers({});
    }

    return () => {
      cleanup();
    };
  }, [token, connect, cleanup]);

  // Track mount state for async callbacks
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { drivers, status, sendViewportUpdate, stats };
}
