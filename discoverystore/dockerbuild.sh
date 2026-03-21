TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=docker-build.inc.sh
source "${REPO_ROOT}/docker-build.inc.sh"
docker_build_ci_aware discoverystore -t "az-discoverystore:${TAG}" "${REPO_ROOT}/discoverystore"