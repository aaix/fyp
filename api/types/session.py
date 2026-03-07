from typing import Self, cast

from dataclasses import dataclass
from uuid import UUID

import msgpack

from api.responses import ApiErrExc, ErrorResponse
from api.responses import errors
from api.responses.status_codes import ERROR_SESSION_EXPIRED
from api.utils import now

from shared.py.grpc.id import id_compare
from shared.py.grpcgen import user_pb2

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
            return errors.Unauthorized("Session expired", api_error_code=ERROR_SESSION_EXPIRED)
    
    def assert_user_isnt_self(self, peer: user_pb2.ReadUserResponse):
        if id_compare(self.user_id, peer.user_id):
            raise ApiErrExc(errors.BadRequest("A request cannot target the current user", api_error_code=errors.ERROR_BAD_REQUEST))


