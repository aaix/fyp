#!/bin/sh

valkey-server /usr/local/etc/valkey/valkey.conf &
sleep 5 # hack so that valkey is actually up
valkey-cli cluster addslots $(seq 0 16383)
wait