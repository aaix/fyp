#!/bin/bash

docker build ./database -t az-scylla:latest
. ./api/dockerbuild.sh
. ./gateway/dockerbuild.sh
. ./dataservices/dockerbuild.sh