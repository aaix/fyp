TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${REPO_ROOT}/docker-build.inc.sh"
docker_build_ci_aware mediaservices -t "az-mediaservices:${TAG}" "${REPO_ROOT}/mediaservices"