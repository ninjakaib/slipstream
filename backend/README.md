# SlipStream Backend

Real-time social driving network API built with FastAPI and Postgres/PostGIS.

## Quick Start (Docker Compose)

### 1. Create `.env` file

```bash
cat > .env << 'EOF'
# Postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=slipstream
POSTGRES_PORT=5432

# API
API_PORT=8000

# App settings (container URLs are set in docker-compose.yml environment block)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/slipstream


# JWT (generate a real secret: openssl rand -hex 32)
JWT_SECRET_KEY=local-dev-secret-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# App
APP_NAME=SlipStream
DEBUG=true
EOF
```

### 2. Start services with hot reload

```bash
docker compose up --watch
```

This starts:
- **Postgres** (PostGIS) on port 5432
- **FastAPI** on port 8000 (with hot reload via compose watch)

### 3. Run migrations

```bash
# With the containers running, exec into the API container:
docker compose exec api alembic -c /project/alembic.ini upgrade head

# Or generate a new migration:
docker compose exec api alembic -c /project/alembic.ini revision --autogenerate -m "description"
```

### 4. Access the API

- Health check: http://localhost:8000/health
- Swagger docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Local Development (without Docker)

```bash
# Install dependencies
uv sync

# Create .env file (see above)

# Run migrations
uv run alembic upgrade head

# Start the server
uv run backend
```

## Production Build

```bash
# Build with docker bake
docker buildx bake

# Build and push with tags
TAG=v1.0.0 SHA=$(git rev-parse --short HEAD) docker buildx bake --push
```

## Project Structure

```
backend/
├── src/slipstream/
│   ├── __init__.py          # Package entry point
│   ├── main.py              # FastAPI app instance
│   ├── config.py            # Settings (env vars)
│   ├── database.py          # Async SQLAlchemy engine + session
│   ├── models.py            # ORM models
│   ├── auth.py              # Password hashing, JWT utilities
│   ├── dependencies.py      # FastAPI dependencies (auth)
│   └── routers/
│       ├── __init__.py
│       └── auth.py          # /auth endpoints
├── alembic/
│   ├── env.py               # Async migration environment
│   ├── script.py.mako       # Migration template
│   └── versions/            # Migration files
├── alembic.ini              # Alembic config
├── Dockerfile               # Multi-stage (build → api → api-dev)
├── docker-compose.yml       # Local dev (postgres + api)
├── docker-bake.hcl          # Production build targets
└── pyproject.toml           # Dependencies
```
