#!/bin/bash

docker compose down
docker build ./database -t az-scylla:latest
docker compose up -d