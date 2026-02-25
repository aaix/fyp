from typing import cast

from shared.py.grpc.id import id_t, id_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpcgen.user_pb2_grpc import UserServiceStub

async def get_user(lazy: LazyGRPC[UserServiceStub], user_id: id_t) -> user_pb2.ReadUserResponse:
    return cast(user_pb2.ReadUserResponse, await lazy.stub.ReadUser(user_pb2.ReadUserRequest(
        user_id=id_puuid(user_id)
    )))

async def get_user_by_username(lazy: LazyGRPC[UserServiceStub], username: str) -> user_pb2.ReadUserResponse:
    return cast(user_pb2.ReadUserResponse, await lazy.stub.ReadUserByUsername(user_pb2.ReadUserByUsernameRequest(
        username=username    
    )))