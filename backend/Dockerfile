# syntax=docker/dockerfile:1.9
# =============================================================================
# SlipStream Backend Dockerfile
# =============================================================================

# =============================================================================
# Stage: build - Python environment with dependencies
# =============================================================================
FROM python:3.13-slim-bookworm AS build

SHELL ["sh", "-exc"]

RUN <<EOT
apt-get update -qy
apt-get install -qyy \
    -o APT::Install-Recommends=false \
    -o APT::Install-Suggests=false \
    build-essential \
    ca-certificates \
    curl
apt-get clean
rm -rf /var/lib/apt/lists/*
EOT

COPY --from=ghcr.io/astral-sh/uv:0.7.12 /uv /usr/local/bin/

# Build argument to control editable installs
# Default: non-editable (production). Override in compose for development.
ARG UV_NO_EDITABLE=1

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=python3.13 \
    UV_PROJECT_ENVIRONMENT=/app \
    UV_NO_EDITABLE=${UV_NO_EDITABLE}

# Layer 1: Python dependencies (cached independently of source code)
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project

# Layer 2: Application source
COPY . /project
WORKDIR /project

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev


# =============================================================================
# Stage: runtime-base - Shared runtime foundation
# =============================================================================
FROM python:3.13-slim-bookworm AS runtime-base

SHELL ["sh", "-exc"]

RUN <<EOT
apt-get update -qy
apt-get install -qyy \
    -o APT::Install-Recommends=false \
    -o APT::Install-Suggests=false \
    ca-certificates \
    curl \
    libgeos-dev
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
EOT

RUN <<EOT
groupadd -g 1000 app
useradd -u 1000 -d /app -g app -N app
EOT

ENV PATH=/app/bin:$PATH

STOPSIGNAL SIGINT


# =============================================================================
# Stage: api - Production API server
# =============================================================================
FROM runtime-base AS api

# Re-declare so the import check can be skipped for editable (dev) builds.
ARG UV_NO_EDITABLE=1

COPY --from=build --chown=app:app /app /app

USER app
WORKDIR /app

# Verify the install. The import check only runs for non-editable (production)
# builds — editable installs resolve via /project which doesn't exist until
# the -dev stage adds it.
RUN <<EOT
python -V
python -Im site
if [ "${UV_NO_EDITABLE}" = "1" ]; then
    python -Ic 'import backend'
fi
EOT

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]


# =============================================================================
# Stage: api-dev - Development API with source for hot reload
#
# The editable install (UV_NO_EDITABLE=0) creates a .pth in /app that
# points to /project/src. This COPY provides the initial source so the
# import resolves on first boot; compose watch then syncs live changes.
# =============================================================================
FROM api AS api-dev

USER root
COPY --from=build --chown=app:app /project /project
USER app
WORKDIR /project

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
