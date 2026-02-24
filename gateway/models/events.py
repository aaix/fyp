from typing import Any, Literal

from uuid import UUID
from enum import Enum

from pydantic import BaseModel

from shared.py.pydantic.base64 import Base64Output

type Event_t = MessageEvent | ChannelUpdateEvent

class Event(BaseModel):
    """Base class for business logic events sent from the gateway"""
    intent: Any
    


class MessageEvent(Event):
    intent: Literal["message"] = "message"
    channel_id: UUID
    author_id: UUID
    payload: Base64Output



class ChannelUpdateEvent(Event):
    intent: Literal["channel_update"] = "channel_update"
    channel_id: UUID
    update_type: Type

    class Type(Enum):
        CHANNEL_CREATE = "create"
        CHANNEL_REMOVE = "remove"
        CHANNEL_MEMBER = "member"
