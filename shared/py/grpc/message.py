
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import message_pb2, message_pb2_grpc


async def get_message(lazy: LazyGRPC[message_pb2_grpc.MessageServiceStub], channel_id: id_t, message_id: id_t) -> message_pb2.MessageObject: ...