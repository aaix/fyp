

python -m grpc_tools.protoc \
  -I../dataservices/proto \
  --python_out=./py/grpcgen \
  --grpc_python_out=./py/grpcgen \
  --pyi_out=./py/grpcgen \
  ../dataservices/proto/*.proto
sed -i 's/^import \([^ ]*\)_pb2/from . import \1_pb2/' ./py/grpcgen/*_pb2*.py