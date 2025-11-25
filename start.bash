#!/bin/bash

docker compose stop
docker build ./database -t az-scylla:latest
docker compose up