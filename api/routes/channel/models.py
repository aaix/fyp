from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, Field

from api.utils import unwrap
from shared.py.constraints import CHANNEL_MAX_NUM_MEMBERS
from shared.py.grpc.channel import ChannelType
from shared.py.grpc.id import puuid_uuid
from shared.py.grpc.message import MessageType
from shared.py.grpcgen import channel_pb2, message_pb2
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
    "NewMessageResponse",
    "MessagesResponse",
    "EditMessageBody",
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
    channel_icon: UUID | None
    channel_members: list[UUID]
    channel_type: int

    @classmethod
    def from_rpc(cls, rpc: channel_pb2.ChannelObjectResponse) -> Self:
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            channel_name=rpc.opt_channel_name,
            channel_icon=puuid_uuid(rpc.opt_channel_icon_asset_id),
            channel_members=list(puuid_uuid(m) or unwrap() for m in rpc.channel_members),
            channel_type=rpc.channel_type
        )

class UserChannelEntry(BaseModel):
    channel_id: UUID

    encrypted_channel_key: Base64Output
    last_accessed: int

    channel_name: ChannelNameOut
    channel_icon: UUID | None

    @classmethod
    def from_rpc(cls, rpc: channel_pb2.ChannelMemberObject) -> Self:
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            encrypted_channel_key=rpc.encrypted_channel_key,
            last_accessed=rpc.last_accessed,
            channel_name=rpc.opt_channel_name,
            channel_icon=puuid_uuid(rpc.opt_channel_icon_asset_id),
        )


class ChannelsResponse(BaseModel):
    channels: list[UserChannelEntry]


class NewMessageBody(BaseModel):
    message_type: MessageType
    # we deliberately dont check this in case the message has been DELETED
    # at the same time as the message being sent
    in_reply_to: UUID | None
    content: Annotated[Base64Input, Field(min_length=1)]

class NewMessageResponse(BaseModel):

    @classmethod
    def from_rpc(cls, rpc: message_pb2.MessageObject) -> Self:
        return cls(
            channel_id=puuid_uuid(rpc.channel_id) or unwrap(),
            bucket=rpc.bucket,
            message_id=puuid_uuid(rpc.message_id) or unwrap(),
            message_type=rpc.message_type,
            last_edited=rpc.opt_last_edited,
            content=rpc.opt_content,
            attachment_asset_id=puuid_uuid(rpc.opt_attachment_asset_id),
            author_id=puuid_uuid(rpc.author_id) or unwrap(),
            in_reply_to=puuid_uuid(rpc.opt_in_reply_to)
        )


    channel_id: UUID
    bucket: int
    message_id: UUID
    message_type: int
    last_edited: int | None
    content: Base64Output | None
    attachment_asset_id: UUID | None
    author_id: UUID
    in_reply_to: UUID | None

class MessagesResponse(BaseModel):
    messages: list[NewMessageResponse]

class EditMessageBody(BaseModel):
    content: Base64Input