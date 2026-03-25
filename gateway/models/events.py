from typing import Any, Literal

from uuid import UUID
from enum import Enum

from pydantic import BaseModel

from shared.py.grpc.relationship import RelationshipType
from shared.py.pydantic.base64 import Base64Output
from shared.py.pydantic.common import ChannelNameOut
from shared.py.pydantic.user import UserSearchResponse

type Event_t = MessageEvent | ChannelCreateEvent | HintEvent | UsersEvent | SessionCreateEvent | FriendEvent | MessageCreateEvent | MessageDeleteEvent | MessageUpdateEvent| UserTypingEvent

class BaseEvent(BaseModel):
    """Base class for business logic events sent from the gateway"""
    intent: Any
    

class HintEvent(BaseEvent):
    intent: Literal["hint"] = "hint"
    message: Any


class MessageEvent(BaseEvent):
    intent: Literal["message"] = "message"
    channel_id: UUID
    author_id: UUID
    payload: Base64Output


class SessionCreateEvent(BaseEvent):
    intent: Literal["session_create"] = "session_create"
    ip_address: str

class ChannelCreateEvent(BaseEvent):
    intent: Literal["channel_update"] = "channel_update"
    channel_id: UUID
    channel_name: ChannelNameOut | None
    encrypted_channel_key: Base64Output | None


class UsersEvent(BaseEvent):
    intent: Literal["user_event"] = "user_event"
    users: list[UserSearchResponse]
    errors: list[tuple[UUID, str]]

class FriendEvent(BaseEvent):
    intent: Literal["friendship_update"] = "friendship_update"
    peer_user_id: UUID
    relationship_type: RelationshipType | None

class MessageCreateEvent(BaseEvent):
    intent: Literal["message_create"] = "message_create"
    channel_id: UUID
    message_id: UUID
    content: Base64Output | None
    message_type: int
    attachment_id: UUID | None
    author_id: UUID
    in_reply_to: UUID | None

class MessageUpdateEvent(BaseEvent):
    intent: Literal["message_update"] = "message_update"
    channel_id: UUID
    message_id: UUID
    new_content: Base64Output | None
    new_message_type: int | None

class MessageDeleteEvent(BaseEvent):
    intent: Literal["message_delete"] = "message_delete"
    channel_id: UUID
    message_id: UUID

class UserTypingEvent(BaseEvent):
    intent: Literal["user_typing"] = "user_typing"
    channel_id: UUID
    author_id: UUID
