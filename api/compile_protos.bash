python -m grpc_tools.protoc \
  -I../dataservices/proto \
  --python_out=./grpc \
  --grpc_python_out=./grpc \
  --pyi_out=./grpc \
  ../dataservices/proto/*.proto
sed -i 's/import \([^ ]*\)_pb2/from . import \1_pb2/' ./grpc/*_pb2*.py