TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=docker-build.inc.sh
source "${REPO_ROOT}/docker-build.inc.sh"
bash "${REPO_ROOT}/shared/dockerbuild.sh" "${TAG}"
docker_build_ci_aware api --build-context "shared=${REPO_ROOT}/shared/" "${REPO_ROOT}/api" -t "az-api:${TAG}"
