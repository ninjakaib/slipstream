"""Simulated driver — a single WebSocket client that drives a route.

Each SimulatedDriver:
1. Authenticates via the REST API (register or login)
2. Connects to /ws/live with the real JWT
3. Sends location_update messages at a fixed interval
4. Loops its route indefinitely until cancelled
5. Sends heartbeats to keep the connection alive
"""

import asyncio
import json
import logging
import random

import websockets

from tools.simulator.config import (
    SPEED_RANGE_MPH,
    SPEED_VARIATION_MPH,
)
from tools.simulator.routes import compute_heading

logger = logging.getLogger(__name__)


class SimulatedDriver:
    """A real-user driver that connects via WebSocket and drives a route in a loop."""

    def __init__(
        self,
        driver_index: int,
        route: list[tuple[float, float]],
        token: str,
        ws_url: str,
        update_interval: float = 1.0,
    ) -> None:
        self.driver_index = driver_index
        self.route = route
        self.token = token
        self.ws_url = ws_url
        self.update_interval = update_interval
        self.username = f"sim_{driver_index:04d}"

        # Randomize base speed for this driver
        self.base_speed = random.uniform(*SPEED_RANGE_MPH)

        # Stats
        self.updates_sent = 0
        self._running = True

    async def run(self) -> None:
        """Main loop — connect and drive until cancelled."""
        while self._running:
            try:
                await self._drive_session()
            except websockets.exceptions.ConnectionClosed as e:
                if not self._running:
                    break
                logger.warning(
                    f"[{self.username}] Connection closed ({e.code}), reconnecting in 2s..."
                )
                await asyncio.sleep(2)
            except OSError as e:
                if not self._running:
                    break
                logger.warning(
                    f"[{self.username}] Connection failed ({e}), retrying in 3s..."
                )
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                break

    async def _drive_session(self) -> None:
        """A single WebSocket session — connect, drive route, loop."""
        url = f"{self.ws_url}?token={self.token}"

        async with websockets.connect(url) as ws:
            logger.info(f"[{self.username}] Connected")

            # Start heartbeat task
            heartbeat_task = asyncio.create_task(self._heartbeat_loop(ws))

            try:
                await self._drive_loop(ws)
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass

    async def _drive_loop(self, ws) -> None:
        """Drive the route in a loop, sending location updates."""
        route_position = random.randint(0, len(self.route) - 1)  # Random start offset

        while self._running:
            for i in range(len(self.route)):
                if not self._running:
                    return

                idx = (route_position + i) % len(self.route)
                lat, lng = self.route[idx]

                # Compute heading from current to next point
                next_idx = (idx + 1) % len(self.route)
                next_lat, next_lng = self.route[next_idx]
                heading = compute_heading(lat, lng, next_lat, next_lng)

                # Vary speed slightly each update
                speed = self.base_speed + random.uniform(
                    -SPEED_VARIATION_MPH, SPEED_VARIATION_MPH
                )
                speed = max(5.0, min(speed, 120.0))

                # Build and send location update
                message = {
                    "type": "location_update",
                    "payload": {
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "heading": round(heading, 1),
                        "speed": round(speed, 1),
                        "status": "driving",
                    },
                }
                await ws.send(json.dumps(message))
                self.updates_sent += 1

                await asyncio.sleep(self.update_interval)

            # Completed one loop — update start position for next lap
            route_position = (route_position + len(self.route)) % len(self.route)

    async def _heartbeat_loop(self, ws) -> None:
        """Send heartbeat every 15 seconds to keep connection alive."""
        try:
            while True:
                await asyncio.sleep(15)
                await ws.send(json.dumps({"type": "heartbeat"}))
        except asyncio.CancelledError:
            pass
        except websockets.exceptions.ConnectionClosed:
            pass

    def stop(self) -> None:
        """Signal this driver to stop."""
        self._running = False
