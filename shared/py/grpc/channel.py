from typing import cast

from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub


async def get_channel(lazy: LazyGRPC[ChannelServiceStub], channel_id: id_t) -> channel_pb2.ChannelObjectResponse:
    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.ReadChannel(channel_pb2.ReadChannelRequest(
        channel_id=id_puuid(channel_id)
    )))