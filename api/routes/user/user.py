from typing import cast

from uuid import UUID

from fastapi import APIRouter
from grpc import StatusCode

from api import *

from api.routes.user.models import *
from api.utils import RpcErrHandler, unwrap

from shared.py.grpc.id import puuid_uuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.user import get_user
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.grpcgen import user_pb2, user_pb2_grpc


discovery = DiscoveryManager()

UserRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)


@UserRouter.get("/profile/{user_id}")
async def get_user_profile(s: SessionParam, user_id: UUID) -> UserProfileResponse:

    with RpcErrHandler(StatusCode.NOT_FOUND, lambda: errors.NotFound("No such user")):
        res = await get_user(grpcuser, user_id)
    
    return UserProfileResponse(
        user=UserSearchResponse(
            user_id=puuid_uuid(res.user_id) or unwrap(),
            avatar_asset_id=puuid_uuid(res.avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(res.public_key),
            username=res.username
        )
    )


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

