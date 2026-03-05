TAG=${1:-latest}
docker build ./database -t az-scylla:$TAG
