from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, Field

from api.utils import unwrap
from shared.py.asset import generate_signed_get
from shared.py.constraints import CHANNEL_MAX_NUM_MEMBERS, CHAT_ATTACHMENT_MAX_SIZE, MESSAGE_CONTENT_MAX_LENGTH
from shared.py.grpc.channel import ChannelType
from shared.py.grpc.id import id_puuid, id_t, puuid_opt, puuid_uuid
from shared.py.grpc.message import MessageType
from shared.py.grpcgen import channel_pb2, message_pb2
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.pydantic.common import ChannelNameIn, ChannelNameOut, RSA4096CiphertextIn, RSA4096CiphertextOut


__all__ = (
    "NewChannelBody",
    "ChannelResponse",
    "ChannelMemberParamIn",
    "ChannelMemberParamOut",
    "ChannelsResponse",
    "UserChannelEntry",
    "AddChannelMembersRequest",
    "EditChannelBody",

    "NewMessageBody",
    "MessageResponse",
    "MessagesResponse",
    "EditMessageBody",
    "create_channel_presigned",
)

async def create_channel_presigned(channel_id: pUUID, asset_id: pUUID) -> str | None:
    
    if puuid_opt(asset_id) is None:
        return None
    return await generate_signed_get(
        public=False,
        bucket_id=channel_id,
        asset_id=asset_id
    )

type ChannelMembers = Annotated[list[ChannelMemberParamIn], Field(max_length=CHANNEL_MAX_NUM_MEMBERS-1)]

class ChannelMemberParamIn(BaseModel):
    user_id: UUID
    encrypted_shared_key: RSA4096CiphertextIn

class ChannelMemberParamOut(BaseModel):
    user_id: UUID
    encrypted_shared_key: RSA4096CiphertextOut


class NewChannelBody(BaseModel):
    channel_type: ChannelType
    channel_name: ChannelNameIn
    encrypted_shared_key: RSA4096CiphertextIn
    # remove 1 from the max length as current user is an implicit member
    channel_members: ChannelMembers

class EditChannelBody(BaseModel):
    channel_name: ChannelNameIn

class AddChannelMembersRequest(BaseModel):
    members_to_add: ChannelMembers


class ChannelResponse(BaseModel):
    channel_id: UUID
    channel_name: ChannelNameOut
    channel_icon: str | None
    channel_members: list[UUID]
    channel_type: int

    @classmethod
    async def from_rpc(cls, rpc: channel_pb2.ChannelObjectResponse) -> Self:
        channel_icon = await create_channel_presigned(rpc.channel_id, rpc.opt_channel_icon_asset_id)
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            channel_name=rpc.opt_channel_name,
            channel_icon=channel_icon,
            channel_members=list(puuid_uuid(m) or unwrap() for m in rpc.channel_members),
            channel_type=rpc.channel_type
        )

class UserChannelEntry(BaseModel):
    channel_id: UUID

    encrypted_channel_key: Base64Output
    last_accessed: int

    channel_name: ChannelNameOut
    channel_icon: str | None

    @classmethod
    async def from_rpc(cls, rpc: channel_pb2.ChannelMemberObject) -> Self:
        channel_icon = await create_channel_presigned(rpc.channel_id, rpc.opt_channel_icon_asset_id)
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            encrypted_channel_key=rpc.encrypted_channel_key,
            last_accessed=rpc.last_accessed,
            channel_name=rpc.opt_channel_name,
            channel_icon=channel_icon,
        )


class ChannelsResponse(BaseModel):
    channels: list[UserChannelEntry]


class AttachmentRequestBody(BaseModel):
    content_len: Annotated[int, Field(le=CHAT_ATTACHMENT_MAX_SIZE, ge=1)]

class NewMessageBody(BaseModel):
    message_type: MessageType
    # we deliberately dont check this in case the message has been DELETED
    # at the same time as the message being sent
    in_reply_to: UUID | None
    content: Annotated[Base64Input, Field(min_length=1, max_length=MESSAGE_CONTENT_MAX_LENGTH)]

    # special params IF creating an attachment
    attachment_request: AttachmentRequestBody | None

class MessageResponse(BaseModel):

    @classmethod
    async def from_rpc(cls, rpc: message_pb2.MessageObject, asset_upload_url: str | None = None) -> Self:
        attachment_url = await create_channel_presigned(rpc.channel_id, rpc.opt_attachment_asset_id)
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            bucket=rpc.bucket,
            message_id=puuid_uuid(rpc.message_id) or unwrap(),
            message_type=rpc.message_type,
            last_edited=rpc.opt_last_edited,
            content=rpc.opt_content,
            attachment_url=attachment_url,
            author_id=puuid_uuid(rpc.author_id) or unwrap(),
            in_reply_to=puuid_uuid(rpc.opt_in_reply_to),
            asset_upload_url=asset_upload_url
        )


    channel_id: UUID
    bucket: int
    message_id: UUID
    message_type: int
    last_edited: int | None
    content: Base64Output | None
    attachment_url: str | None
    author_id: UUID
    in_reply_to: UUID | None
    asset_upload_url: str | None

class MessagesResponse(BaseModel):
    messages: list[MessageResponse]

class EditMessageBody(BaseModel):
    content: Base64Input | None
    message_type: MessageType | None