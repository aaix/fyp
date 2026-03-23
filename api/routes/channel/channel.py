from typing import cast

from fastapi import APIRouter

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from api.types.params import ChannelAsMemberParam, UserParam
from api.utils import ResourceNotFoundRpcHandler, unwrap

from shared.py.intraservice import client as intraclient
from shared.py.grpc.channel import ChannelType, add_channel_members, edit_channel, remove_channel_members
from shared.py.grpc.id import id_compare, puuid_opt, puuid_uuid, uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.relationship import RelationshipType, test_many_relationships, test_relationship
from shared.py.grpcgen import channel_pb2, internalmessage_pb2
from shared.py.grpcgen.channel_pb2_grpc import ChannelServiceStub
from shared.py.grpcgen.user_pb2 import TestManyRelationshipEntry
from shared.py.grpcgen.user_pb2_grpc import UserRelationshipServiceStub
from shared.py.types import UNSET



discovery = DiscoveryManager()

ChannelRouter = APIRouter()

grpcrelationship = LazyGRPC(discovery.discover_dataservices(), UserRelationshipServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), ChannelServiceStub)


@ChannelRouter.post("/channel")
async def new_channel(s: SessionParam, body: NewChannelBody) -> ChannelResponse:
    member_ids = set(cm.user_id for cm in body.channel_members)

    # create a copy so we can add ourself as an out param so we dont b64 convert
    member_objects: list[ChannelMemberParamIn | ChannelMemberParamOut] = []
    member_objects.extend(body.channel_members)

    if not len(member_ids) == len(member_objects):
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
    member_objects.append(
        ChannelMemberParamOut(
            user_id=s.user_id,
            encrypted_shared_key=body.encrypted_shared_key,
        )
    )

    # create the channel
    channel_request = channel_pb2.CreateChannelRequest(
        channel_type=body.channel_type.value,
        opt_channel_name=body.channel_name,
        opt_channel_icon_asset_id=None
    )

    channel = cast(channel_pb2.ChannelObjectResponse, await grpcchannel.stub.CreateChannel(channel_request))

    # add the channel members
    members = await add_channel_members(
        grpcchannel,
        channel.channel_id,
        channel_request,
        (
            channel_pb2.AddChannelMemberRequest(
                user_id=uuid_puuid(m.user_id),
                encrypted_channel_key=m.encrypted_shared_key,
            ) for m in member_objects
        )
    )

    member_ids.add(s.user_id)

    encrypted_map = {m.user_id : m.encrypted_shared_key for m in member_objects}

    await intraclient.fan_out(channel.channel_id, member_ids, "channel_create", lambda user_id: internalmessage_pb2.EventChannelCreate(
        channel_id=channel.channel_id,
        encrypted_channel_name=channel.opt_channel_name,
        encrypted_channel_key=encrypted_map.get(user_id)
    ))

    return ChannelResponse(
        channel_id=puuid_uuid(channel.channel_id) or unwrap(),
        channel_name=channel.opt_channel_name,
        channel_icon=None,
        channel_members=list(member_ids),
        channel_type=body.channel_type
    )

@ChannelRouter.get("/channels")
async def get_my_channels(s: SessionParam) -> ChannelsResponse:
    res = cast(channel_pb2.UserChannelsResponse, await grpcchannel.stub.GetUserChannels(channel_pb2.GetUserChannelsRequest(
        user_id=uuid_puuid(s.user_id) or unwrap()
    )))

    return ChannelsResponse(
        channels=list(map(UserChannelEntry.from_rpc, res.channels))
    )

@ChannelRouter.get("/channel/{channel_id}")
async def get_channel(s: SessionParam, channel: ChannelAsMemberParam) -> ChannelResponse:
    return ChannelResponse.from_rpc(channel)

@ChannelRouter.put("/channel/{channel_id}/typing")
async def user_channel_typing(s: SessionParam, channel: ChannelAsMemberParam) -> None:
    await intraclient.fan_out(
        channel.channel_id, channel.channel_members, "user_typing",
        lambda _: internalmessage_pb2.EventUserTyping(
            author_id=uuid_puuid(s.user_id),
            channel_id=channel.channel_id,
        )
    )

@ChannelRouter.patch("/channel/{channel_id}")
async def patch_channel(s: SessionParam, channel: ChannelAsMemberParam, body: EditChannelBody) -> ChannelResponse:
    channel_id = channel.channel_id

    channel_name = body.channel_name if "channel_name" in body.model_fields_set else UNSET
    channel_icon = UNSET

    rpc = await edit_channel(
        grpcchannel,
        channel_id,
        channel_name=channel_name,
        icon_id=channel_icon,
        members=channel.channel_members
    )

    await intraclient.fan_out(channel.channel_id, channel.channel_members, "channel_create", lambda _user_id: internalmessage_pb2.EventChannelCreate(
        channel_id=channel_id,
        encrypted_channel_name=rpc.opt_channel_name,
    ))

    return ChannelResponse.from_rpc(rpc)

@ChannelRouter.post("/channel/{channel_id}/members")
async def r_add_channel_members(s: SessionParam, channel: ChannelAsMemberParam, body: AddChannelMembersRequest) -> None:
    member_ids = set(cm.user_id for cm in body.members_to_add)


    if not ChannelType(channel.channel_type).supports_editing:
        raise ApiErrExc(errors.BadRequest("Channel type does not support editing members"))


    if not len(member_ids) == len(body.members_to_add):
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


    # we only need the parts that are in the user_channel table
    channel_request = channel_pb2.CreateChannelRequest(
        opt_channel_name=channel.opt_channel_name,
        opt_channel_icon_asset_id=puuid_opt(channel.opt_channel_icon_asset_id)
    )


    members = await add_channel_members(
        grpcchannel,
        channel.channel_id,
        channel_request,
        (
            channel_pb2.AddChannelMemberRequest(
                user_id=uuid_puuid(m.user_id),
                encrypted_channel_key=m.encrypted_shared_key,
            ) for m in body.members_to_add
        )
    )

    encrypted_map = {m.user_id : m.encrypted_shared_key for m in body.members_to_add}

    await intraclient.fan_out(channel.channel_id, member_ids, "channel_create", lambda user_id: internalmessage_pb2.EventChannelCreate(
        channel_id=channel.channel_id,
        encrypted_channel_name=channel.opt_channel_name,
        encrypted_channel_key=encrypted_map.get(user_id)
    ))



@ChannelRouter.delete("/channel/{channel_id}/members/{user_id}")
async def remove_channel_member(s: SessionParam, channel: ChannelAsMemberParam, user: UserParam) -> None:

    removing_self = id_compare(user.user_id, s.user_id)

    # protected channels only self can be removed
    if not removing_self and not channel.channel_type == ChannelType.REGULAR:
        raise ApiErrExc(errors.BadRequest("Channel type does not support removing members", api_error_code=errors.ERROR_BAD_REQUEST))
    
    if not ChannelType(channel.channel_type).supports_editing:
        raise ApiErrExc(errors.BadRequest("Channel type does not support editing members"))


    await remove_channel_members(
        grpcchannel,
        channel.channel_id,
        (user.user_id,)
    )

