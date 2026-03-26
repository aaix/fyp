FROM valkey/valkey:9-alpine3.23
COPY valkey.conf /usr/local/etc/valkey/valkey.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD valkey-cli cluster info | grep -q "cluster_state:ok" || exit 1

ENTRYPOINT [ "/entrypoint.sh" ]