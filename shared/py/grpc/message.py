
from typing import cast

from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import message_pb2, message_pb2_grpc
from shared.py.types import UNSET, MaybeUnset


async def get_message(lazy: LazyGRPC[message_pb2_grpc.MessageServiceStub], channel_id: id_t, message_id: id_t) -> message_pb2.MessageObject:
    return cast(message_pb2.MessageObject, await lazy.stub.ReadMessage(message_pb2.ReadMessageRequest(
        channel_id=id_puuid(channel_id),
        message_id=id_puuid(message_id),
    )))

async def edit_message(
    lazy: LazyGRPC[message_pb2_grpc.MessageServiceStub],
    channel_id: id_t,
    message_id: id_t,
    *,
    content: MaybeUnset[bytes] = UNSET
) -> message_pb2.MessageObject:
    
    

    return cast(message_pb2.MessageObject, await lazy.stub.UpdateMessage(message_pb2.UpdateMessageRequest(
        channel_id=id_puuid(channel_id),
        message_id=id_puuid(message_id),
        content=content if content else None
    )))