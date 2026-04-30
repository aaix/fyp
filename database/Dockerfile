FROM scylladb/scylla:2025.4.5

COPY ./database.cql /schema.cql
COPY --chmod=755 ./entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD cqlsh -e "DESCRIBE KEYSPACES" || exit 1