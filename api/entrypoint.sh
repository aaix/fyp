#!/bin/sh


MODE=${DEPLOYMENT_MODE:-dev}

if [ "$MODE" = "prod" ]; then
    exec uvicorn api.main:app \
        --host 0.0.0.0 \
        --port 80 \
        --proxy-headers \
        --forwarded-allow-ips='*' \
        --app-dir /az7
else
    exec uvicorn api.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --app-dir /az7
fi