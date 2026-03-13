TAG=${1:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docker build --build-context shared=./shared/ -t az-shared-base:${TAG} "${SCRIPT_DIR}"
