from typing import Annotated, LiteralString
from collections.abc import Callable, Coroutine

from uuid import UUID

from fastapi import Depends, Path

from api.middleware.auth import SessionParam
from api.utils import ResourceNotFoundRpcHandler, RpcErrHandler
from shared.py.discovery import DiscoveryManager
from shared.py.grpc.channel import get_channel
from shared.py.grpc.id import uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.message import get_message
from shared.py.grpc.user import get_user

from shared.py.grpcgen import channel_pb2, channel_pb2_grpc, message_pb2, message_pb2_grpc, user_pb2, user_pb2_grpc


discovery = DiscoveryManager()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcchannel = LazyGRPC(discovery.discover_dataservices(), channel_pb2_grpc.ChannelServiceStub)
grpcmessage = LazyGRPC(discovery.discover_dataservices(), message_pb2_grpc.MessageServiceStub)


def RichUUIDParamFactory[lazy_t: LazyGRPC, out_t](
    ctx: Callable[[LiteralString, UUID], RpcErrHandler],
    lazy: lazy_t,
    fetcher: Callable[[lazy_t, UUID], Coroutine[None, None, out_t]],
    param_name: LiteralString
):
    async def dependency(input_val: Annotated[UUID, Path(alias=param_name)]) -> out_t:
        with ctx(param_name, input_val):
            return await fetcher(lazy, input_val)

    return dependency


UserParam = Annotated[user_pb2.ReadUserResponse, Depends(
    RichUUIDParamFactory(ResourceNotFoundRpcHandler, grpcuser, get_user, "user_id"),
)]

async def _channel_dependency_with_member(s: SessionParam, channel_id: Annotated[UUID, Path()], ) -> channel_pb2.ChannelObjectResponse:
    """Depends callable that ensures the current user is a member of the channel"""
    me = uuid_puuid(s.user_id)
    with ResourceNotFoundRpcHandler("channel_id", channel_id) as h:
        channel = await get_channel(grpcchannel, channel_id)
        if not any(me == member for member in channel.channel_members):
            h.do_raise()
        return channel


# Doesnt perform a membership check so probably best to leave it not accidentally usable
# ChannelParam = Annotated[channel_pb2.ChannelObjectResponse, Depends(
#     RichUUIDParamFactory(ResourceNotFoundRpcHandler, grpcchannel, get_channel, "channel_id"),
# )]

ChannelAsMemberParam = Annotated[channel_pb2.ChannelObjectResponse, Depends(_channel_dependency_with_member)]

async def _message_dependency(channel_id: Annotated[UUID, Path()], message_id: Annotated[UUID, Path()]) -> message_pb2.MessageObject:
    with ResourceNotFoundRpcHandler("message_id", message_id):
        return await get_message(grpcmessage, channel_id, message_id)

MessageParam = Annotated[message_pb2.MessageObject, Depends(_message_dependency)]
