from typing import cast

from uuid import UUID

from fastapi import APIRouter
from grpc import StatusCode

from api import *

from api.routes.user.models import *
from api.utils import UserNotFoundRpcHandler, unwrap

from shared.py.grpc.id import puuid_uuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.relationship import PeerRelationshipManager, RelationshipType, read_relationships
from shared.py.grpc.user import get_user
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.grpcgen import user_pb2, user_pb2_grpc


discovery = DiscoveryManager()

UserRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcrelationship = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserRelationshipServiceStub)


@UserRouter.get("/profile/{user_id}")
async def get_user_profile(s: SessionParam, user_id: UUID) -> UserProfileResponse:

    with UserNotFoundRpcHandler(user_id):
        res = await get_user(grpcuser, user_id)
    
    return UserProfileResponse(
        user=UserSearchResponse(
            user_id=puuid_uuid(res.user_id) or unwrap(),
            avatar_asset_id=puuid_uuid(res.avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(res.public_key),
            username=res.username
        )
    )

@UserRouter.get("/relationships")
async def my_relationships(s:SessionParam) -> RelationshipsResponse:
    
    res = await read_relationships(grpcrelationship, s.user_id)

    out: list[UserRelationshipResponse] = []

    for r in res.relationships:
        out.append(
            UserRelationshipResponse(
                peer_id=puuid_uuid(r.user_id_b) or unwrap(),
                relationship=RelationshipType(r.relationship_type)
            )
        )
    return RelationshipsResponse(relationships=out)


@UserRouter.put("/relationship/{user_id}/friend")
async def friend_user(s: SessionParam, user_id: UUID) -> UserRelationshipResponse:
    
    with UserNotFoundRpcHandler(user_id):
        peer = await get_user(grpcuser, user_id)
    
    peer_id = puuid_uuid(peer.user_id) or unwrap()

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:
        if await r.is_blocked():
            raise ApiErrExc(errors.Forbidden("User is blocked"))
        if await r.are_friends():
            raise ApiErrExc(errors.BadRequest("Users are already friends", api_error_code=errors.ERROR_ALREADY_EXISTS))
        
        if await r.is_peer_requesting():
            await r.set_friends()
            # cancel their request to me
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()
            return UserRelationshipResponse(peer_id=peer_id, relationship=RelationshipType.FRIENDS)

        await r.request_other()
    return UserRelationshipResponse(peer_id=peer_id, relationship=RelationshipType.CURRENT_REQUESTING_PEER)

@UserRouter.delete("/relationship/{user_id}/friend")
async def unfriend_user(s: SessionParam, user_id: UUID) -> None:
    with UserNotFoundRpcHandler(user_id):
        peer = await get_user(grpcuser, user_id)
    

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:
        if await r.is_peer_requesting():
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()
            return   
        if await r.is_current_requesting():
            await r.cancel_request_to_peer()
            return

        await r.unfriend()



@UserRouter.put("/relationship/{user_id}/block")
async def block_user(s: SessionParam, user_id: UUID) -> UserRelationshipResponse:
    
    with UserNotFoundRpcHandler(user_id):
        peer = await get_user(grpcuser, user_id)
    
    peer_id = puuid_uuid(peer.user_id) or unwrap()

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:

        if await r.are_friends():
           await r.unfriend()

        if await r.is_current_requesting():
            await r.cancel_request_to_peer()
        if await r.is_peer_requesting():
            await PeerRelationshipManager(grpcrelationship, peer.user_id, s.user_id).cancel_request_to_peer()
        
        res = await r.block_other()

        return UserRelationshipResponse(
            peer_id=peer_id,
            relationship=RelationshipType(res.relationship_type)
        )


@UserRouter.delete("/relationship/{user_id}/block")
async def unblock_user(s: SessionParam, user_id: UUID) -> None:
    with UserNotFoundRpcHandler(user_id):
        peer = await get_user(grpcuser, user_id)

    async with PeerRelationshipManager(grpcrelationship, s.user_id, peer.user_id) as r:
        await r.unblock()


@UserRouter.get("/search")
async def search_users(s: SessionParam, q: UsernameSearchQuery) -> list[UserSearchResponse]:
    res = cast(user_pb2.UsernameSearchResponse, await grpcuser.stub.UsernameSearcher(user_pb2.UsernameSearch(
        query=f"{q}%",
    )))

    users: list[UserSearchResponse] = []

    for user in res.users:
        users.append(
            UserSearchResponse.from_rpc(user)
        )
    
    return users

