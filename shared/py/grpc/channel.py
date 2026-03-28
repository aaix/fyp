import asyncio
from enum import IntEnum
from typing import Literal, cast
from collections.abc import Iterable, Iterator

from google.protobuf.field_mask_pb2 import FieldMask
from google.protobuf.wrappers_pb2 import BoolValue

from shared.py.grpc import instrument_call
from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.misc import bucketby
from shared.py.tracing import tracer
from shared.py.types import UNSET, MaybeUnset

class ChannelType(IntEnum):
    REGULAR = 0
    RESTRICTED_EXPANSION = 1

    @property
    def supports_editing(self):
        return self.value in (0,)



async def get_channel(lazy: DataservicesLazyGRPC[ChannelServiceStub], channel_id: id_t) -> channel_pb2.ChannelObjectResponse:
    stub = await lazy(channel_id)
    return cast(channel_pb2.ChannelObjectResponse, await stub.ReadChannel(channel_pb2.ReadChannelRequest(
        channel_id=id_puuid(channel_id)
    )))

async def edit_channel(
    lazy: DataservicesLazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    *,
    channel_name: MaybeUnset[bytes | None] = UNSET,
    request_icon: MaybeUnset[Literal[True]] = UNSET,
    latest_bucket: MaybeUnset[int] = UNSET,
    members: Iterable[pUUID] = (),
) -> channel_pb2.ChannelObjectResponse:
    
    update_mask = []
    if channel_name is not UNSET:
        update_mask.append("opt_channel_name")
    
    if latest_bucket is not UNSET:
        latest_bucket_v = latest_bucket
    else:
        latest_bucket_v = None

    msg = channel_pb2.UpdateChannelRequest(
        channel_id=id_puuid(channel_id),
        request_icon=BoolValue(value=request_icon) if request_icon else None,
        opt_channel_name=channel_name if channel_name else None,
        update_mask=FieldMask(paths=update_mask),
        members_to_update=members,
        last_bucket=latest_bucket_v
    )

    stub = await lazy(channel_id)
    return cast(channel_pb2.ChannelObjectResponse, await stub.UpdateChannel(msg))


@instrument_call
async def add_channel_members(
    lazy: DataservicesLazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    channel_request: channel_pb2.CreateChannelRequest,
    requests: Iterable[channel_pb2.AddChannelMemberRequest]
):
    pchannel_id = id_puuid(channel_id)
    assert channel_id
    stub = await lazy(channel_id)
    return cast(channel_pb2.AddChannelMembersResponse, await stub.AddChannelMembers(channel_pb2.AddChannelMembersRequest(
        channel_id=pchannel_id,
        channel=channel_request,
        requests=requests
    )))

async def remove_channel_members(
    lazy: DataservicesLazyGRPC[ChannelServiceStub],
    channel_id: id_t,
    user_ids: Iterable[id_t]
):
    pchannel_id = id_puuid(channel_id)
    stub = await lazy(pchannel_id)
    return cast(channel_pb2.RemoveChannelMembersResponse, await stub.RemoveChannelMembers(channel_pb2.RemoveChannelMembersRequest(
        channel_id=pchannel_id,
        members=filter(None, map(id_puuid, user_ids))
    )))


async def edit_channel_member(
    lazy: DataservicesLazyGRPC[ChannelServiceStub],
    user_id: id_t,
    channel_id: id_t,
    *,
    last_message_acked_id: MaybeUnset[id_t] = UNSET,
    counter: MaybeUnset[int] = UNSET,
) -> channel_pb2.UpdateChannelMemberResponse:

    stub = await lazy(channel_id)
    return  cast(channel_pb2.UpdateChannelMemberResponse, await stub.UpdateChannelMember(channel_pb2.UpdateChannelMemberRequest(
        user_id=id_puuid(user_id),
        channel_id=id_puuid(channel_id),
        last_acked_message_id=id_puuid(last_message_acked_id) if last_message_acked_id else None,
        counter=counter if counter is not UNSET else None,
    )))

async def set_last_acked_message_id(
    lazy: DataservicesLazyGRPC[ChannelServiceStub],
    user_id: id_t,
    channel_id: id_t,
    message_id: id_t,
    counter: int,
):
    await edit_channel_member(
        lazy,
        user_id,
        channel_id,
        last_message_acked_id=message_id,
        counter=counter,
    )

@tracer.start_as_current_span("channel_counters.scatter_gather")
async def scatter_gather_channel_counters(lazy: DataservicesLazyGRPC[ChannelServiceStub], user_channels: Iterable[pUUID]):
    """Scatter gather out channel counter reads bucketed by their corresponding dataservices service"""
    buckets = await bucketby(user_channels, lazy)
    res = await asyncio.gather(*(
        grpc.GetChannelsCounter(channel_pb2.GetChannelsCounterRequest(channel_ids=channels)) for grpc, channels in buckets.items()
    ))

    return cast(Iterable[channel_pb2.GetChannelsCounterResponse], res)

async def increment_channel_counter(lazy: DataservicesLazyGRPC[ChannelServiceStub], channel_id: id_t):
    stub = await lazy(channel_id)
    await stub.IncrementChannelCounter(channel_pb2.IncrementChannelCounterRequest(
        channel_id=id_puuid(channel_id)
    ))
