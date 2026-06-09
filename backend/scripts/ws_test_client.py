"""WebSocket test client — simulates a user driving a route and receiving events.

Usage:
    cd backend
    uv run python scripts/ws_test_client.py [--username USERNAME] [--password PASSWORD]

Simulates:
  - Connecting via WebSocket with auth token
  - Sending location updates along a predefined route
  - Subscribing to an area
  - Receiving driver_entered / driver_location / convoy events
  - Sending heartbeats
"""

import argparse
import asyncio
import json
import math
import time

import httpx

try:
    import websockets
except ImportError:
    print("❌ Missing dependency. Run: uv pip install websockets")
    raise SystemExit(1)

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

# Simulated route: Angeles Crest Highway (series of lat/lng points)
ROUTE_POINTS = [
    (34.2052, -118.2264),  # Start: La Cañada Flintridge
    (34.2120, -118.2150),
    (34.2215, -118.2005),
    (34.2340, -118.1876),
    (34.2428, -118.1721),
    (34.2510, -118.1590),
    (34.2612, -118.1445),
    (34.2698, -118.1301),
    (34.2780, -118.1167),
    (34.2855, -118.1020),
    (34.2932, -118.0881),
    (34.3005, -118.0740),
    (34.3090, -118.0598),
    (34.3168, -118.0450),
    (34.3242, -118.0310),  # End: near Mt Wilson
]


def interpolate_points(points: list[tuple], steps_between: int = 5) -> list[tuple]:
    """Create smoother route by interpolating between waypoints."""
    result = []
    for i in range(len(points) - 1):
        lat1, lng1 = points[i]
        lat2, lng2 = points[i + 1]
        for step in range(steps_between):
            t = step / steps_between
            lat = lat1 + (lat2 - lat1) * t
            lng = lng1 + (lng2 - lng1) * t
            result.append((lat, lng))
    result.append(points[-1])
    return result


def calculate_heading(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate bearing between two points."""
    dlng = math.radians(lng2 - lng1)
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    x = math.sin(dlng) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(
        lat2_r
    ) * math.cos(dlng)
    heading = math.degrees(math.atan2(x, y))
    return (heading + 360) % 360


async def login(username: str, password: str) -> str:
    """Login and return access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "username": username,
                "password": password,
            },
        )
        if resp.status_code != 200:
            print(f"❌ Login failed: {resp.status_code} {resp.text}")
            raise SystemExit(1)
        data = resp.json()
        print(f"✅ Logged in as {data['username']} (id: {data['user_id']})")
        return data["access_token"]


async def receive_messages(ws) -> None:
    """Background task to print incoming WebSocket messages."""
    try:
        async for raw_msg in ws:
            msg = json.loads(raw_msg)
            msg_type = msg.get("type", "unknown")
            payload = msg.get("payload", {})

            if msg_type == "driver_entered":
                print(
                    f"  📍 DRIVER ENTERED: {payload.get('user_id', '?')[:8]}... "
                    f"status={payload.get('status')} at ({payload.get('lat'):.4f}, {payload.get('lng'):.4f})"
                )
            elif msg_type == "driver_exited":
                print(f"  👋 DRIVER EXITED: {payload.get('user_id', '?')[:8]}...")
            elif msg_type == "driver_location":
                print(
                    f"  🚗 LOCATION: {payload.get('user_id', '?')[:8]}... "
                    f"speed={payload.get('speed')} heading={payload.get('heading'):.0f}° "
                    f"road={payload.get('road_name', '')}"
                )
            elif msg_type == "convoy_event":
                print(
                    f"  🏁 CONVOY EVENT: {payload.get('event')} — {payload.get('data', {})}"
                )
            elif msg_type == "convoy_chat":
                print(
                    f"  💬 CHAT [{payload.get('sender_username')}]: {payload.get('content')}"
                )
            elif msg_type == "notification":
                print(f"  🔔 NOTIFICATION: {payload.get('message')}")
            else:
                print(f"  📨 {msg_type}: {json.dumps(payload, indent=2)[:200]}")
    except websockets.exceptions.ConnectionClosed:
        print("  ⚠️  WebSocket connection closed")


async def simulate_driving(username: str, password: str, speed_mph: int = 45) -> None:
    """Simulate a user driving a route."""
    token = await login(username, password)
    route = interpolate_points(ROUTE_POINTS, steps_between=8)

    print(f"\n🛣️  Starting drive simulation ({len(route)} points, ~{speed_mph} mph)")
    print(f"   Route: La Cañada Flintridge → Mt Wilson (Angeles Crest Hwy)")
    print(f"   Update interval: 2 seconds")
    print(f"   Press Ctrl+C to stop\n")

    async with websockets.connect(
        f"{WS_URL}?token={token}",
        additional_headers={"Origin": "http://localhost:8000"},
    ) as ws:
        # Start receiver task
        receiver = asyncio.create_task(receive_messages(ws))

        # Subscribe to area around the start of our route
        start_lat, start_lng = route[0]
        subscribe_msg = {
            "type": "subscribe_area",
            "payload": {
                "lat": start_lat,
                "lng": start_lng,
                "radius_miles": 15,
            },
        }
        await ws.send(json.dumps(subscribe_msg))
        print(f"📡 Subscribed to area: ({start_lat:.4f}, {start_lng:.4f}) r=15mi\n")

        # Wait a moment for initial driver_entered messages
        await asyncio.sleep(2)

        # Drive the route
        heartbeat_counter = 0
        try:
            for i, (lat, lng) in enumerate(route):
                # Calculate heading
                if i < len(route) - 1:
                    next_lat, next_lng = route[i + 1]
                    heading = calculate_heading(lat, lng, next_lat, next_lng)
                else:
                    heading = 0

                # Add some speed variation
                speed = speed_mph + int((math.sin(i * 0.3) * 15))
                speed = max(15, min(80, speed))

                # Send location update
                location_msg = {
                    "type": "location_update",
                    "payload": {
                        "lat": lat,
                        "lng": lng,
                        "heading": round(heading, 1),
                        "speed": speed,
                        "altitude": 1200 + i * 30,
                        "road_name": "Angeles Crest Hwy",
                        "status": "driving",
                    },
                }
                await ws.send(json.dumps(location_msg))
                print(
                    f"📤 Position {i + 1}/{len(route)}: ({lat:.4f}, {lng:.4f}) "
                    f"{speed}mph heading {heading:.0f}°"
                )

                # Send heartbeat every 15 seconds (every ~7 updates at 2s interval)
                heartbeat_counter += 1
                if heartbeat_counter >= 7:
                    await ws.send(json.dumps({"type": "heartbeat"}))
                    heartbeat_counter = 0
                    print("💓 Heartbeat sent")

                # Re-subscribe area periodically (every 30 updates)
                if i > 0 and i % 30 == 0:
                    subscribe_msg = {
                        "type": "subscribe_area",
                        "payload": {"lat": lat, "lng": lng, "radius_miles": 15},
                    }
                    await ws.send(json.dumps(subscribe_msg))
                    print(f"📡 Re-subscribed area to ({lat:.4f}, {lng:.4f})")

                await asyncio.sleep(2)

            print("\n🏁 Route complete! Parking...")
            # Send parked status
            await ws.send(
                json.dumps(
                    {
                        "type": "status_change",
                        "payload": {"status": "parked"},
                    }
                )
            )
            await asyncio.sleep(5)

        except KeyboardInterrupt:
            print("\n⏹️  Stopping simulation...")

        receiver.cancel()


async def multi_user_simulation() -> None:
    """Simulate multiple users driving simultaneously."""
    users = [
        ("apexkai", "testpass123"),
        ("boostedmia", "testpass123"),
        ("rallynoah", "testpass123"),
    ]

    print("🚗🚗🚗 Multi-user simulation — 3 drivers on Angeles Crest")
    print("=" * 60)

    tasks = []
    for i, (username, password) in enumerate(users):
        # Stagger start by a few seconds and vary speed
        await asyncio.sleep(1)
        speed = 40 + i * 10
        tasks.append(asyncio.create_task(simulate_driving(username, password, speed)))

    await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SlipStream WebSocket test client")
    parser.add_argument(
        "--username", "-u", default="apexkai", help="Username to login as"
    )
    parser.add_argument("--password", "-p", default="testpass123", help="Password")
    parser.add_argument(
        "--speed", "-s", type=int, default=45, help="Simulated speed (mph)"
    )
    parser.add_argument(
        "--multi", "-m", action="store_true", help="Run multi-user simulation"
    )

    args = parser.parse_args()

    try:
        if args.multi:
            asyncio.run(multi_user_simulation())
        else:
            asyncio.run(simulate_driving(args.username, args.password, args.speed))
    except KeyboardInterrupt:
        print("\n👋 Done.")
