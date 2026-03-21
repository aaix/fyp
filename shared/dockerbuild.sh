TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=docker-build.inc.sh
source "${REPO_ROOT}/docker-build.inc.sh"
cd "${SCRIPT_DIR}" && bash "${SCRIPT_DIR}/py/compile_protos.bash"
docker_build_ci_aware shared-base -t "az-shared-base:${TAG}" "${SCRIPT_DIR}"
docker tag az-shared-base:${TAG} az-shared-base:latest # tag so that github actions can build it
