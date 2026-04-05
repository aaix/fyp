TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=docker-build.inc.sh
source "${REPO_ROOT}/docker-build.inc.sh"
python "${REPO_ROOT}/dataservices/model_generator.py"
if [ "${GITHUB_ACTIONS:-}" != "true" ]; then
  release=""
  mode="debug"
  backtrace="full"
else
  release="--release"
  mode="release"
  backtrace="0"
fi
docker_build_ci_aware dataservices -t "az-dataservices:${TAG}" --build-context "shared=${REPO_ROOT}/shared/" --build-context "root=${REPO_ROOT}" --build-arg backtrace="${backtrace}" --build-arg mode="${mode}" --build-arg release="${release}" "${REPO_ROOT}/dataservices"