from typing import Any, Literal

from uuid import UUID
from enum import Enum

from pydantic import BaseModel

from shared.py.pydantic.base64 import Base64Output
from shared.py.pydantic.common import ChannelName
from shared.py.pydantic.user import UserSearchResponse

type Event_t = MessageEvent | ChannelCreateEvent | HintEvent | UsersEvent | SessionCreateEvent

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
    channel_name: ChannelName | None
    encrypted_channel_key: Base64Output


class UsersEvent(BaseEvent):
    intent: Literal["user_event"] = "user_event"
    users: list[UserSearchResponse]
    errors: list[tuple[UUID, str]]
