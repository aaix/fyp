FROM valkey/valkey:9-alpine3.23
COPY valkey.conf /usr/local/etc/valkey/valkey.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]