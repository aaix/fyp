from typing import Annotated, cast

import asyncio
from uuid import UUID

from fastapi import APIRouter, Query

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from api.types.params import ChannelAsMemberParam, MessageParam
from shared.py import asset
from shared.py.grpc.channel import edit_channel, edit_channel_member, increment_channel_counter, set_last_acked_message_id
from shared.py.grpc.id import id_compare, puuid_opt, uuid_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.message import MessageType, create_message, edit_message, read_messages
from shared.py.grpcgen import channel_pb2_grpc, internalmessage_pb2, message_pb2, message_pb2_grpc
from shared.py.constraints import CHAT_ATTACHMENT_MAX_SIZE, MAX_MESSAGES_QUERYABLE
from shared.py.intraservice import client as intraclient
from shared.py.types import UNSET



discovery = DiscoveryManager()
grpcmessage = DataservicesLazyGRPC(message_pb2_grpc.MessageServiceStub)
grpcchannel = DataservicesLazyGRPC(channel_pb2_grpc.ChannelServiceStub)

MessageRouter = APIRouter()

def assert_user_is_author(current_user_id: id_t, message: MessageParam):
    if not id_compare(message.author_id, current_user_id):
        raise ApiErrExc(errors.Forbidden("Cannot delete a message you are not the author of"))
        

@MessageRouter.post("/channel/{channel_id}/message")
async def r_create_message(s: SessionParam, channel: ChannelAsMemberParam, body: NewMessageBody) -> MessageResponse:
    
    if not body.message_type.is_user:
        raise ApiErrExc(errors.BadRequest("Unexpected non user message type", api_error_code=errors.ERROR_INVALID_BODY_PARTS))

    author_id = uuid_puuid(s.user_id)

    in_reply_to = uuid_puuid(body.in_reply_to) if body.in_reply_to else None

    request_asset = body.message_type == MessageType.USER_MEDIA_PENDING or None

    if not (body.attachment_request or body.content):
        raise ApiErrExc(errors.BadRequest(
            "a message must have either content or an attachment request",
            api_error_code=errors.ERROR_INVALID_BODY_PARTS
        ))


    if request_asset and body.attachment_request is None:
        raise ApiErrExc(errors.BadRequest(
            "attachment_request is mandatory with USER_MEDIA_PENDING message type",
            api_error_code=errors.ERROR_INVALID_BODY_PARTS
        ))


    message = await create_message(
        grpcmessage,
        channel.channel_id,
        message_type=body.message_type,
        last_edited=None,
        content=body.content,
        request_asset=request_asset,
        author_id=author_id,
        in_reply_to=in_reply_to,
        additional_content=body.additional_content
    )

    # await set_last_acked_message_id(grpcchannel, s.user_id, channel.channel_id, message.message_id)
    await increment_channel_counter(grpcchannel, channel.channel_id)

    await intraclient.fan_out_amplified(channel.channel_id, channel.channel_members, "message_create", internalmessage_pb2.EventMessageCreate(
        author_id=author_id,
        content=body.content,
        message_type=body.message_type,
        channel_id=channel.channel_id,
        message_id=message.message_id,
        in_reply_to=in_reply_to,
        additional_content=body.additional_content,
    ))

    if message.bucket != channel.latest_bucket:
        # update channel bucket
        await edit_channel(grpcchannel, channel.channel_id, latest_bucket=message.bucket)

    signed_url = None
    if request_asset:
        assert body.attachment_request
        signed_url = await asset.generate_signed_put(
            public=False,
            bucket_id=channel.channel_id,
            asset_id=message.opt_attachment_asset_id,
            mime_type='application/octet-stream',
            size=body.attachment_request.content_len,

        )


    return await MessageResponse.from_rpc(message, signed_url)




@MessageRouter.get("/channel/{channel_id}/message/{message_id}")
async def r_get_message(s: SessionParam, channel: ChannelAsMemberParam, message: MessageParam) -> MessageResponse:
    return await MessageResponse.from_rpc(message)

@MessageRouter.put("/channel/{channel_id}/message/{message_id}/ack")
async def ack_message(s: SessionParam, channel: ChannelAsMemberParam, message_id: UUID, counter: Annotated[int, Query()]) -> None:
    """Ack a message as read"""
    if not message_id.version == 1:
        raise ApiErrExc(errors.BadRequest(f"Invalid message id {message_id} to ack"))

    await set_last_acked_message_id(grpcchannel, s.user_id, channel.channel_id, message_id, counter)
    

@MessageRouter.patch("/channel/{channel_id}/message/{message_id}")
async def r_edit_message(s: SessionParam, channel: ChannelAsMemberParam, message: MessageParam, body: EditMessageBody) -> MessageResponse:
    assert_user_is_author(s.user_id, message)

    if body.message_type is not None and not MessageType(message.message_type).can_transition_to(body.message_type):
            raise ApiErrExc(errors.BadRequest("Illegal message type state transition"))
    
    if not MessageType(message.message_type).supports_content_editing and body.content:
        raise ApiErrExc(errors.BadRequest("Message type does not support content editing"))

    rpc = await edit_message(
        grpcmessage,
        channel.channel_id,
        message.message_id,
        content=body.content if body.content else UNSET,
        message_type=body.message_type if body.message_type is not None else UNSET
    )


    attachment_url = await create_channel_presigned(channel.channel_id, rpc.opt_attachment_asset_id)
    await intraclient.fan_out_amplified(channel.channel_id, channel.channel_members, "message_update", internalmessage_pb2.EventMessageUpdate(
        channel_id=channel.channel_id,
        message_id=message.message_id,
        new_content=body.content,
        new_message_type=body.message_type,
        attachment_url=attachment_url,
    ))

    return await MessageResponse.from_rpc(rpc)


@MessageRouter.delete("/channel/{channel_id}/message/{message_id}")
async def delete_message(s: SessionParam, channel: ChannelAsMemberParam, message: MessageParam) -> None:
    assert_user_is_author(s.user_id, message)
    
    if puuid_opt(message.opt_attachment_asset_id):
        await asset.delete_asset(
            public=False,
            bucket_id=channel.channel_id,
            asset_id=message.opt_attachment_asset_id,
        )

    stub = grpcmessage(channel.channel_id)
    cast(message_pb2.DeleteMessageResponse, await stub.DeleteMessage(message_pb2.DeleteMessageRequest(
        channel_id=channel.channel_id,
        message_id=message.message_id,
    )))

    await intraclient.fan_out_amplified(channel.channel_id, channel.channel_members, "message_delete", internalmessage_pb2.EventMessageDelete(
        channel_id=channel.channel_id,
        message_id=message.message_id,
    ))


@MessageRouter.get("/channel/{channel_id}/messages")
async def get_messages(
    s: SessionParam,
    channel: ChannelAsMemberParam,
    before: Annotated[UUID | None, Query()] = None,
    count: Annotated[int, Query(le=MAX_MESSAGES_QUERYABLE)] = MAX_MESSAGES_QUERYABLE
) -> MessagesResponse:

    messages = await read_messages(grpcmessage, channel.channel_id, before, count, channel.latest_bucket)


    return MessagesResponse(
        messages=await asyncio.gather(*map(MessageResponse.from_rpc, messages.messages))
    )
