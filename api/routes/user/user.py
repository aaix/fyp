from typing import Annotated, cast


from fastapi import APIRouter, Query

from api import *

from api import feed
from api.routes.user.models import *
from api.types.params import UserParam
from api.utils import now, unwrap

from shared.py.intraservice import client as intraclient
from shared.py.grpc.id import id_puuid, puuid_uuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.relationship import PeerRelationshipManager, RelationshipType, can_i_view_peer_profile, read_relationship_counts, read_relationships
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.grpcgen import internalmessage_pb2, user_pb2, user_pb2_grpc


discovery = DiscoveryManager()

UserRouter = APIRouter()

grpcuser = DataservicesLazyGRPC(user_pb2_grpc.UserServiceStub)
grpcrelationship = DataservicesLazyGRPC(user_pb2_grpc.UserRelationshipServiceStub)

async def send_friend_update(to: id_t, peer: id_t, r_type: RelationshipType | None):
    await intraclient.send_to_remote(to, "friendship_update", internalmessage_pb2.EventFriendshipUpdate(
        peer_id=id_puuid(peer) or unwrap(),
        relationship_type=r_type
    ))




@UserRouter.get("/profile/{user_id}")
async def get_user_profile(s: SessionParam, user: UserParam) -> UserProfileResponse:

    im_blocked, can_i_view = await can_i_view_peer_profile(grpcrelationship, s.user_id, user)

    if im_blocked:
        followers = None
        friends = None
    else:
        user_counters = await read_relationship_counts(grpcrelationship, user.user_id)
        followers = user_counters.num_followers
        friends = user_counters.num_friends
        
    if can_i_view:
        # fetch posts
        pass

    return UserProfileResponse(
        user=UserSearchResponse(
            user_id=puuid_uuid(user.user_id) or unwrap(),
            avatar_asset_id=puuid_uuid(user.avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(user.public_key),
            username=user.username,
        ),
        followers=followers,
        friends=friends,
    )

@UserRouter.get("/relationships")
async def my_relationships(s: SessionParam, t: Annotated[RelationshipType, Query()]) -> RelationshipsResponse:

    res = await read_relationships(grpcrelationship, s.user_id, t)

    out: list[UserRelationshipResponse] = []

    for r in res.relationships:
        out.append(
            UserRelationshipResponse(
                peer_id=puuid_uuid(r.user_id_b) or unwrap(),
                created_at=r.created_at,
                relationship=t
            )
        )
    return RelationshipsResponse(relationships=out)

@UserRouter.get("/relationship/{user_id}")
async def get_relationships_with_user(s: SessionParam, peer: UserParam, types: Annotated[list[RelationshipType], Query()]) -> list[UserRelationshipResponse]:
    s.assert_user_isnt_self(peer)

    out: list[UserRelationshipResponse] = []

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id, types) as m:
        if m.relationships is not None and not m.relationships:
            return [] # we have no relationships

        for r in m.relationships or unwrap():
            out.append(
                UserRelationshipResponse(
                    peer_id=puuid_uuid(r.user_id_b) or unwrap(),
                    created_at=r.created_at,
                    relationship=RelationshipType(r.relationship_type)
                )
            )
    
    return out


@UserRouter.put("/relationship/{user_id}/follow")
async def follow_user(s: SessionParam, peer: UserParam) -> UserRelationshipResponse:
    
    s.assert_user_isnt_self(peer)

    if not peer.is_public:
        raise ApiErrExc(errors.Forbidden("User is not accepting followers"))
    
    peer_id = puuid_uuid(peer.user_id) or unwrap()

    fetch_on_enter = (
        RelationshipType.FRIENDS,
        RelationshipType.PEER_BLOCKED_CURRENT,
        RelationshipType.CURRENT_BLOCKED_PEER,
        RelationshipType.CURRENT_FOLLOWING_PEER,
    )

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id, fetch_on_enter) as r:
        if await r.current_blocked_peer():
            raise ApiErrExc(errors.BadRequest("You have blocked that user"))
        if await r.peer_blocked_current():
            raise ApiErrExc(errors.Forbidden("User is blocked"))
        if await r.are_friends():
            raise ApiErrExc(errors.BadRequest("Users are already friends", api_error_code=errors.ERROR_ALREADY_EXISTS))
        
        if await r.is_current_following_peer():
            raise ApiErrExc(errors.BadRequest("You are already following this user", api_error_code=errors.ERROR_ALREADY_EXISTS))
        await r.follow_peer()


    return UserRelationshipResponse(peer_id=peer_id, relationship=RelationshipType.CURRENT_REQUESTING_PEER, created_at=now())

@UserRouter.delete("/relationship/{user_id}/follow")
async def unfollow_user(s: SessionParam, peer: UserParam) -> None:
    s.assert_user_isnt_self(peer)

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:
        if await r.is_current_following_peer():
            await r.unfollow_peer()



@UserRouter.put("/relationship/{user_id}/friend")
async def friend_user(s: SessionParam, peer: UserParam) -> UserRelationshipResponse:
    
    s.assert_user_isnt_self(peer)
    
    peer_id = puuid_uuid(peer.user_id) or unwrap()

    fetch_on_enter = (
        RelationshipType.FRIENDS,
        RelationshipType.PEER_BLOCKED_CURRENT,
        RelationshipType.CURRENT_BLOCKED_PEER,
        RelationshipType.PEER_REQUESTING_CURRENT,
        RelationshipType.PEER_FOLLOWING_CURRENT,
        RelationshipType.CURRENT_FOLLOWING_PEER,
    )

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id, fetch_on_enter) as r:
        if await r.current_blocked_peer():
            raise ApiErrExc(errors.BadRequest("You have blocked that user"))
        if await r.peer_blocked_current():
            raise ApiErrExc(errors.Forbidden("User is blocked"))
        if await r.are_friends():
            raise ApiErrExc(errors.BadRequest("Users are already friends", api_error_code=errors.ERROR_ALREADY_EXISTS))
        
        if not await r.is_peer_requesting():
            # request  other
            await r.request_other()
            await send_friend_update(peer.user_id, s.user_id, RelationshipType.PEER_REQUESTING_CURRENT)
            return UserRelationshipResponse(peer_id=peer_id, relationship=RelationshipType.CURRENT_REQUESTING_PEER, created_at=now())

        # upgrade to friends
        await send_friend_update(peer.user_id, s.user_id, RelationshipType.FRIENDS)

        await feed.handle_new_friend(peer.user_id, s.user_id)

        await r.set_friends()
        # cancel their request to me
        await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()

        # remove following or follower
        if await r.is_current_following_peer():
            await r.unfollow_peer()
        if await r.is_peer_following_current():
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).unfollow_peer()

        # we dont care about now being innacurate because of our eventual consistency model
        return UserRelationshipResponse(peer_id=peer_id, relationship=RelationshipType.FRIENDS, created_at=now())


@UserRouter.delete("/relationship/{user_id}/friend")
async def unfriend_user(s: SessionParam, peer: UserParam) -> None:
    s.assert_user_isnt_self(peer)

    fetch_on_enter = (
        RelationshipType.FRIENDS,
        RelationshipType.PEER_REQUESTING_CURRENT,
        RelationshipType.CURRENT_REQUESTING_PEER,
    )

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id, fetch_on_enter) as r:
        if await r.is_peer_requesting():
            await send_friend_update(peer.user_id, s.user_id, None)
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()
            return   
        if await r.is_current_requesting():
            await send_friend_update(peer.user_id, s.user_id, None)
            await r.cancel_request_to_peer()
            return

        if await r.are_friends():
            await feed.handle_remove_friend(peer.user_id, s.user_id)
            await r.unfriend()
            await send_friend_update(peer.user_id, s.user_id, None)




@UserRouter.put("/relationship/{user_id}/block")
async def block_user(s: SessionParam, peer: UserParam) -> UserRelationshipResponse:
    s.assert_user_isnt_self(peer)

    peer_id = puuid_uuid(peer.user_id) or unwrap()

    fetch_on_enter = (
        RelationshipType.FRIENDS,
        RelationshipType.PEER_REQUESTING_CURRENT,
        RelationshipType.CURRENT_REQUESTING_PEER,
    )

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id, fetch_on_enter) as r:

        if await r.are_friends():
            await r.unfriend()

        if await r.is_current_requesting():
            await r.cancel_request_to_peer()
        if await r.is_peer_requesting():
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()
        
        res = await r.block_other()
        await send_friend_update(peer.user_id, s.user_id, RelationshipType.PEER_BLOCKED_CURRENT)

        return UserRelationshipResponse(
            peer_id=peer_id,
            relationship=RelationshipType(res.relationship_type),
            created_at=now()
        )


@UserRouter.delete("/relationship/{user_id}/block")
async def unblock_user(s: SessionParam, peer: UserParam) -> None:
    s.assert_user_isnt_self(peer)


    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:
        await r.unblock()


@UserRouter.get("/search")
async def search_users(s: SessionParam, q: UsernameSearchQuery) -> list[UserSearchResponse]:
    q = q.replace('%','').replace('_','') # TODO: TEMP FIX before elasticsearch for listing all users
    if not len(q) >= 2:
        raise ApiErrExc(errors.BadRequest("bad query"))
    stub = await grpcuser()
    res = cast(user_pb2.BulkUserResponse, await stub.UsernameSearcher(user_pb2.UsernameSearch(
        query=f"{q}%",
    )))

    users: list[UserSearchResponse] = []

    for user in res.users:
        users.append(
            UserSearchResponse.from_rpc(user)
        )
    
    return users

