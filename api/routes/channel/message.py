from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Query

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from api.types.params import ChannelParam
from api.utils import ResourceNotFoundRpcHandler
from shared.py.grpc.channel import edit_channel
from shared.py.grpc.id import uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import channel_pb2_grpc, message_pb2, message_pb2_grpc
from shared.py.constraints import MAX_MESSAGES_QUERYABLE
from shared.py.intraservice import client as intraclient



discovery = DiscoveryManager()
grpcmessage = LazyGRPC(discovery.discover_dataservices(), message_pb2_grpc.MessageServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), channel_pb2_grpc.ChannelServiceStub)

MessageRouter = APIRouter()


def channel_membership_check(s: SessionParam, channel: ChannelParam):
    if not uuid_puuid(s.user_id) in channel.channel_members:
        raise ApiErrExc(ResourceNotFoundRpcHandler.make_error(channel.channel_id))



@MessageRouter.post("/channel/{channel_id}/message")
async def create_message(s: SessionParam, channel: ChannelParam, body: NewMessageBody) -> NewMessageResponse:

    channel_membership_check(s, channel)
    
    message = cast(message_pb2.MessageObject, await grpcmessage.stub.CreateMessage(message_pb2.CreateMessageRequest(
        channel_id=channel.channel_id,
        message_type=body.message_type,
        opt_last_edited=None,
        opt_content=body.content,
        opt_attachment_asset_id=None,
        author_id=uuid_puuid(s.user_id),
    )))

    if message.bucket != channel.latest_bucket:
        # update channel bucket
        await edit_channel(grpcchannel, channel.channel_id, latest_bucket=message.bucket)

    return NewMessageResponse.from_rpc(message)


@MessageRouter.get("/channel/{channel_id}/messages")
async def get_messages(
    s: SessionParam,
    channel: ChannelParam,
    before: Annotated[UUID | None, Query()] = None,
    count: Annotated[int, Query(le=MAX_MESSAGES_QUERYABLE)] = MAX_MESSAGES_QUERYABLE
) -> MessagesResponse:

    channel_membership_check(s, channel)

    messages = cast(message_pb2.ReadMessagesResponse, await grpcmessage.stub.ReadMessages(message_pb2.ReadMessagesRequest(
        channel_id=channel.channel_id,
        before=uuid_puuid(before) if before else None,
        count=count,
        latest_bucket=channel.latest_bucket,
    )))


    return MessagesResponse(
        messages=list(map(NewMessageResponse.from_rpc, messages.messages))
    )
