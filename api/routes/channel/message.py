from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Query

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from api.types.params import ChannelAsMemberParam, MessageParam
from api.utils import ResourceNotFoundRpcHandler
from shared.py.grpc.channel import edit_channel
from shared.py.grpc.id import id_compare, uuid_puuid, id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.message import edit_message
from shared.py.grpcgen import channel_pb2_grpc, internalmessage_pb2, message_pb2, message_pb2_grpc
from shared.py.constraints import MAX_MESSAGES_QUERYABLE
from shared.py.intraservice import client as intraclient



discovery = DiscoveryManager()
grpcmessage = LazyGRPC(discovery.discover_dataservices(), message_pb2_grpc.MessageServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), channel_pb2_grpc.ChannelServiceStub)

MessageRouter = APIRouter()


@MessageRouter.post("/channel/{channel_id}/message")
async def create_message(s: SessionParam, channel: ChannelAsMemberParam, body: NewMessageBody) -> NewMessageResponse:
    
    author_id = uuid_puuid(s.user_id)

    in_reply_to = uuid_puuid(body.in_reply_to) if body.in_reply_to else None

    message = cast(message_pb2.MessageObject, await grpcmessage.stub.CreateMessage(message_pb2.CreateMessageRequest(
        channel_id=channel.channel_id,
        message_type=body.message_type,
        opt_last_edited=None,
        opt_content=body.content,
        opt_attachment_asset_id=None,
        author_id=author_id,
        opt_in_reply_to=in_reply_to
    )))

    await intraclient.fan_out(channel.channel_id, channel.channel_members, "message_create", lambda m_id: internalmessage_pb2.EventMessageCreate(
        author_id=author_id,
        content=body.content,
        message_type=body.message_type,
        channel_id=channel.channel_id,
        message_id=message.message_id,
        attachment_id=None,
        in_reply_to=in_reply_to,
    ))

    if message.bucket != channel.latest_bucket:
        # update channel bucket
        await edit_channel(grpcchannel, channel.channel_id, latest_bucket=message.bucket)

    return NewMessageResponse.from_rpc(message)


def assert_user_is_author(current_user_id: id_t, message: MessageParam):
    if not id_compare(message.author_id, current_user_id):
        raise ApiErrExc(errors.Forbidden("Cannot delete a message you are not the author of"))
        

@MessageRouter.patch("/channel/{channel_id}/message/{message_id}")
async def r_edit_message(s: SessionParam, channel: ChannelAsMemberParam, message: MessageParam, body: EditMessageBody) -> NewMessageResponse:
    assert_user_is_author(s.user_id, message)

    rpc = await edit_message(grpcmessage, channel.channel_id, message.message_id, content=body.content)
    return NewMessageResponse.from_rpc(rpc)

@MessageRouter.delete("/channel/{channel_id}/message/{message_id}")
async def delete_message(s: SessionParam, channel: ChannelAsMemberParam, message: MessageParam) -> None:
    assert_user_is_author(s.user_id, message)
    
    cast(message_pb2.DeleteMessageResponse, await grpcmessage.stub.DeleteMessage(message_pb2.DeleteMessageRequest(
        channel_id=channel.channel_id,
        message_id=message.message_id,
    )))
    
    


@MessageRouter.get("/channel/{channel_id}/messages")
async def get_messages(
    s: SessionParam,
    channel: ChannelAsMemberParam,
    before: Annotated[UUID | None, Query()] = None,
    count: Annotated[int, Query(le=MAX_MESSAGES_QUERYABLE)] = MAX_MESSAGES_QUERYABLE
) -> MessagesResponse:

    messages = cast(message_pb2.ReadMessagesResponse, await grpcmessage.stub.ReadMessages(message_pb2.ReadMessagesRequest(
        channel_id=channel.channel_id,
        before=uuid_puuid(before) if before else None,
        count=count,
        latest_bucket=channel.latest_bucket,
    )))


    return MessagesResponse(
        messages=list(map(NewMessageResponse.from_rpc, messages.messages))
    )
