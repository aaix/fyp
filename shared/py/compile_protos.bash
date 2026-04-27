#!/bin/bash

[[ "$PWD" == */shared ]] || { echo "Error: Must be in a directory ending in /shared"; exit 1; }


python -m grpc_tools.protoc \
  -I../dataservices/proto \
  -I../mediaservices/proto \
  -I../amplifier/proto \
  -I./sharedproto \
  --python_out=./py/grpcgen \
  --grpc_python_out=./py/grpcgen \
  --pyi_out=./py/grpcgen \
  ../dataservices/proto/*.proto ../mediaservices/proto/*.proto ../amplifier/proto/*.proto ./sharedproto/*.proto
sed -i 's/^import \([^ ]*\)_pb2/from . import \1_pb2/' ./py/grpcgen/*_pb2*.py
