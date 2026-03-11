from typing import Annotated
from collections.abc import Callable, Coroutine

from uuid import UUID

from fastapi import Depends, Path

from api.utils import ResourceNotFoundRpcHandler, RpcErrHandler
from shared.py.discovery import DiscoveryManager
from shared.py.grpc.channel import get_channel
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.user import get_user

from shared.py.grpcgen import channel_pb2, channel_pb2_grpc, user_pb2, user_pb2_grpc


discovery = DiscoveryManager()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), channel_pb2_grpc.ChannelServiceStub)


def RichUUIDParamFactory[lazy_t: LazyGRPC, out_t](
    ctx: Callable[[UUID], RpcErrHandler],
    lazy: lazy_t,
    fetcher: Callable[[lazy_t, UUID], Coroutine[None, None, out_t]],
    param_name: str
):
    async def dependency(input_val: UUID = Path(..., alias=param_name)) -> out_t:
        with ctx(input_val):
            return await fetcher(lazy, input_val)

    return dependency


UserParam = Annotated[user_pb2.ReadUserResponse, Depends(
    RichUUIDParamFactory(ResourceNotFoundRpcHandler, grpcuser, get_user, "user_id"),
)]

ChannelParam = Annotated[channel_pb2.ChannelObjectResponse, Depends(
    RichUUIDParamFactory(ResourceNotFoundRpcHandler, grpcchannel, get_channel, "channel_id"),
)]
