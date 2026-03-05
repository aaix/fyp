TAG=${1:-latest}
docker build --build-context shared=./shared/ ./api -t az-api:$TAG
