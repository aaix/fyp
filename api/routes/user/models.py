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
)



type UsernameSearchQuery = Annotated[str, Query(max_length=USERNAME_MAX_LENGTH, min_length=2)]


class UserProfileResponse(BaseModel):
    user: UserSearchResponse
    friends: int | None
    followers: int | None

class UserRelationshipResponse(BaseModel):
    peer_id: UUID
    relationship: RelationshipType
    created_at: UUID

    @classmethod
    def from_rpc(cls, rpc: user_pb2.RelationshipObject) -> Self:
        return cls(
            peer_id=puuid_uuid(rpc.user_id_b) or unwrap(),
            relationship=RelationshipType(rpc.relationship_type),
            created_at=puuid_uuid(rpc.created_at) or unwrap(),
        )

class RelationshipsResponse(BaseModel):
    relationships: list[UserRelationshipResponse]