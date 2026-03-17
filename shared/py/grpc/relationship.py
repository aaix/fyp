from typing import Self, cast

from enum import IntEnum
from collections.abc import Iterable

from uuid import UUID


from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen.user_pb2_grpc import UserRelationshipServiceStub



class RelationshipType(IntEnum):
    CURRENT_REQUESTING_PEER = 1
    PEER_REQUESTING_CURRENT = 2

    FRIENDS = 3

    PEER_BLOCKED_CURRENT = 5
    CURRENT_BLOCKED_PEER = 6

BLOCKED_RELATIONSHIPS = (RelationshipType.CURRENT_BLOCKED_PEER, RelationshipType.PEER_BLOCKED_CURRENT)

async def create_relationship(
    lazy: LazyGRPC[UserRelationshipServiceStub],
    user_id_a: id_t,
    user_id_b: id_t,
    a_to_b_type: RelationshipType,
    b_to_a_type: RelationshipType
) -> user_pb2.RelationshipObject:
    return cast(user_pb2.RelationshipObject, await lazy.stub.CreateRelationship(user_pb2.CreateRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        a_to_b_type=a_to_b_type.value,
        b_to_a_type=b_to_a_type.value,
    )))

async def read_relationship(lazy: LazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, user_id_b: id_t) -> user_pb2.ReadRelationshipResponse:
    return cast(user_pb2.ReadRelationshipResponse, await lazy.stub.ReadRelationship(user_pb2.ReadRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
    )))

async def test_relationship(lazy: LazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, user_id_b: id_t, relationship_type: RelationshipType) -> user_pb2.RelationshipTestResponse:
    return cast(user_pb2.RelationshipTestResponse, await lazy.stub.TestRelationship(user_pb2.RelationshipObject(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        relationship_type=relationship_type.value
    )))

async def test_many_relationships(lazy: LazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, tests: Iterable[user_pb2.TestManyRelationshipEntry]) -> user_pb2.TestManyRelationshipsResponse:
    return cast(user_pb2.TestManyRelationshipsResponse, await lazy.stub.TestManyRelationships(user_pb2.TestManyRelationshipsRequest(
        user_id=id_puuid(user_id_a),
        tests=tests
    )))

async def read_relationships(lazy: LazyGRPC[UserRelationshipServiceStub], user_id: id_t) -> user_pb2.RelationshipsResponse:
    return cast(user_pb2.RelationshipsResponse, await lazy.stub.ReadRelationships(user_pb2.ReadRelationshipsRequest(
        user_id=id_puuid(user_id)
    )))

async def delete_relationship(
    lazy: LazyGRPC[UserRelationshipServiceStub],
    user_id_a: id_t, 
    user_id_b: id_t,
    a_to_b_type: RelationshipType,
    b_to_a_type: RelationshipType,
) -> user_pb2.DeleteRelationshipResponse:
    return cast(user_pb2.DeleteRelationshipResponse, await lazy.stub.DeleteRelationship(user_pb2.CreateRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        a_to_b_type=a_to_b_type.value,
        b_to_a_type=b_to_a_type.value,
    )))


class PeerRelationshipManager:
    """Helper class for simplifying business logic of user relationships"""
    def __init__(self, lazy: LazyGRPC[UserRelationshipServiceStub], current_user_id: id_t, peer_user_id: id_t, fetch_on_enter = True):
        self.lazy: LazyGRPC[UserRelationshipServiceStub] = lazy
        self.current_id: id_t = current_user_id
        self.peer_id: id_t = peer_user_id
        self.relationships: None | Iterable[user_pb2.RelationshipObject] = None
        self.fetch_on_enter: bool = fetch_on_enter
    
    async def __aenter__(self) -> Self:
        if self.fetch_on_enter:
            await self._get_relationship()
        return self
    
    async def __aexit__(self, exc_type, exc, tb): ...


    async def _get_relationship(self) -> Iterable[user_pb2.RelationshipObject]:
        if self.relationships is not None:
            return self.relationships
        res = await read_relationship(self.lazy, self.current_id, self.peer_id)
        self.relationships =  res.relationships
        return self.relationships

    async def _test_relationship(self, r_type: RelationshipType) -> bool:
        test = await test_relationship(self.lazy, self.current_id, self.peer_id, r_type)
        return test.exists

    async def _create_relationship(
        self,
        current_to_peer_type: RelationshipType,
        peer_to_current_type: RelationshipType
    ) -> user_pb2.RelationshipObject:
        return await create_relationship(
            self.lazy,
            self.current_id,
            self.peer_id,
            current_to_peer_type,
            peer_to_current_type,
        )
    

    async def are_friends(self) -> bool:
        """By key test of user friendship"""
        if self.relationships is not None:
            return any((
                rel.relationship_type == RelationshipType.FRIENDS for rel in self.relationships
            ))

        return await self._test_relationship(RelationshipType.FRIENDS)

    async def peer_blocked_current(self) -> bool:
        relationships = await self._get_relationship()
        return any((
            rel.relationship_type == RelationshipType.PEER_BLOCKED_CURRENT for rel in relationships
        ))

    async def is_blocked(self) -> bool:
        """Test if either user has blocked the other"""
        relationships = await self._get_relationship()
        return any((
            rel.relationship_type in BLOCKED_RELATIONSHIPS for rel in relationships
        ))
    
    async def is_peer_requesting(self) -> bool:
        r = await self._get_relationship()

        return any((
            rel.relationship_type == RelationshipType.PEER_REQUESTING_CURRENT for rel in r
        ))

    async def is_current_requesting(self) -> bool:
        r = await self._get_relationship()

        return any((
            rel.relationship_type == RelationshipType.CURRENT_REQUESTING_PEER for rel in r
        ))
    
    async def set_friends(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.FRIENDS, RelationshipType.FRIENDS)
        
    async def block_other(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.CURRENT_BLOCKED_PEER, RelationshipType.PEER_BLOCKED_CURRENT)
    
    async def request_other(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.CURRENT_REQUESTING_PEER, RelationshipType.PEER_REQUESTING_CURRENT)

    async def _delete_relationship(self, current_to_peer: RelationshipType, peer_to_current: RelationshipType):
        await delete_relationship(
            self.lazy,
            self.current_id,
            self.peer_id,
            current_to_peer,
            peer_to_current,
        )

    async def unfriend(self):
        await self._delete_relationship(RelationshipType.FRIENDS, RelationshipType.FRIENDS) 

    async def cancel_request_to_peer(self):
        await self._delete_relationship(RelationshipType.CURRENT_REQUESTING_PEER, RelationshipType.PEER_REQUESTING_CURRENT)
        
    async def unblock(self):
        await self._delete_relationship(RelationshipType.CURRENT_BLOCKED_PEER, RelationshipType.PEER_BLOCKED_CURRENT)
