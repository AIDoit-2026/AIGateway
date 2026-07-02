#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/docker-build.sh
#   IMAGE_NAME=myrepo/metapi ./scripts/docker-build.sh
#   PLATFORM=linux/amd64 ./scripts/docker-build.sh --no-cache
#   TAG_LATEST=0 VERSION=2.0.1 ./scripts/docker-build.sh
#
# Environment variables:
#   IMAGE_NAME   Docker image name. Default: 1467078763/metapi
#   VERSION      Image version tag. Default: package.json version
#   TAG_LATEST   Set to 0 to skip tagging :latest. Default: 1
#   PLATFORM     Optional docker build platform, such as linux/amd64
#   Extra script arguments are passed through to docker build.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

IMAGE_NAME="${IMAGE_NAME:-1467078763/metapi}"
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

echo "Building ${IMAGE_NAME}:${VERSION}"
if [ "$TAG_LATEST" != "0" ]; then
  echo "Also tagging ${IMAGE_NAME}:latest"
fi

docker build \
  "${PLATFORM_ARGS[@]}" \
  "${TAGS[@]}" \
  "$@" \
  -f "$ROOT_DIR/docker/Dockerfile" \
  "$ROOT_DIR"
