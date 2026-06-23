"""Generate a long-lived dev JWT token for a seeded user.

Usage:
    cd backend
    uv run python scripts/generate_dev_token.py [username]

Defaults to 'apexkai' if no username provided.
Requires postgres to be running with seeded data.
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/slipstream"


async def main() -> None:
    from backend.auth import create_access_token
    from backend.config import settings
    from backend.models import User
    from datetime import datetime, timedelta, UTC
    import jwt

    username = sys.argv[1] if len(sys.argv) > 1 else "apexkai"

    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user is None:
            print(f"❌ User '{username}' not found. Run seed.py first:")
            print("   uv run python scripts/seed.py")
            await engine.dispose()
            sys.exit(1)

        # Generate a 1-year token for local dev
        now = datetime.now(UTC)
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "iat": now,
            "exp": now + timedelta(days=365),
            "type": "access",
        }
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        print(f"\n✅ Dev token for '{user.username}' (ID: {user.id})")
        print(f"   Expires: {now + timedelta(days=365):%Y-%m-%d}")
        print(f"\n# Add this to slipstream/.env:")
        print(f"EXPO_PUBLIC_DEV_TOKEN={token}")
        print(f"\n# Raw token (for curl/Postman):")
        print(f"{token}")

    await engine.dispose()


if __name__ == "__main__":
    sys.path.insert(0, "src")
    asyncio.run(main())
