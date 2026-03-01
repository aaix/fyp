from typing import Annotated
from uuid import UUID

from fastapi import Query
from pydantic import BaseModel

from api.utils import unwrap
from shared.py.constraints import USERNAME_MAX_LENGTH
from shared.py.grpc.id import puuid_uuid
from shared.py.grpcgen import user_pb2
from shared.py.pydantic.pem import PEMPublicKey


__all__ = (
    "UserSearchResponse",
    "UsernameSearchQuery",
    "UserProfileResponse"
)


class UserSearchResponse(BaseModel):
    user_id: UUID
    avatar_asset_id: UUID | None
    public_key: PEMPublicKey
    username: str

    @classmethod
    def from_rpc(cls, res: user_pb2.UserSearchEntry):
        return cls(
            user_id=puuid_uuid(res.user_id) or unwrap(),
            avatar_asset_id=puuid_uuid(res.opt_avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(res.public_key),
            username=res.username
        )

type UsernameSearchQuery = Annotated[str, Query(max_length=USERNAME_MAX_LENGTH, min_length=2)]


class UserProfileResponse(BaseModel):
    user: UserSearchResponse