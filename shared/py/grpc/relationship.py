from typing import Self, cast

from enum import IntEnum
from collections.abc import Iterable

from uuid import UUID


from shared.py.grpc import instrument_call
from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen.user_pb2_grpc import UserRelationshipServiceStub
from shared.py.types import UNSET, MaybeUnset



class RelationshipType(IntEnum):
    CURRENT_REQUESTING_PEER = 1
    PEER_REQUESTING_CURRENT = 2

    FRIENDS = 3

    PEER_BLOCKED_CURRENT = 5
    CURRENT_BLOCKED_PEER = 6

    CURRENT_FOLLOWING_PEER = 7
    PEER_FOLLOWING_CURRENT = 8

BLOCKED_RELATIONSHIPS = (RelationshipType.CURRENT_BLOCKED_PEER, RelationshipType.PEER_BLOCKED_CURRENT)

async def create_relationship(
    lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],
    user_id_a: id_t,
    user_id_b: id_t,
    a_to_b_type: RelationshipType,
    b_to_a_type: RelationshipType
) -> user_pb2.RelationshipObject:
    stub = await lazy(user_id_a)
    return cast(user_pb2.RelationshipObject, await stub.CreateRelationship(user_pb2.CreateRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        a_to_b_type=a_to_b_type.value,
        b_to_a_type=b_to_a_type.value,
    )))

async def read_relationship(lazy: DataservicesLazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, user_id_b: id_t, r_types: Iterable[RelationshipType]) -> user_pb2.ReadRelationshipResponse:
    stub = await lazy(user_id_a)
    return cast(user_pb2.ReadRelationshipResponse, await stub.ReadRelationship(user_pb2.ReadRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        relationship_types=(r.value for r in r_types)
    )))

async def test_relationship(lazy: DataservicesLazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, user_id_b: id_t, relationship_type: RelationshipType) -> user_pb2.RelationshipTestResponse:
    stub = await lazy(user_id_a)
    return cast(user_pb2.RelationshipTestResponse, await stub.TestRelationship(user_pb2.RelationshipObject(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        relationship_type=relationship_type.value
    )))

async def test_many_relationships(lazy: DataservicesLazyGRPC[UserRelationshipServiceStub], user_id_a: id_t, tests: Iterable[user_pb2.TestManyRelationshipEntry]) -> user_pb2.TestManyRelationshipsResponse:
    stub = await lazy(user_id_a)
    return cast(user_pb2.TestManyRelationshipsResponse, await stub.TestManyRelationships(user_pb2.TestManyRelationshipsRequest(
        user_id=id_puuid(user_id_a),
        tests=tests
    )))

async def read_relationships(
    lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],
    user_id: id_t,
    r_type: RelationshipType,
    limit: int,
    before: MaybeUnset[id_t] = UNSET,
) -> user_pb2.RelationshipsResponse:

    stub = await lazy(user_id)
    return cast(user_pb2.RelationshipsResponse, await stub.ReadRelationships(user_pb2.ReadRelationshipsRequest(
        user_id=id_puuid(user_id),
        relationship_type=r_type.value,
        limit=limit,
        before=id_puuid(before) if before is not UNSET else None,
    )))

async def delete_relationship(
    lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],
    user_id_a: id_t, 
    user_id_b: id_t,
    a_to_b_type: RelationshipType,
    b_to_a_type: RelationshipType,
) -> user_pb2.DeleteRelationshipResponse:
    stub = await lazy(user_id_a)
    return cast(user_pb2.DeleteRelationshipResponse, await stub.DeleteRelationship(user_pb2.CreateRelationshipRequest(
        user_id_a=id_puuid(user_id_a),
        user_id_b=id_puuid(user_id_b),
        a_to_b_type=a_to_b_type.value,
        b_to_a_type=b_to_a_type.value,
    )))

async def read_relationship_counts(
    lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],
    user_id: id_t,
) -> user_pb2.GetUserRelationshipCountsResponse:
    stub = await lazy(user_id)
    return cast(user_pb2.GetUserRelationshipCountsResponse, await stub.GetUserRelationshipCounts(user_pb2.GetUserRelationshipCountsRequest(
        user_id=id_puuid(user_id)
    )))


class PeerRelationshipManager:
    """Helper class for simplifying business logic of user relationships"""
    def __init__(
            self,
            lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],
            current_user_id: id_t,
            peer_user_id: id_t,
            fetch_on_enter: Iterable[RelationshipType] | None = None
        ):
        self.lazy: DataservicesLazyGRPC[UserRelationshipServiceStub] = lazy
        self.current_id: id_t = current_user_id
        self.peer_id: id_t = peer_user_id
        self.relationships: None | Iterable[user_pb2.RelationshipObject] = None
        self.fetch_on_enter: Iterable[RelationshipType] | None = fetch_on_enter
    
    async def __aenter__(self) -> Self:
        if self.fetch_on_enter:
            await self._get_relationship(self.fetch_on_enter)
        return self
    
    async def __aexit__(self, exc_type, exc, tb): ...


    async def _get_relationship(self, r_types: Iterable[RelationshipType]) -> Iterable[user_pb2.RelationshipObject]:

        if self.relationships is not None:
            return self.relationships
        res = await read_relationship(self.lazy, self.current_id, self.peer_id, r_types)
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
    
    async def _do_test(self, r_type: RelationshipType) -> bool:
        if self.fetch_on_enter and self.relationships is not None and r_type in self.fetch_on_enter:
            return any((
                rel.relationship_type == r_type for rel in self.relationships
            ))
        return await self._test_relationship(r_type)

    

    async def are_friends(self) -> bool:
        """By key test of user friendship"""
        return await self._do_test(RelationshipType.FRIENDS)

    async def peer_blocked_current(self) -> bool:
        return await self._do_test(RelationshipType.PEER_BLOCKED_CURRENT)

    async def current_blocked_peer(self) -> bool:
        return await self._do_test(RelationshipType.CURRENT_BLOCKED_PEER)
    
    async def is_peer_requesting(self) -> bool:
        return await self._do_test(RelationshipType.PEER_REQUESTING_CURRENT)

    async def is_current_requesting(self) -> bool:
        return await self._do_test(RelationshipType.CURRENT_REQUESTING_PEER)
    
    async def set_friends(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.FRIENDS, RelationshipType.FRIENDS)
        
    async def block_other(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.CURRENT_BLOCKED_PEER, RelationshipType.PEER_BLOCKED_CURRENT)
    
    async def request_other(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.CURRENT_REQUESTING_PEER, RelationshipType.PEER_REQUESTING_CURRENT)

    async def is_current_following_peer(self) -> bool:
        return await self._do_test(RelationshipType.CURRENT_FOLLOWING_PEER)

    async def is_peer_following_current(self) -> bool:
        return await self._do_test(RelationshipType.PEER_FOLLOWING_CURRENT)

    async def follow_peer(self) -> user_pb2.RelationshipObject:
        return await self._create_relationship(RelationshipType.CURRENT_FOLLOWING_PEER, RelationshipType.PEER_FOLLOWING_CURRENT)

    async def unfollow_peer(self):
        return await self._delete_relationship(RelationshipType.CURRENT_FOLLOWING_PEER, RelationshipType.PEER_FOLLOWING_CURRENT)


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


async def can_i_view_peer_profile(lazy: DataservicesLazyGRPC[UserRelationshipServiceStub],me: id_t, peer: user_pb2.ReadUserResponse) -> tuple[bool, bool]:
    if peer.is_public:
        fetch_on_entry = (RelationshipType.PEER_BLOCKED_CURRENT,) # no
    else:
        fetch_on_entry = (
            RelationshipType.PEER_BLOCKED_CURRENT, # no
            RelationshipType.FRIENDS, # yes
            RelationshipType.PEER_BLOCKED_CURRENT # yes,
        )
    async with PeerRelationshipManager(lazy, me, peer.user_id, fetch_on_entry) as r:
        if await r.peer_blocked_current():
            return True, False
        if peer.is_public:
            return False, True
        if await r.are_friends():
            return False, True
        if await r.is_peer_following_current():
            return False, True
    return False, False