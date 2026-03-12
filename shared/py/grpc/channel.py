from typing import cast
from uuid import UUID

from shared.py.grpc.id import id_t, id_puuid, uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.types import UNSET, MaybeUnset


async def get_channel(lazy: LazyGRPC[ChannelServiceStub], channel_id: id_t) -> channel_pb2.ChannelObjectResponse:
    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.ReadChannel(channel_pb2.ReadChannelRequest(
        channel_id=id_puuid(channel_id)
    )))

async def edit_channel(
    lazy: LazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    channel_name: MaybeUnset[str | None],
    icon_id: MaybeUnset[UUID | None]
) -> channel_pb2.ChannelObjectResponse:
    
    kwargs = {}

    if icon_id is not UNSET:
        kwargs["opt_channel_icon_asset_id"] = uuid_puuid(icon_id) if icon_id else None

    if channel_name is not UNSET:
        kwargs["opt_channel_name"] = channel_name

    msg = channel_pb2.UpdateChannelRequest(
        channel_id=id_puuid(channel_id),
        **kwargs
    )






    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.UpdateChannel(msg))