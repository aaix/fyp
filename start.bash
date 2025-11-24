docker build ./database -t az-scylla:latest
docker stack deploy -c docker-compose.yml az-fyp