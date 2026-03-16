from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, Field

from api.utils import unwrap
from shared.py.constraints import CHANNEL_MAX_NUM_MEMBERS
from shared.py.grpc.channel import ChannelType
from shared.py.grpc.id import puuid_uuid
from shared.py.grpcgen import channel_pb2
from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.pydantic.common import ChannelName


__all__ = (
    "NewChannelBody",
    "ChannelResponse",
    "ChannelMemberParam",
    "ChannelsResponse",
    "UserChannelEntry",
    "AddChannelMemberRequest",
    "EditChannelBody",
)


class ChannelMemberParam(BaseModel):
    user_id: UUID
    encrypted_shared_key: Base64Output


class NewChannelBody(BaseModel):
    channel_type: ChannelType
    channel_name: ChannelName
    encrypted_shared_key: Base64Input
    # remove 1 from the max length as current user is an implicit member
    channel_members: Annotated[list[ChannelMemberParam], Field(max_length=CHANNEL_MAX_NUM_MEMBERS-1)]

class EditChannelBody(BaseModel):
    channel_name: ChannelName | None
    # TODO
    # channel_icon: PrivateImage

class AddChannelMemberRequest(BaseModel):
    encrypted_shared_key: Base64Input


class ChannelResponse(BaseModel):
    channel_id: UUID
    channel_name: bytes | None
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

    channel_name: bytes | None
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
