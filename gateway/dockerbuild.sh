TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${REPO_ROOT}/docker-build.inc.sh"
bash "${REPO_ROOT}/shared/dockerbuild.sh" "${TAG}"

if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ -n "${SHARED_BASE_IMAGE:-}" ]; then
  docker tag "az-shared-base:${TAG}" "${SHARED_BASE_IMAGE}:${TAG}"
  docker tag "az-shared-base:${TAG}" "${SHARED_BASE_IMAGE}:latest"
  docker push "${SHARED_BASE_IMAGE}:${TAG}"
  docker push "${SHARED_BASE_IMAGE}:latest"
  base_ref="${SHARED_BASE_IMAGE}:${TAG}"
else
  base_ref="az-shared-base:latest"
fi

docker_build_ci_aware gateway --build-arg "BASE_IMAGE=${base_ref}" --build-context "shared=${REPO_ROOT}/shared/" "${REPO_ROOT}/gateway" -t "az-gateway:${TAG}"
