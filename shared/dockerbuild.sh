TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" && bash "${SCRIPT_DIR}/py/compile_protos.bash"
docker build -t az-shared-base:${TAG} "${SCRIPT_DIR}"
docker tag az-shared-base:${TAG} az-shared-base:latest # tag so that github actions can build it
