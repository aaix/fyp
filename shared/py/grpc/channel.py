from enum import IntEnum
from typing import cast
from collections.abc import Iterable

from uuid import UUID
from google.protobuf.field_mask_pb2 import FieldMask

from shared.py.grpc.id import id_t, id_puuid, uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.types import UNSET, MaybeUnset

class ChannelType(IntEnum):
    REGULAR = 0
    RESTRICTED_EXPANSION = 1



async def get_channel(lazy: LazyGRPC[ChannelServiceStub], channel_id: id_t) -> channel_pb2.ChannelObjectResponse:
    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.ReadChannel(channel_pb2.ReadChannelRequest(
        channel_id=id_puuid(channel_id)
    )))

async def edit_channel(
    lazy: LazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    channel_name: MaybeUnset[bytes | None] = UNSET,
    icon_id: MaybeUnset[UUID | None] = UNSET,
    latest_bucket: int | None = None,
    members: Iterable[pUUID] = (),
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
        update_mask=FieldMask(paths=update_mask),
        members_to_update=members,
        last_bucket=latest_bucket
    )

    return cast(channel_pb2.ChannelObjectResponse, await lazy.stub.UpdateChannel(msg))


async def add_channel_members(
    lazy: LazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    channel_request: channel_pb2.CreateChannelRequest,
    requests: Iterable[channel_pb2.AddChannelMemberRequest]
):
    pchannel_id = id_puuid(channel_id)
    assert channel_id
    return cast(channel_pb2.AddChannelMembersResponse, await lazy.stub.AddChannelMembers(channel_pb2.AddChannelMembersRequest(
        channel_id=pchannel_id,
        channel=channel_request,
        requests=requests
    )))

async def remove_channel_members(
    lazy: LazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    user_ids: Iterable[id_t]
):
    pchannel_id = id_puuid(channel_id)
    assert channel_id
    return cast(channel_pb2.RemoveChannelMembersResponse, await lazy.stub.RemoveChannelMembers(channel_pb2.RemoveChannelMembersRequest(
        channel_id=pchannel_id,
        members=filter(None, map(id_puuid, user_ids))
    )))