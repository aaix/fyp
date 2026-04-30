#!/bin/sh
exec /docker-entrypoint.py \
    --seeds=${SEED} \
    --smp=${SMP:-1} \
    --memory=${MEM:-1G} \
    --broadcast-address=$(hostname -i) \
    --broadcast-rpc-address=$(hostname -i) \
    ${SCYLLA_ARGS:-} "$@"