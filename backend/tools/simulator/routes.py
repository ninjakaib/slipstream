"""Route generation and predefined routes for simulated drivers.

Provides several route types:
- Predefined: Real LA roads (Angeles Crest, Mulholland, PCH, etc.)
- Circular: Parametric loops around a center point
- Random walk: Brownian motion with momentum (aimless cruising)

All routes are lists of (lat, lng) tuples.
"""

import math
import random

# ---------------------------------------------------------------------------
# Predefined routes — real LA area roads
# ---------------------------------------------------------------------------

ANGELES_CREST = [
    (34.2052, -118.2264),
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
    (34.3242, -118.0310),
]

MULHOLLAND_DRIVE = [
    (34.1280, -118.4690),
    (34.1265, -118.4550),
    (34.1240, -118.4400),
    (34.1230, -118.4250),
    (34.1210, -118.4100),
    (34.1195, -118.3950),
    (34.1175, -118.3800),
    (34.1160, -118.3650),
    (34.1140, -118.3500),
    (34.1120, -118.3350),
    (34.1100, -118.3200),
    (34.1085, -118.3050),
    (34.1070, -118.2900),
    (34.1055, -118.2750),
    (34.1040, -118.2600),
]

PCH_COASTAL = [
    (34.0370, -118.5510),
    (34.0320, -118.5620),
    (34.0270, -118.5730),
    (34.0210, -118.5850),
    (34.0150, -118.5970),
    (34.0090, -118.6090),
    (34.0030, -118.6210),
    (33.9970, -118.6330),
    (33.9910, -118.6450),
    (33.9850, -118.6570),
    (33.9790, -118.6690),
    (33.9720, -118.6810),
    (33.9660, -118.6930),
    (33.9600, -118.7050),
    (33.9540, -118.7170),
]

DOWNTOWN_GRID = [
    (34.0407, -118.2468),
    (34.0440, -118.2468),
    (34.0470, -118.2468),
    (34.0470, -118.2510),
    (34.0470, -118.2550),
    (34.0440, -118.2550),
    (34.0407, -118.2550),
    (34.0407, -118.2590),
    (34.0407, -118.2630),
    (34.0440, -118.2630),
    (34.0470, -118.2630),
    (34.0470, -118.2670),
    (34.0440, -118.2670),
    (34.0407, -118.2670),
    (34.0407, -118.2468),  # Loop back
]

GRIFFITH_PARK_LOOP = [
    (34.1185, -118.3004),
    (34.1220, -118.2960),
    (34.1260, -118.2920),
    (34.1300, -118.2950),
    (34.1340, -118.2990),
    (34.1360, -118.3040),
    (34.1350, -118.3100),
    (34.1320, -118.3140),
    (34.1280, -118.3160),
    (34.1240, -118.3140),
    (34.1210, -118.3100),
    (34.1190, -118.3050),
    (34.1185, -118.3004),  # Loop back
]

SUNSET_STRIP = [
    (34.0938, -118.3860),
    (34.0935, -118.3790),
    (34.0930, -118.3720),
    (34.0925, -118.3650),
    (34.0920, -118.3580),
    (34.0915, -118.3510),
    (34.0910, -118.3440),
    (34.0905, -118.3370),
    (34.0900, -118.3300),
    (34.0895, -118.3230),
    (34.0890, -118.3160),
    (34.0885, -118.3090),
    (34.0880, -118.3020),
]

PREDEFINED_ROUTES: list[list[tuple[float, float]]] = [
    ANGELES_CREST,
    MULHOLLAND_DRIVE,
    PCH_COASTAL,
    DOWNTOWN_GRID,
    GRIFFITH_PARK_LOOP,
    SUNSET_STRIP,
]


# ---------------------------------------------------------------------------
# Route generation utilities
# ---------------------------------------------------------------------------


def interpolate_route(
    waypoints: list[tuple[float, float]], steps_between: int = 10
) -> list[tuple[float, float]]:
    """Interpolate between waypoints for smooth movement.

    Takes a coarse route and adds intermediate points so that at 1 update/sec,
    the driver moves at a realistic-looking pace.
    """
    if len(waypoints) < 2:
        return waypoints

    result: list[tuple[float, float]] = []
    for i in range(len(waypoints) - 1):
        lat1, lng1 = waypoints[i]
        lat2, lng2 = waypoints[i + 1]
        for step in range(steps_between):
            t = step / steps_between
            lat = lat1 + (lat2 - lat1) * t
            lng = lng1 + (lng2 - lng1) * t
            result.append((lat, lng))
    result.append(waypoints[-1])
    return result


def generate_circular_route(
    center: tuple[float, float],
    radius_km: float = 2.0,
    num_points: int = 60,
) -> list[tuple[float, float]]:
    """Generate a circular/elliptical loop around a center point.

    Good for testing cell transitions — the driver continuously crosses
    cell boundaries as it orbits.
    """
    lat_center, lng_center = center
    # Approximate conversion: 1 degree lat ≈ 111 km, 1 degree lng ≈ 85 km at LA latitude
    lat_radius = radius_km / 111.0
    lng_radius = radius_km / 85.0

    # Add some eccentricity for variety
    eccentricity = random.uniform(0.7, 1.3)
    lng_radius *= eccentricity

    # Random starting angle and direction
    start_angle = random.uniform(0, 2 * math.pi)
    direction = random.choice([1, -1])

    route: list[tuple[float, float]] = []
    for i in range(num_points):
        angle = start_angle + direction * (2 * math.pi * i / num_points)
        lat = lat_center + lat_radius * math.sin(angle)
        lng = lng_center + lng_radius * math.cos(angle)
        route.append((lat, lng))

    # Close the loop
    route.append(route[0])
    return route


def generate_random_walk(
    start: tuple[float, float],
    num_steps: int = 120,
    step_size_km: float = 0.05,
    momentum: float = 0.85,
) -> list[tuple[float, float]]:
    """Generate a random walk with momentum (simulates aimless cruising).

    The momentum parameter (0-1) controls how much the previous direction
    influences the next step. Higher = smoother, more car-like paths.
    """
    lat, lng = start
    # Convert step size to degrees
    step_lat = step_size_km / 111.0
    step_lng = step_size_km / 85.0

    # Initial random direction
    angle = random.uniform(0, 2 * math.pi)

    route: list[tuple[float, float]] = [(lat, lng)]
    for _ in range(num_steps):
        # Apply momentum + random perturbation
        angle = angle * momentum + random.gauss(0, 0.5) * (1 - momentum)
        # Occasionally make a sharper turn (simulating intersections)
        if random.random() < 0.05:
            angle += random.choice([-math.pi / 2, math.pi / 2])

        lat += step_lat * math.sin(angle)
        lng += step_lng * math.cos(angle)

        # Keep within reasonable bounds of LA
        lat = max(33.7, min(34.4, lat))
        lng = max(-118.9, min(-117.8, lng))

        route.append((lat, lng))

    return route


def pick_route(driver_index: int) -> list[tuple[float, float]]:
    """Pick a route for a driver based on their index.

    Distributes drivers across route types:
    - First N use predefined routes (with offset starts)
    - Next batch use circular loops at various locations
    - Remaining use random walks from scattered starting points
    """
    num_predefined = len(PREDEFINED_ROUTES)

    if driver_index < num_predefined * 3:
        # Use predefined routes (multiple drivers per route, offset starts)
        route_idx = driver_index % num_predefined
        base_route = PREDEFINED_ROUTES[route_idx]
        route = interpolate_route(base_route, steps_between=8)

        # Offset the starting position so drivers on the same route aren't stacked
        offset = (driver_index // num_predefined) * (len(route) // 4)
        route = route[offset:] + route[:offset]
        return route

    elif driver_index < num_predefined * 3 + 20:
        # Circular loops at various LA locations
        centers = [
            (34.0522, -118.2437),  # Downtown
            (34.0195, -118.4912),  # Santa Monica
            (34.1478, -118.1445),  # Pasadena
            (33.9850, -118.4695),  # El Segundo
            (34.0689, -118.3500),  # Beverly Hills
            (34.1808, -118.3090),  # Glendale
            (34.0259, -118.2798),  # USC area
            (33.9425, -118.4081),  # Torrance
            (34.1700, -118.4500),  # Encino
            (34.0620, -118.1600),  # Alhambra
        ]
        center = centers[(driver_index - num_predefined * 3) % len(centers)]
        radius = random.uniform(1.0, 4.0)
        return generate_circular_route(center, radius_km=radius, num_points=80)

    else:
        # Random walks from scattered starting points
        lat = 34.0522 + random.uniform(-0.15, 0.15)
        lng = -118.2437 + random.uniform(-0.25, 0.25)
        return generate_random_walk(
            start=(lat, lng),
            num_steps=200,
            step_size_km=random.uniform(0.03, 0.08),
        )


def compute_heading(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    """Compute bearing (heading) between two points in degrees [0, 360)."""
    dlng = math.radians(lng2 - lng1)
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    x = math.sin(dlng) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(
        lat2_r
    ) * math.cos(dlng)
    heading = math.degrees(math.atan2(x, y))
    return (heading + 360) % 360
