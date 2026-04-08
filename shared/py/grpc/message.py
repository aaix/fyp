
from enum import IntEnum
from typing import Literal, Self, cast

from google.protobuf.wrappers_pb2 import BytesValue, Int32Value, BoolValue

from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import message_pb2, message_pb2_grpc
from shared.py.types import UNSET, MaybeUnset

class MessageType(IntEnum):

    @property
    def is_user(self):
        return self.value in (self.USER_REGULAR, self.USER_MEDIA, self.USER_MEDIA_PENDING)
    
    @property
    def supports_content_editing(self):
        return self.value in (self.USER_REGULAR, self.USER_MEDIA)
    
    def can_transition_to(self, other: Self) -> bool:
        return self.value == self.USER_MEDIA_PENDING and other.value == self.USER_MEDIA

    USER_REGULAR = 0
    USER_MEDIA = 1
    USER_MEDIA_PENDING = 9

    SYSTEM_ADD_MEMBERS = 2 # content is csv of user ids
    SYSTEM_REMOVE_MEMBER = 3 # content should be user id removed
    SYSTEM_EDIT_CHANNEL_NAME = 4 # content should be new name
    SYSTEM_EDIT_CHANNEL_ICON = 5
    SYSTEM_CREATE_CHANNEL = 6


async def get_message(lazy: DataservicesLazyGRPC[message_pb2_grpc.MessageServiceStub], channel_id: id_t, message_id: id_t) -> message_pb2.MessageObject:
    stub = lazy(channel_id)
    return cast(message_pb2.MessageObject, await stub.ReadMessage(message_pb2.ReadMessageRequest(
        channel_id=id_puuid(channel_id),
        message_id=id_puuid(message_id),
    )))

async def edit_message(
    lazy: DataservicesLazyGRPC[message_pb2_grpc.MessageServiceStub],
    channel_id: id_t,
    message_id: id_t,
    *,
    content: MaybeUnset[bytes] = UNSET,
    message_type: MaybeUnset[int] = UNSET,
) -> message_pb2.MessageObject:
    

    stub = lazy(channel_id)
    return cast(message_pb2.MessageObject, await stub.UpdateMessage(message_pb2.UpdateMessageRequest(
        channel_id=id_puuid(channel_id),
        message_id=id_puuid(message_id),
        content=BytesValue(value=content) if content else None,
        message_type=Int32Value(value=message_type) if message_type is not UNSET else None,
    )))

async def read_messages(
    lazy: DataservicesLazyGRPC[message_pb2_grpc.MessageServiceStub],
    channel_id: id_t,
    before: id_t | None,
    count: int, latest_bucket: int
) -> message_pb2.ReadMessagesResponse:
    stub = lazy(channel_id)
    return cast(message_pb2.ReadMessagesResponse, await stub.ReadMessages(message_pb2.ReadMessagesRequest(
        channel_id=id_puuid(channel_id),
        before=id_puuid(before) if before else None,
        count=count,
        latest_bucket=latest_bucket,
    )))

async def create_message(
    lazy: DataservicesLazyGRPC[message_pb2_grpc.MessageServiceStub],
    channel_id: id_t,
    *,
    message_type: MessageType,
    last_edited:  int | None,
    content: bytes | None,
    additional_content: bytes | None,
    request_asset: Literal[True] | None,
    author_id: id_t,
    in_reply_to: id_t | None
) -> message_pb2.MessageObject:
    
    stub = lazy(channel_id)
    return cast(message_pb2.MessageObject, await stub.CreateMessage(message_pb2.CreateMessageRequest(
        channel_id=id_puuid(channel_id),
        message_type=message_type,
        opt_last_edited=last_edited,
        opt_content=content,
        request_asset=BoolValue(value=request_asset) if request_asset else None,
        author_id=id_puuid(author_id),
        opt_in_reply_to=id_puuid(in_reply_to) if in_reply_to else None,
        opt_additional_content=additional_content,
    )))