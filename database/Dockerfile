FROM scylladb/scylla:latest

COPY ./database.cql /schema.cql

ENTRYPOINT ["/bin/bash", "-c"]

CMD ["IP_ADDR=$(hostname -i) && exec /docker-entrypoint.py \
    --reactor-backend=epoll \
    --seeds=$SEED \
    --smp=1 \
    --broadcast-address=$IP_ADDR \
    --broadcast-rpc-address=$IP_ADDR"]

HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD cqlsh -e "DESCRIBE KEYSPACES" || exit 1