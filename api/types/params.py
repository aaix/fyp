from contextlib import AbstractContextManager
from typing import Annotated, Any, Protocol, Self
from abc import ABC
from collections.abc import Callable, Coroutine

from uuid import UUID

from fastapi import Depends

from api.utils import ResourceNotFoundRpcHandler, UserNotFoundRpcHandler
from shared.py.discovery import DiscoveryManager
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.user import get_user

from shared.py.grpcgen import user_pb2, user_pb2_grpc


discovery = DiscoveryManager()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)

class _ContextManagerWithArg[I](AbstractContextManager, Protocol):
    def __call__(self, input_type: I) -> Self: ...

class RichParam[in_t, ctx_t: _ContextManagerWithArg, lazy_t: LazyGRPC, out_t]():
    def __init__(self,
        input_type: in_t,
        ctx: ctx_t,
        lazy: lazy_t,
        fetcher: Callable[[lazy_t, in_t],
        Coroutine[None, None, out_t]]
    ):
        self.ctx = ctx
        self.lazy = lazy
        self.fetcher = fetcher

    async def __call__(self, user_input: in_t) -> out_t:
        with self.ctx(user_input):
            return await self.fetcher(self.lazy, user_input)
        


async def get_user_by_uuid(
    user_id: UUID,
) -> user_pb2.ReadUserResponse:
    with UserNotFoundRpcHandler(user_id):
        return await get_user(grpcuser, user_id)


UserParam = Annotated[user_pb2.ReadUserResponse, Depends(get_user_by_uuid)]
UserParam = Annotated[user_pb2.ReadUserResponse, Depends(
    RichParam(user_pb2.ReadUserResponse, UserNotFoundRpcHandler, grpcuser, get_user)
)]