#!/bin/sh


MODE=${DEPLOYMENT_MODE:-dev}

if [ "$MODE" = "prod" ]; then
    exec python3 -m fastapi run /az7/api/main.py \
        --ssl-keyfile /az7/api/certs/key.pem \
        --ssl-certfile /az7/api/certs/cert.pem \
        --port 443
else
    exec python3 -m fastapi dev /az7/api/main.py
fi