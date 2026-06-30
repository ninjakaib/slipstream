"""Simulation parameters and constants."""

# Server endpoints
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/live"

# Timing
UPDATE_INTERVAL_SECONDS = 1.0
STAGGER_DELAY_SECONDS = 0.05  # Delay between spawning each driver

# Driving parameters
SPEED_RANGE_MPH = (20, 75)
SPEED_VARIATION_MPH = 10  # +/- random variation per update

# Geography: Los Angeles area
LA_CENTER = (34.0522, -118.2437)
SPREAD_RADIUS_KM = 25.0

# Defaults
DEFAULT_NUM_DRIVERS = 50

# Simulated user credentials
SIM_PASSWORD = "password"

# Car templates assigned to simulated drivers
SIM_CARS = [
    {
        "year": 2023,
        "make": "BMW",
        "model": "M3",
        "color": "Alpine White",
        "trim": "Competition",
    },
    {
        "year": 2022,
        "make": "Porsche",
        "model": "911 GT3",
        "color": "Guards Red",
        "trim": "Touring",
    },
    {
        "year": 2024,
        "make": "Toyota",
        "model": "GR Supra",
        "color": "Phantom Matte Gray",
        "trim": "3.0 Premium",
    },
    {
        "year": 2021,
        "make": "Chevrolet",
        "model": "Corvette",
        "color": "Torch Red",
        "trim": "Stingray Z51",
    },
    {
        "year": 2023,
        "make": "Ford",
        "model": "Mustang GT",
        "color": "Grabber Blue",
        "trim": "Premium",
    },
    {
        "year": 2022,
        "make": "Nissan",
        "model": "Z",
        "color": "Seiran Blue",
        "trim": "Performance",
    },
    {
        "year": 2024,
        "make": "Mercedes-AMG",
        "model": "C 63 S",
        "color": "Obsidian Black",
        "trim": "E Performance",
    },
    {
        "year": 2023,
        "make": "Mazda",
        "model": "MX-5 Miata",
        "color": "Soul Red Crystal",
        "trim": "Club",
    },
    {
        "year": 2022,
        "make": "Subaru",
        "model": "WRX",
        "color": "WR Blue Pearl",
        "trim": "STI",
    },
    {
        "year": 2023,
        "make": "Honda",
        "model": "Civic Type R",
        "color": "Championship White",
        "trim": "FL5",
    },
    {
        "year": 2024,
        "make": "Audi",
        "model": "RS 5",
        "color": "Nardo Gray",
        "trim": "Sportback",
    },
    {
        "year": 2021,
        "make": "Dodge",
        "model": "Challenger",
        "color": "Hellraisin",
        "trim": "Scat Pack",
    },
    {
        "year": 2023,
        "make": "Lexus",
        "model": "IS 500",
        "color": "Incognito",
        "trim": "F SPORT Performance",
    },
    {
        "year": 2022,
        "make": "Hyundai",
        "model": "Elantra N",
        "color": "Performance Blue",
        "trim": "DCT",
    },
    {
        "year": 2024,
        "make": "Volkswagen",
        "model": "Golf R",
        "color": "Lapiz Blue",
        "trim": "DSG",
    },
    {
        "year": 2023,
        "make": "Tesla",
        "model": "Model 3",
        "color": "Midnight Silver",
        "trim": "Performance",
    },
    {
        "year": 2022,
        "make": "Alfa Romeo",
        "model": "Giulia",
        "color": "Rosso Competizione",
        "trim": "Quadrifoglio",
    },
    {
        "year": 2023,
        "make": "Genesis",
        "model": "G70",
        "color": "Havana Red",
        "trim": "3.3T Sport",
    },
    {
        "year": 2024,
        "make": "Kia",
        "model": "Stinger",
        "color": "Ascot Green",
        "trim": "GT",
    },
    {
        "year": 2021,
        "make": "McLaren",
        "model": "720S",
        "color": "Papaya Spark",
        "trim": "Performance",
    },
]
