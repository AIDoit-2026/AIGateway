#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/docker-build.sh
#   IMAGE_NAME=aigateway ./scripts/docker-build.sh
#   PLATFORM=linux/amd64 ./scripts/docker-build.sh --no-cache
#   TAG_LATEST=0 VERSION=2.1.0 ./scripts/docker-build.sh
#   https_proxy=http://127.0.0.1:7890 ./scripts/docker-build.sh
#
# Environment variables:
#   IMAGE_NAME   Docker image name. Default: aigateway
#   VERSION      Image version tag. Default: package.json version
#   TAG_LATEST   Set to 0 to skip tagging :latest. Default: 1
#   PLATFORM     Optional docker build platform, such as linux/amd64
#   HTTPS_PROXY/https_proxy  Optional HTTPS proxy used by Docker build downloads.
#   Extra script arguments are passed through to docker build.

# LAST RUN 
# IMAGE_NAME=aigateway TAG_LATEST=0 VERSION=2.1.3 ./scripts/docker-build.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

IMAGE_NAME="${IMAGE_NAME:-aigateway}"
VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
TAG_LATEST="${TAG_LATEST:-1}"

TAGS=(-t "${IMAGE_NAME}:${VERSION}")
if [ "$TAG_LATEST" != "0" ]; then
  TAGS+=(-t "${IMAGE_NAME}:latest")
fi

PLATFORM_ARGS=()
if [ -n "${PLATFORM:-}" ]; then
  PLATFORM_ARGS=(--platform "$PLATFORM")
fi

PROXY_ARGS=()
HTTPS_PROXY_VALUE="${HTTPS_PROXY:-${https_proxy:-}}"

if [ -n "$HTTPS_PROXY_VALUE" ]; then
  PROXY_ARGS+=(--build-arg "HTTPS_PROXY=$HTTPS_PROXY_VALUE" --build-arg "https_proxy=$HTTPS_PROXY_VALUE")
fi

echo "Building ${IMAGE_NAME}:${VERSION}"
if [ "$TAG_LATEST" != "0" ]; then
  echo "Also tagging ${IMAGE_NAME}:latest"
fi

docker build \
  "${PLATFORM_ARGS[@]}" \
  "${PROXY_ARGS[@]}" \
  "${TAGS[@]}" \
  "$@" \
  -f "$ROOT_DIR/docker/Dockerfile" \
  "$ROOT_DIR"
