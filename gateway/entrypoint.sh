#!/bin/sh


MODE=${DEPLOYMENT_MODE:-dev}
export PYTHONPATH=/az7/

if [ "$MODE" = "prod" ]; then
    exec python3 /az7/gateway/main.py --port 80 --host 0.0.0.0
else
    exec python3 /az7/gateway/main.py --port 80 --host 0.0.0.0

fi