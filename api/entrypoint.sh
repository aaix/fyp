#!/bin/sh


MODE=${DEPLOYMENT_MODE:-dev}

if [ "$MODE" = "prod" ]; then
    exec python3 -m fastapi run /az7/api/main.py \
        --port 443
else
    exec python3 -m fastapi dev /az7/api/main.py
fi