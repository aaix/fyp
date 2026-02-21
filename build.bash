#!/bin/bash

docker build ./database -t az-scylla:latest
. ./api/dockerbuild.sh

docker build ./dataservices -t az-dataservices:latest