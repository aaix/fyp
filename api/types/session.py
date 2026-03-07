from typing import Self, cast

from dataclasses import dataclass
from uuid import UUID

import msgpack

from api.responses import ErrorResponse
from api.responses.errors import Unauthorized
from api.responses.status_codes import ERROR_SESSION_EXPIRED
from api.utils import now

CONF_SESSION_DURATION = 4 * 60 * 60 # 4 hours



@dataclass
class Session:
    issued: float
    version: int
    user_id: UUID

    def to_encode(self) -> bytes:
        return cast(bytes, msgpack.packb({
            "i": self.issued,
            "u": self.user_id.bytes,
            "v": self.version
        }))
    
    @classmethod
    def from_encode(cls, b: bytes) -> Self:
        data = msgpack.unpackb(b)
        return cls(
            user_id=UUID(bytes=data["u"]),            issued=data["i"],
            version=data["v"]
        )

    
    @classmethod
    def new(cls, user_id: UUID) -> Self:
        return cls(
            issued=now(),
            version=0,
            user_id=user_id,
        )

    def validate(self) -> None | ErrorResponse:
        if self.issued + CONF_SESSION_DURATION < now():
            return Unauthorized("Session expired", api_error_code=ERROR_SESSION_EXPIRED)

