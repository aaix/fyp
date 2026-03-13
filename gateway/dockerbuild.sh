TAG=${1:-latest}
bash "./shared/dockerbuild.sh" "${TAG}"
docker build --build-context shared=./shared/ ./gateway -t az-gateway:$TAG
