from typing import Annotated, Self
from uuid import UUID

from fastapi import Query
from pydantic import BaseModel

from api.utils import unwrap
from shared.py.constraints import USERNAME_MAX_LENGTH
from shared.py.grpc.id import puuid_uuid
from shared.py.grpc.relationship import RelationshipType
from shared.py.grpcgen import user_pb2
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.pydantic.user import UserSearchResponse


__all__ = (
    "UserSearchResponse",
    "UsernameSearchQuery",
    "UserProfileResponse",
    "RelationshipsResponse",
    "UserRelationshipResponse",
    "RelationshipsCountResponse",
)



type UsernameSearchQuery = Annotated[str, Query(max_length=USERNAME_MAX_LENGTH, min_length=2)]


class UserProfileResponse(BaseModel):
    user: UserSearchResponse
    relationships: RelationshipsCountResponse
    public: bool
    can_i_view: bool

class UserRelationshipResponse(BaseModel):
    peer_id: UUID
    relationship: RelationshipType
    created_at: int

    @classmethod
    def from_rpc(cls, t: RelationshipType, rpc: user_pb2.HalfRelationship) -> Self:
        return cls(
            peer_id=puuid_uuid(rpc.user_id_b) or unwrap(),
            relationship=t,
            created_at=rpc.created_at
        )

class RelationshipsResponse(BaseModel):
    relationships: list[UserRelationshipResponse]

class RelationshipsCountResponse(BaseModel):
    following: int | None
    followers: int | None
    friends: int | None

    @classmethod
    def from_rpc(cls, rpc: user_pb2.GetUserRelationshipCountsResponse) -> Self:
        return cls(
            following=rpc.num_following,
            followers=rpc.num_followers,
            friends=rpc.num_friends,
        )