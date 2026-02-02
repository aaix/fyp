#!/bin/bash

docker compose down
bash ./build.bash
docker compose up -d