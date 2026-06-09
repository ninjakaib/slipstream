"""Redis client for real-time state management.

Provides:
- Async connection pool for imperative commands (GEOADD, HSET, etc.)
- Pub/sub listener task for real-time message dispatching
"""

import asyncio
import json
import logging

import redis.asyncio as aioredis

from backend.config import settings

logger = logging.getLogger(__name__)

# Global state — initialized in app lifespan
_pool: aioredis.ConnectionPool | None = None
_redis: aioredis.Redis | None = None
_pubsub_redis: aioredis.Redis | None = (
    None  # Dedicated connection for pub/sub (no timeout)
)
_pubsub_task: asyncio.Task | None = None


async def init_redis() -> None:
    """Initialize the Redis connection pool. Call once at app startup."""
    global _pool, _redis, _pubsub_redis
    _pool = aioredis.ConnectionPool.from_url(
        settings.redis_url,
        decode_responses=True,
        max_connections=20,
    )
    _redis = aioredis.Redis(connection_pool=_pool)

    # Dedicated pub/sub connection with no socket timeout.
    # Pub/sub connections block indefinitely waiting for messages —
    # a socket_timeout would kill the listener when idle.
    _pubsub_redis = aioredis.Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=None,
        socket_connect_timeout=10,
    )

    # Verify connectivity
    try:
        await _redis.ping()
        logger.info("Redis connection established.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise


async def close_redis() -> None:
    """Close the Redis connection pool. Call once at app shutdown."""
    global _pool, _redis, _pubsub_redis, _pubsub_task

    if _pubsub_task and not _pubsub_task.done():
        _pubsub_task.cancel()
        try:
            await _pubsub_task
        except asyncio.CancelledError:
            pass
        _pubsub_task = None

    if _pubsub_redis:
        await _pubsub_redis.aclose()
        _pubsub_redis = None
    if _redis:
        await _redis.aclose()
        _redis = None
    if _pool:
        await _pool.aclose()
        _pool = None

    logger.info("Redis connection closed.")


def get_redis() -> aioredis.Redis:
    """Get the Redis client instance. Raises if not initialized."""
    if _redis is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis


async def start_pubsub_listener() -> None:
    """Start the background pub/sub listener task."""
    global _pubsub_task
    _pubsub_task = asyncio.create_task(_pubsub_loop())
    logger.info("Pub/sub listener started.")


async def _pubsub_loop() -> None:
    """Background loop: subscribe to location:* and convoy:* patterns,
    dispatch messages to locally-connected WebSocket clients.

    Uses a dedicated Redis connection with no socket timeout so the
    listener can block indefinitely waiting for messages.

    Automatically reconnects with exponential backoff on connection failures.
    """
    from backend.realtime.manager import manager

    if _pubsub_redis is None:
        logger.error("Pub/sub Redis client not initialized.")
        return

    backoff = 1  # Initial backoff in seconds
    max_backoff = 60  # Maximum backoff

    while True:
        pubsub = _pubsub_redis.pubsub()
        try:
            await pubsub.psubscribe("location:*", "convoy:*")
            logger.info("Subscribed to Redis patterns: location:*, convoy:*")
            backoff = 1  # Reset backoff on successful connection

            async for message in pubsub.listen():
                if message["type"] != "pmessage":
                    continue

                channel: str = message["channel"]
                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue

                # Find local connections subscribed to this channel and forward
                subscribers = manager.get_subscribers(channel)
                if subscribers:
                    await manager.broadcast_to_users(subscribers, data)

        except asyncio.CancelledError:
            # Graceful shutdown — exit the loop entirely
            logger.info("Pub/sub listener cancelled.")
            try:
                await pubsub.punsubscribe("location:*", "convoy:*")
                await pubsub.aclose()
            except Exception:
                pass
            return

        except Exception as e:
            logger.error(
                f"Pub/sub listener error, reconnecting in {backoff}s: {e}",
                exc_info=True,
            )
            try:
                await pubsub.punsubscribe("location:*", "convoy:*")
                await pubsub.aclose()
            except Exception:
                pass

            # Exponential backoff before reconnect
            try:
                await asyncio.sleep(backoff)
            except asyncio.CancelledError:
                return
            backoff = min(backoff * 2, max_backoff)
