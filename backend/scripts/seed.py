"""Seed script — populate the database with test users, cars, friendships, and convoys.

Usage:
    cd backend
    uv run python scripts/seed.py

Requires the server's Docker Compose services (postgres) to be running.
"""

import asyncio
import random
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# -- Adjust these if your .env differs --
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/slipstream"

# Test users: (username, display_name, visibility)
TEST_USERS = [
    ("apexkai", "Kai", "on"),
    ("boostedmia", "Mia", "on"),
    ("rallynoah", "Noah", "on"),
    ("driftqueen", "Sakura", "friends_only"),
    ("canyoncarver", "Jake", "on"),
    ("turbotim", "Tim", "on"),
    ("rotaryray", "Ray", "ghost"),
    ("vtecliz", "Liz", "on"),
    ("flatsixter", "Porsche Pete", "friends_only"),
    ("evowrex", "Alex", "on"),
]

# Car data per user
TEST_CARS = [
    {
        "year": 2020,
        "make": "Toyota",
        "model": "Supra",
        "trim": "3.0 Premium",
        "color": "#FF6600",
        "mods": ["catback exhaust", "downpipe", "tune"],
    },
    {
        "year": 2019,
        "make": "Honda",
        "model": "Civic Type R",
        "trim": "FK8",
        "color": "#FFFFFF",
        "mods": ["coilovers", "front lip"],
    },
    {
        "year": 2022,
        "make": "Subaru",
        "model": "WRX",
        "trim": "STI",
        "color": "#003399",
        "mods": ["cold air intake", "accessport"],
    },
    {
        "year": 2018,
        "make": "Nissan",
        "model": "370Z",
        "trim": "Nismo",
        "color": "#CC0000",
        "mods": ["headers", "test pipes"],
    },
    {
        "year": 2021,
        "make": "Ford",
        "model": "Mustang",
        "trim": "GT",
        "color": "#333333",
        "mods": ["long tube headers", "supercharger"],
    },
    {
        "year": 2023,
        "make": "BMW",
        "model": "M3",
        "trim": "Competition",
        "color": "#1E90FF",
        "mods": ["carbon fiber hood"],
    },
    {
        "year": 1995,
        "make": "Mazda",
        "model": "RX-7",
        "trim": "FD",
        "color": "#FFCC00",
        "mods": ["single turbo conversion", "standalone ECU"],
    },
    {
        "year": 2020,
        "make": "Honda",
        "model": "Civic Si",
        "trim": None,
        "color": "#8B0000",
        "mods": ["hondata", "exhaust"],
    },
    {
        "year": 2022,
        "make": "Porsche",
        "model": "911",
        "trim": "GT3",
        "color": "#C0C0C0",
        "mods": [],
    },
    {
        "year": 2017,
        "make": "Mitsubishi",
        "model": "Lancer",
        "trim": "Evo X",
        "color": "#FFFFFF",
        "mods": ["big turbo", "intercooler", "tune"],
    },
]

# Los Angeles area coordinates for test positions
LA_POSITIONS = [
    (34.1341, -118.3215, "Angeles Crest Hwy"),
    (34.0922, -118.3500, "Mulholland Dr"),
    (34.0195, -118.4912, "Pacific Coast Highway"),
    (34.1478, -118.1445, "Foothill Blvd"),
    (34.0689, -118.4452, "Sunset Blvd"),
    (34.0407, -118.2468, "Downtown LA"),
    (33.9850, -118.4695, "Vista Del Mar"),
    (34.1808, -118.3090, "Angeles Forest Hwy"),
    (34.0259, -118.7798, "Malibu Canyon"),
    (34.0575, -118.3510, "La Cienega Blvd"),
]


async def main() -> None:
    from slipstream.auth import hash_password, create_access_token
    from slipstream.models import (
        Base,
        User,
        Car,
        Friendship,
        FriendshipStatus,
        Convoy,
        ConvoyMember,
        ConvoyMemberRole,
        ConvoyStatus,
        ConvoyVisibility,
    )

    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create all tables if they don't exist (skip alembic for dev seeding)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Ensured all tables exist")

    async with Session() as db:
        # Check if already seeded
        result = await db.execute(select(User).where(User.username == "apexkai"))
        if result.scalar_one_or_none():
            print("⚠️  Database already seeded. Drop tables or skip.")
            print(
                "   To reset: docker compose exec postgres psql -U postgres -d slipstream -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
            )
            print(
                "   Then re-run migrations: docker compose exec api alembic upgrade head"
            )
            await engine.dispose()
            return

        # -- Create users --
        users: list[User] = []
        for (username, display_name, visibility), car_data in zip(
            TEST_USERS, TEST_CARS
        ):
            user = User(
                username=username,
                display_name=display_name,
                password_hash=hash_password("testpass123"),
                email=f"{username}@test.slipstream.app",
                visibility=visibility,
                discovery_radius_miles=15,
            )
            db.add(user)
            await db.flush()
            users.append(user)

            # Add car
            car = Car(
                user_id=user.id,
                year=car_data["year"],
                make=car_data["make"],
                model=car_data["model"],
                trim=car_data["trim"],
                color=car_data["color"],
                mods=car_data["mods"],
                is_active=True,
            )
            db.add(car)

        print(f"✅ Created {len(users)} test users with cars")

        # -- Create friendships (make a connected group) --
        friendship_pairs = [
            (0, 1),
            (0, 2),
            (0, 3),
            (0, 4),  # apexkai friends with first 5
            (1, 2),
            (1, 3),
            (1, 5),  # boostedmia friends
            (2, 4),
            (2, 5),  # rallynoah friends
            (3, 8),  # driftqueen + flatsixter
            (4, 5),
            (4, 6),  # canyoncarver friends
            (7, 8),
            (7, 9),  # vtecliz friends
        ]

        for i, j in friendship_pairs:
            friendship = Friendship(
                requester_id=users[i].id,
                addressee_id=users[j].id,
                status=FriendshipStatus.ACCEPTED,
                accepted_at=datetime.now(UTC),
            )
            db.add(friendship)

        # Add a pending request for testing
        pending = Friendship(
            requester_id=users[9].id,  # evowrex
            addressee_id=users[0].id,  # → apexkai
            status=FriendshipStatus.PENDING,
        )
        db.add(pending)

        print(f"✅ Created {len(friendship_pairs)} friendships + 1 pending request")

        # -- Create a test convoy --
        convoy = Convoy(
            name="Angeles Crest Morning Run",
            leader_id=users[0].id,
            visibility=ConvoyVisibility.PUBLIC,
            status=ConvoyStatus.ACTIVE,
        )
        db.add(convoy)
        await db.flush()

        # Add members
        for idx in [0, 1, 2, 4]:
            member = ConvoyMember(
                convoy_id=convoy.id,
                user_id=users[idx].id,
                role=ConvoyMemberRole.LEADER if idx == 0 else ConvoyMemberRole.MEMBER,
            )
            db.add(member)

        print(f"✅ Created convoy: '{convoy.name}' with 4 members")

        await db.commit()

        # -- Print credentials for easy testing --
        print("\n" + "=" * 60)
        print("TEST CREDENTIALS (all passwords: testpass123)")
        print("=" * 60)
        print(f"{'Username':<16} {'User ID':<38} {'Visibility'}")
        print("-" * 60)
        for user in users:
            print(f"{user.username:<16} {str(user.id):<38} {user.visibility}")

        # Generate access tokens for quick testing
        print("\n" + "=" * 60)
        print("ACCESS TOKENS (valid for 15 minutes)")
        print("=" * 60)
        for user in users[:3]:
            token = create_access_token(user.id, user.username)
            print(f"\n{user.username}:")
            print(f"  {token}")

        print("\n" + "=" * 60)
        print("QUICK TEST COMMANDS")
        print("=" * 60)
        token = create_access_token(users[0].id, users[0].username)
        print(f"""
# Health check
curl http://localhost:8000/health

# Login as apexkai
curl -X POST http://localhost:8000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{{"username": "apexkai", "password": "testpass123"}}'

# Get profile (use token from login response)
curl http://localhost:8000/users/me \\
  -H "Authorization: Bearer {token}"

# List friends
curl http://localhost:8000/friends \\
  -H "Authorization: Bearer {token}"

# List cars
curl http://localhost:8000/cars \\
  -H "Authorization: Bearer {token}"
""")



if __name__ == "__main__":
    import sys

    sys.path.insert(0, "src")
    asyncio.run(main())
