TAG=${1:-latest}
docker build --build-context shared=./shared/ ./gateway -t az-gateway:$TAG
