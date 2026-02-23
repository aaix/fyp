from abc import ABC
from uuid import UUID

from pydantic import BaseModel

from typing import Any, Literal



class BaseMessage(BaseModel, ABC):
    op: Any
    seq: int


class ClientHello(BaseMessage):
    op: Literal["client_hello"]
    user_id: UUID

