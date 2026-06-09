# =============================================================================
# SlipStream Backend Docker Bake Configuration
#
# Production build definition for docker buildx bake.
# The compose file (docker-compose.yml) is used only for local development;
# this file is the sole build definition for CI/CD.
#
# Usage:
#   Local (from repo root):
#     docker buildx bake              # Build api
#     docker buildx bake api          # Build api only
#
#   CI/CD (with registry push):
#     TAG=v1.0.0 SHA=abc123f docker buildx bake --push
#
#   Print resolved config:
#     docker buildx bake --print
# =============================================================================

# -----------------------------------------------------------------------------
# Variables (can be overridden via environment)
# -----------------------------------------------------------------------------

variable "TAG" {
  default = "latest"
}

variable "SHA" {
  default = ""
}

variable "REGISTRY" {
  default = ""
}

variable "IMAGE_NAME" {
  default = "slipstream-api"
}

# Set to any non-empty value to include :latest tags (prod releases only)
variable "PUSH_LATEST" {
  default = ""
}

# -----------------------------------------------------------------------------
# Tag helper functions
# -----------------------------------------------------------------------------

function "api_tags" {
  params = []
  result = compact([
    REGISTRY != "" ? "${REGISTRY}/${IMAGE_NAME}:${TAG}" : "${IMAGE_NAME}:${TAG}",
    PUSH_LATEST != "" ? (REGISTRY != "" ? "${REGISTRY}/${IMAGE_NAME}:latest" : "${IMAGE_NAME}:latest") : "",
    SHA != "" ? (REGISTRY != "" ? "${REGISTRY}/${IMAGE_NAME}:${SHA}" : "${IMAGE_NAME}:${SHA}") : "",
  ])
}

# -----------------------------------------------------------------------------
# Groups
# -----------------------------------------------------------------------------

group "default" {
  targets = ["api"]
}

# -----------------------------------------------------------------------------
# Shared build configuration for production
# -----------------------------------------------------------------------------

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"

  # Build exclusively for linux/amd64 (deployment target)
  platforms = ["linux/amd64"]

  # Disable provenance attestations to avoid extra untagged images in registries
  attest = ["type=provenance,disabled=true"]

  # GitHub Actions cache for faster CI builds
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
}

# -----------------------------------------------------------------------------
# API target - Production API server
# -----------------------------------------------------------------------------

target "api" {
  inherits = ["_common"]
  target   = "api"
  tags     = api_tags()
}
