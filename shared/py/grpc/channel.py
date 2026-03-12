from typing import cast
from collections.abc import Iterable

from uuid import UUID

from shared.py.grpc.id import id_t, id_puuid, uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.types import UNSET, MaybeUnset


async def get_channel(lazy: LazyGRPC[ChannelServiceStub], channel_id: id_t) -> channel_pb2.ChannelObjectResponse:
    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.ReadChannel(channel_pb2.ReadChannelRequest(
        channel_id=id_puuid(channel_id)
    )))

async def edit_channel(
    lazy: LazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    channel_name: MaybeUnset[str | None],
    icon_id: MaybeUnset[UUID | None],
    members: Iterable[pUUID]
) -> channel_pb2.ChannelObjectResponse:
    
    update_mask = []
    if channel_name is not UNSET:
        update_mask.append("opt_channel_name")
    if icon_id is not UNSET:
        update_mask.append("opt_channel_icon_asset_id")


    msg = channel_pb2.UpdateChannelRequest(
        channel_id=id_puuid(channel_id),
        opt_channel_icon_asset_id=uuid_puuid(icon_id) if icon_id else None,
        opt_channel_name=channel_name if channel_name else None,
        update_mask=update_mask,
        members_to_update=members,
    )






    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.UpdateChannel(msg))