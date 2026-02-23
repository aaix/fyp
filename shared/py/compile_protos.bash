python -m grpc_tools.protoc \
  -I../dataservices/proto \
  --python_out=./grpcgen \
  --grpc_python_out=./grpcgen \
  --pyi_out=./grpcgen \
  ../dataservices/proto/*.proto
sed -i 's/import \([^ ]*\)_pb2/from . import \1_pb2/' ./grpcgen/*_pb2*.py