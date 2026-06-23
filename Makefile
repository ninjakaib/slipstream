.PHONY: openapi sdk sync-api install-hooks

# ---------------------------------------------------------------------------
# API contract management
# ---------------------------------------------------------------------------

OPENAPI_SPEC := openapi.json

## Generate the OpenAPI spec from the FastAPI app
openapi:
	cd backend && uv run --extra cli slipstream openapi -o ../$(OPENAPI_SPEC)

## Generate the TypeScript SDK from the OpenAPI spec
sdk: $(OPENAPI_SPEC)
	cd slipstream && npm run openapi-ts

## Regenerate spec + SDK in one step
sync-api: openapi sdk
	@echo "✅ API spec and SDK are in sync."

# ---------------------------------------------------------------------------
# Developer setup
# ---------------------------------------------------------------------------

## Install pre-commit hooks
install-hooks:
	pre-commit install

## Install all dependencies (backend + frontend)
install:
	cd backend && uv sync --extra cli --extra dev
	cd slipstream && npx expo install
	pre-commit install

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

## Show available targets
help:
	@echo "Available targets:"
	@echo "  make openapi       — Generate openapi.json from the FastAPI app"
	@echo "  make sdk           — Generate TypeScript SDK from openapi.json"
	@echo "  make sync-api      — Run both openapi + sdk generation"
	@echo "  make install       — Install all project dependencies"
	@echo "  make install-hooks — Install pre-commit git hooks"
