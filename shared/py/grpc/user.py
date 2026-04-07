from typing import Literal, cast

import asyncio
from collections.abc import Iterable
from uuid import UUID

from google.protobuf.wrappers_pb2 import BoolValue


from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpcgen.user_pb2_grpc import UserServiceStub
from shared.py.misc import bucketby
from shared.py.pydantic.user import UserSearchResponse
from shared.py.types import UNSET, MaybeUnset

async def get_user(lazy: DataservicesLazyGRPC[UserServiceStub], user_id: id_t) -> user_pb2.ReadUserResponse:
    stub = await lazy(user_id)
    return cast(user_pb2.ReadUserResponse, await stub.ReadUser(user_pb2.ReadUserRequest(
        user_id=id_puuid(user_id)
    )))

async def get_user_by_username(lazy: DataservicesLazyGRPC[UserServiceStub], username: str) -> user_pb2.ReadUserResponse:
    stub = await lazy()
    return cast(user_pb2.ReadUserResponse, await stub.ReadUserByUsername(user_pb2.ReadUserByUsernameRequest(
        username=username    
    )))

async def get_bulk_users(lazy: DataservicesLazyGRPC[UserServiceStub], user_ids: Iterable[id_t]) -> tuple[list[user_pb2.UserSearchEntry], list[user_pb2.UserError]]:

    buckets = await bucketby(filter(None, map(id_puuid, user_ids)), lazy)

    res = cast(list[user_pb2.BulkUserResponse], await asyncio.gather(*(
        grpc.UserBulkReader(user_pb2.ReadUserBulkRequest(user_ids=users)) for grpc, users in buckets.items()
    )))

    users, errors = [], []

    for e in res:
        users.extend(e.users)
        errors.extend(e.errors)

    return users, errors

async def edit_user(
    lazy: DataservicesLazyGRPC[UserServiceStub],
    user_id: id_t,
    *,
    username: MaybeUnset[str] = UNSET,
    make_avatar: MaybeUnset[Literal[True] | None] = UNSET,
    public_profile: MaybeUnset[bool] = UNSET,
) -> user_pb2.ReadUserResponse:

    
    if username is not UNSET:
        username_v = username
    else:
        username_v = None
    

    stub = await lazy(user_id)
    return cast(user_pb2.ReadUserResponse, await stub.UpdateUser(user_pb2.UpdateUserRequest(
        user_id=id_puuid(user_id),
        username=username_v,
        opt_make_avatar_asset_id=BoolValue(value=make_avatar) if make_avatar else None,
        opt_is_public=BoolValue(value=public_profile) if public_profile is not UNSET else None,
    )))
