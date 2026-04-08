#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAG="${1:-latest}"

bash "${ROOT_DIR}/database/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/api/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/gateway/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/dataservices/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/discoverystore/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/mediaservices/dockerbuild.sh" "${TAG}"
bash "${ROOT_DIR}/garbagecollector/dockerbuild.sh" "${TAG}"