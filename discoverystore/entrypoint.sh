#!/bin/sh

valkey-server /usr/local/etc/valkey/valkey.conf &
valkey-cli cluster addslots $(seq 0 16383)
wait