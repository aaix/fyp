FROM scylladb/scylla:2025.4.5

COPY ./database.cql /schema.cql

ENTRYPOINT ["/bin/bash", "-c"]

CMD /bin/sh -c "exec /docker-entrypoint.py \
    --seeds=${SEEDS:-$SEED} \
    --smp=${SMP:-1} \
    --memory=${MEM:-1G} \
    --broadcast-address=$(hostname -i) \
    --broadcast-rpc-address=$(hostname -i) \
    ${SCYLLA_ARGS}"

HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD cqlsh -e "DESCRIBE KEYSPACES" || exit 1