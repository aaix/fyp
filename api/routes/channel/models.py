from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

from shared.py.constraints import CHANNEL_MAX_NUM_MEMBERS
from shared.py.pydantic.base64 import Base64Input
from shared.py.pydantic.common import ChannelName


__all__ = (
    "NewChannelBody",
    "NewChannelResponse"
)


class ChannelMemberParam(BaseModel):
    user_id: UUID
    encrypted_shared_key: Base64Input


class NewChannelBody(BaseModel):
    channel_type: int
    channel_name: ChannelName | None
    encrypted_shared_key: Base64Input
    channel_members: Annotated[list[ChannelMemberParam], Field(max_length=CHANNEL_MAX_NUM_MEMBERS)]

class NewChannelResponse(BaseModel): ...