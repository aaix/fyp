from typing import cast

from fastapi import APIRouter

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from api.types.params import ChannelParam, UserParam
from api.utils import unwrap
from shared.py.grpc.id import puuid_uuid, uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.relationship import RelationshipType, test_many_relationships
from shared.py.grpcgen import channel_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.grpcgen.user_pb2 import TestManyRelationshipEntry
from shared.py.grpcgen.user_pb2_grpc import UserRelationshipServiceStub



discovery = DiscoveryManager()

ChatRouter = APIRouter()

grpcrelationship = LazyGRPC(discovery.discover_dataservices(), UserRelationshipServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), ChannelServiceStub)


@ChatRouter.post("/channel")
async def new_channel(s: SessionParam, body: NewChannelBody) -> ChannelResponse:
    member_ids = set(cm.user_id for cm in body.channel_members)

    if not len(member_ids) == len(body.channel_members):
        raise ApiErrExc(errors.BadRequest("Channel members should not contain duplicates", api_error_code=errors.ERROR_INVALID_BODY_PARTS))    

    if s.user_id in member_ids:
        raise ApiErrExc(errors.BadRequest("Channel members should not contain yourself", api_error_code=errors.ERROR_INVALID_BODY_PARTS))

    # test that current user is friends with all users
    test_res = await test_many_relationships(
        grpcrelationship,
        s.user_id,
        (TestManyRelationshipEntry(user_id_b=uuid_puuid(peer_id), relationship_type=RelationshipType.FRIENDS) for peer_id in member_ids)
    )

    if test_res.errors > 0:
        raise ApiErrExc(errors.InternalServerError("Error resolving relationship with members"))

    if test_res.exist != len(member_ids):
        raise ApiErrExc(errors.BadRequest("Only friends can be added to chats", api_error_code=errors.ERROR_USER_NOT_FRIENDS))


    # current user needs to be a member of the channel
    body.channel_members.append(
        ChannelMemberParam(
            user_id=s.user_id,
            encrypted_shared_key=body.encrypted_shared_key,
        )
    )


    # create the channel
    channel_request = channel_pb2.CreateChannelRequest(
        channel_type=body.channel_type,
        opt_channel_name=body.channel_name,
        opt_channel_icon_asset_id=None
    )

    channel = cast(channel_pb2.ChannelObjectResponse, await grpcchannel.stub.CreateChannel(channel_request))

    # add the channel members
    members = cast(channel_pb2.AddChannelMembersResponse, await grpcchannel.stub.AddChannelMembers(channel_pb2.AddChannelMembersRequest(
        channel_id=channel.channel_id,
        channel=channel_request,
        requests=(
            channel_pb2.AddChannelMemberRequest(
                user_id=uuid_puuid(m.user_id),
                encrypted_channel_key=m.encrypted_shared_key,
            ) for m in body.channel_members
        )
    )))

    member_ids.add(s.user_id)

    return ChannelResponse(
        channel_id=puuid_uuid(channel.channel_id) or unwrap(),
        channel_name=channel.opt_channel_name,
        channel_icon=None,
        channel_members=list(member_ids),
    )

@ChatRouter.get("/channels")
async def get_my_channels(s: SessionParam) -> ChannelsResponse:
    res = cast(channel_pb2.UserChannelsResponse, await grpcchannel.stub.GetUserChannels(channel_pb2.GetUserChannelsRequest(
        user_id=uuid_puuid(s.user_id) or unwrap()
    )))

    return ChannelsResponse(
        channels=list(map(UserChannelEntry.from_rpc, res.channels))
    )

@ChatRouter.get("/channel/{channel_id}")
async def get_channel(s: SessionParam, channel: ChannelParam) -> ChannelResponse:
    return ChannelResponse.from_rpc(channel)

@ChatRouter.patch("/channel/{channel_id}")
async def edit_channel(s: SessionParam, channel: ChannelParam, body: EditChannelBody) -> ChannelResponse:
    ...

@ChatRouter.put("/channel/{channel_id}/members/{user_id}")
async def add_channel_member(s: SessionParam, channel: ChannelParam, user: UserParam, body: AddChannelMemberRequest) -> None:
    ...

@ChatRouter.delete("/channel/{channel_id}/members/{user_id}")
async def remove_channel_member(s: SessionParam, channel: ChannelParam, user: UserParam) -> None:
    ...
