#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

SUDO=""
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

COMPOSE_BASE=($SUDO docker compose --env-file "${ROOT_DIR}/.env.cloud")

ensure_env_file() {
  if [[ ! -f "${ROOT_DIR}/.env.cloud" ]]; then
    cp "${ROOT_DIR}/.env.cloud.example" "${ROOT_DIR}/.env.cloud"
  fi
}

ensure_image() {
  local image="$1"
  if ! $SUDO docker image inspect "${image}" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

ensure_env_file

$SUDO chmod -R 777 "${ROOT_DIR}/database/data/" || true

if [[ "${FORCE_IMAGE_BUILD:-0}" == "1" ]]; then
  bash "${ROOT_DIR}/build.bash"
else
  if ! ensure_image "az-database:latest" || ! ensure_image "az-dataservices:latest" || ! ensure_image "az-api:latest" || ! ensure_image "az-gateway:latest"; then
    bash "${ROOT_DIR}/build.bash"
  fi
fi

# Remove stale ad-hoc API containers that can block compose from binding :8000.
mapfile -t PORT_8000_CONTAINERS < <($SUDO docker ps --filter "publish=8000" --format '{{.ID}} {{.Names}}')
for row in "${PORT_8000_CONTAINERS[@]}"; do
  container_id="${row%% *}"
  container_name="${row#* }"
  if [[ "${container_name}" != "workspace-api-0-1" ]]; then
    $SUDO docker stop "${container_id}" >/dev/null 2>&1 || true
    $SUDO docker rm "${container_id}" >/dev/null 2>&1 || true
  fi
done

"${COMPOSE_BASE[@]}" down --remove-orphans
"${COMPOSE_BASE[@]}" up -d jaeger scylla-seed dataservices-0 api-0 gateway-0

for i in $(seq 1 60); do
  STATUS="$($SUDO docker inspect --format='{{.State.Health.Status}}' workspace-scylla-seed-1 2>/dev/null || true)"
  if [[ "${STATUS}" == "healthy" ]]; then
    break
  fi
  sleep 2
done

if ! $SUDO docker exec workspace-scylla-seed-1 cqlsh -e "DESCRIBE KEYSPACE dataservices" >/dev/null 2>&1; then
  $SUDO docker exec workspace-scylla-seed-1 cqlsh -f /schema.cql
fi

echo "Stack is ready for UI development."
echo "Run: cd ui/app && npm run dev"