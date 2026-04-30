#!/bin/sh


MODE=${DEPLOYMENT_MODE:-dev}
WORKERS=${NUM_WORKERS:-8}

if [ "$MODE" = "prod" ]; then
    exec python3 -u -m uvicorn api.main:app \
        --host 0.0.0.0 \
        --port 80 \
        --proxy-headers \
        --forwarded-allow-ips='*' \
        --app-dir /az7 \
        --workers $WORKERS \
        --log-level warning
else
    exec python3 -u -m uvicorn api.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --app-dir /az7 \
        --workers $WORKERS \
        --log-level warning
fi