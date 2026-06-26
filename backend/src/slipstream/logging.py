"""Structured logging configuration for SlipStream.

Uses structlog with rich ConsoleRenderer for colorful dev output,
and JSON rendering for production. Integrates stdlib logging so all
libraries (SQLAlchemy, uvicorn, etc.) also flow through structlog's
formatting pipeline.
"""

import logging
import sys
import time
from typing import Any

import structlog

from slipstream.config import settings


def _setup_structlog() -> None:
    """Configure structlog processors and stdlib integration.

    Uses the "stdlib as backend" pattern: structlog wraps stdlib loggers,
    and all output (both structlog-originated and third-party stdlib logs)
    flows through a single ProcessorFormatter on the root handler.
    """

    # Processors that run inside structlog before handing off to stdlib.
    # These enrich the event dict with context, then route to stdlib.
    structlog_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        # Hand off to stdlib — the ProcessorFormatter will render.
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ]

    structlog.configure(
        processors=structlog_processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Shared pre_chain for "foreign" (non-structlog) log records from
    # third-party libraries like uvicorn, sqlalchemy, etc.
    foreign_pre_chain: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.debug:
        # Dev: rich colored console output
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(
            colors=True,
        )
    else:
        # Production: JSON lines for log aggregation
        renderer = structlog.processors.JSONRenderer()

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=foreign_pre_chain,
    )

    # Wire up stdlib root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # Silence noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("websockets.protocol").setLevel(logging.WARNING)
    logging.getLogger("websockets.server").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


def setup_logging() -> None:
    """Public entry point: configure structured logging for the app."""
    _setup_structlog()


def get_logger(name: str | None = None, **initial_ctx: Any) -> structlog.stdlib.BoundLogger:
    """Get a structlog bound logger, optionally with initial context.

    Usage:
        logger = get_logger(__name__)
        logger = get_logger(__name__, user_id="abc", username="kai")
    """
    log = structlog.get_logger(name)
    if initial_ctx:
        log = log.bind(**initial_ctx)
    return log


# ---------------------------------------------------------------------------
# ASGI Request Logging Middleware
# ---------------------------------------------------------------------------


class RequestLoggingMiddleware:
    """Pure ASGI middleware that logs HTTP requests with method, path, status, and duration.

    Skips:
        - /health endpoint (noisy health checks)
        - WebSocket upgrade requests (logged separately by the spatial router)
    """

    def __init__(self, app: Any) -> None:
        self.app = app
        self.logger = get_logger("slipstream.middleware.request")

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            # Pass through WebSocket and lifespan events untouched
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Skip health checks
        if path == "/health":
            await self.app(scope, receive, send)
            return

        # Skip WebSocket upgrade requests (they have Upgrade header)
        headers = dict(scope.get("headers", []))
        if headers.get(b"upgrade", b"").lower() == b"websocket":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "???")
        start_time = time.perf_counter()
        status_code = 500  # default if something goes wrong before response

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            self.logger.info(
                "request",
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=round(duration_ms, 1),
            )
