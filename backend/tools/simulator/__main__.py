"""Simulator entry point — spawns N fake drivers on WebSocket connections.

Usage:
    cd backend
    uv run python -m tools.simulator [OPTIONS]

Options:
    --drivers N     Number of simulated drivers (default: 50)
    --url URL       WebSocket URL (default: ws://localhost:8000/ws/live)
    --interval S    Seconds between location updates (default: 1.0)
    --verbose       Enable debug logging

Examples:
    # 50 drivers at default settings
    uv run python -m tools.simulator

    # 200 drivers with debug output
    uv run python -m tools.simulator --drivers 200 --verbose

    # Quick test with 5 drivers
    uv run python -m tools.simulator --drivers 5 --verbose
"""

import argparse
import asyncio
import logging
import signal
import time
from urllib.parse import urlparse

import httpx

from tools.simulator.config import (
    DEFAULT_NUM_DRIVERS,
    SIM_CARS,
    SIM_PASSWORD,
    STAGGER_DELAY_SECONDS,
    UPDATE_INTERVAL_SECONDS,
    WS_URL,
)
from tools.simulator.driver import SimulatedDriver
from tools.simulator.routes import pick_route

logger = logging.getLogger(__name__)


async def ensure_user(
    client: httpx.AsyncClient,
    base_url: str,
    driver_index: int,
) -> tuple[str, str]:
    """Login or register a simulated user, returning (user_id, access_token).

    Tries to login first. If the user doesn't exist yet (401), falls back to
    registering. Since the simulator reuses the same users on every run, login
    is the common case — trying it first avoids an unnecessary register request.
    """
    username = f"sim_{driver_index:04d}"
    email = f"{username}@sim.slipstream.app"
    display_name = f"Sim Driver {driver_index}"
    car_template = SIM_CARS[driver_index % len(SIM_CARS)]

    # Try login first — the common case, since users persist across runs
    login_resp = await client.post(
        f"{base_url}/auth/login",
        json={"username": username, "password": SIM_PASSWORD},
    )

    if login_resp.status_code == 200:
        data = login_resp.json()
        logger.debug(f"[{username}] Logged in existing user: {data['user_id']}")
        return data["user_id"], data["access_token"]

    if login_resp.status_code != 401:
        raise RuntimeError(
            f"[{username}] Login failed ({login_resp.status_code}): {login_resp.text}"
        )

    # User doesn't exist yet — register with a dummy email
    register_resp = await client.post(
        f"{base_url}/auth/register",
        json={
            "email": email,
            "username": username,
            "password": SIM_PASSWORD,
            "display_name": display_name,
        },
    )

    if register_resp.status_code == 201:
        data = register_resp.json()
        token = data["access_token"]
        user_id = data["user_id"]
        logger.debug(f"[{username}] Registered new user: {user_id}")

        # Add a car for the new user
        await client.post(
            f"{base_url}/cars",
            json={**car_template, "is_active": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        return user_id, token

    raise RuntimeError(
        f"[{username}] Register failed ({register_resp.status_code}): {register_resp.text}"
    )


async def check_server(ws_url: str) -> bool:
    """Verify the server is reachable before spawning drivers."""
    parsed = urlparse(ws_url)
    scheme = "https" if parsed.scheme == "wss" else "http"
    health_url = f"{scheme}://{parsed.netloc}/health"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(health_url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✓ Server is up: {data.get('service', 'unknown')}")
                spatial = data.get("spatial", {})
                if spatial:
                    print(
                        f"  Current state: {spatial.get('connections', 0)} connections, "
                        f"{spatial.get('positions', 0)} positions"
                    )
                return True
            else:
                print(f"✗ Server returned {resp.status_code} from {health_url}")
                return False
    except httpx.ConnectError:
        print(f"✗ Cannot connect to server at {health_url}")
        print("  Make sure the server is running: docker compose up")
        return False
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False


async def run_simulation(
    num_drivers: int,
    ws_url: str,
    update_interval: float,
) -> None:
    """Spawn drivers and run until interrupted."""
    parsed = urlparse(ws_url)
    scheme = "https" if parsed.scheme == "wss" else "http"
    base_url = f"{scheme}://{parsed.netloc}"

    print(f"\n{'=' * 60}")
    print("  SlipStream Simulator")
    print(f"  Drivers: {num_drivers}")
    print(f"  Server:  {ws_url}")
    print(f"  Rate:    1 update every {update_interval}s per driver")
    print(f"{'=' * 60}\n")

    # Verify server is reachable
    if not await check_server(ws_url):
        print("\nAborting. Start the server first.")
        return

    # Login (or register) all simulated users
    print(f"\n⏳ Provisioning {num_drivers} simulated users...")
    drivers: list[SimulatedDriver] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(num_drivers):
            try:
                _, token = await ensure_user(client, base_url, i)
            except RuntimeError as e:
                logger.error(str(e))
                continue

            route = pick_route(i)
            driver = SimulatedDriver(
                driver_index=i,
                route=route,
                token=token,
                ws_url=ws_url,
                update_interval=update_interval,
            )
            drivers.append(driver)

    if not drivers:
        print("✗ No drivers could be provisioned. Check server logs.")
        return

    print(f"✓ Provisioned {len(drivers)} drivers with routes")
    print(f"  • Predefined routes: {min(len(drivers), 18)} drivers")
    print(f"  • Circular loops: {max(0, min(len(drivers) - 18, 20))} drivers")
    print(f"  • Random walks: {max(0, len(drivers) - 38)} drivers")
    print(
        f"\n⏳ Connecting drivers (stagger: {STAGGER_DELAY_SECONDS * 1000:.0f}ms)...\n"
    )

    # Handle shutdown signals
    shutdown_event = asyncio.Event()

    def signal_handler():
        print("\n\n⏹  Shutting down...")
        shutdown_event.set()
        for d in drivers:
            d.stop()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    # Launch all driver tasks with staggered starts
    tasks: list[asyncio.Task] = []
    for driver in drivers:
        task = asyncio.create_task(driver.run())
        tasks.append(task)
        await asyncio.sleep(STAGGER_DELAY_SECONDS)

    print(f"✓ All {len(drivers)} drivers launched\n")

    # Stats reporting loop
    start_time = time.time()
    try:
        while not shutdown_event.is_set():
            await asyncio.sleep(5)
            elapsed = time.time() - start_time
            total_updates = sum(d.updates_sent for d in drivers)
            rate = total_updates / elapsed if elapsed > 0 else 0
            connected = sum(1 for d in drivers if d._running)
            print(
                f"  \U0001f4ca {connected} drivers | "
                f"{total_updates:,} updates sent | "
                f"{rate:.0f} updates/sec | "
                f"{elapsed:.0f}s elapsed"
            )
    except asyncio.CancelledError:
        pass

    # Wait for all tasks to finish
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)

    total_updates = sum(d.updates_sent for d in drivers)
    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print("  Simulation complete")
    print(f"  Duration: {elapsed:.1f}s")
    print(f"  Total updates: {total_updates:,}")
    print(f"  Average rate: {total_updates / elapsed:.0f} updates/sec")
    print(f"{'=' * 60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SlipStream client simulator — fake drivers on WebSocket",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run python -m tools.simulator --drivers 50
  uv run python -m tools.simulator --drivers 200 --verbose
  uv run python -m tools.simulator --drivers 5 --url ws://remote:8000/ws/live
        """,
    )
    parser.add_argument(
        "--drivers",
        "-n",
        type=int,
        default=DEFAULT_NUM_DRIVERS,
        help=f"Number of simulated drivers (default: {DEFAULT_NUM_DRIVERS})",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=WS_URL,
        help=f"WebSocket server URL (default: {WS_URL})",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=UPDATE_INTERVAL_SECONDS,
        help=f"Seconds between location updates (default: {UPDATE_INTERVAL_SECONDS})",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    # Suppress noisy library logs unless verbose
    if not args.verbose:
        logging.getLogger("websockets").setLevel(logging.WARNING)
        logging.getLogger("httpx").setLevel(logging.WARNING)

    asyncio.run(run_simulation(args.drivers, args.url, args.interval))


if __name__ == "__main__":
    main()
