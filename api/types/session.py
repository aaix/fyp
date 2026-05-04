from typing import Self, cast

from dataclasses import dataclass
from uuid import UUID

import msgpack

from api.responses import ApiErrExc, ErrorResponse
from api.responses import errors
from api.responses.status_codes import ERROR_SESSION_EXPIRED
from api.utils import now

from shared.py.discovery import DiscoveryManager
from shared.py.grpc.id import id_compare
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.user import get_user
from shared.py.grpcgen import user_pb2, user_pb2_grpc

CONF_SESSION_DURATION = 4 * 60 * 60 # 4 hours


discovery = DiscoveryManager()
grpcuser = DataservicesLazyGRPC(user_pb2_grpc.UserServiceStub)


@dataclass
class Session:
    issued: float
    version: int
    user_id: UUID

    async def full_user(self) -> user_pb2.ReadUserResponse:
        return await get_user(grpcuser, self.user_id)


    def to_encode(self) -> bytes:
        return cast(bytes, msgpack.packb({
            "i": self.issued,
            "u": self.user_id.bytes,
            "v": self.version
        }))
    
    @classmethod
    def from_encode(cls, b: bytes) -> Self:
        data = msgpack.unpackb(b) # msgpack is more performant and smaller than json
        return cls(
            user_id=UUID(bytes=data["u"]),
            issued=data["i"],
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


