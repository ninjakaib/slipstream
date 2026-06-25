"""Simulation parameters and constants."""

# Server endpoints
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/live"

# Timing
UPDATE_INTERVAL_SECONDS = 5.0
STAGGER_DELAY_SECONDS = 0.05  # Delay between spawning each driver

# Driving parameters
SPEED_RANGE_MPH = (20, 75)
SPEED_VARIATION_MPH = 10  # +/- random variation per update

# Geography: Los Angeles area
LA_CENTER = (34.0522, -118.2437)
SPREAD_RADIUS_KM = 25.0

# Defaults
DEFAULT_NUM_DRIVERS = 50
