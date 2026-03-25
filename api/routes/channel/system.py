

from api.tracing import tracer
from shared.py.grpcgen.internalmessage_pb2 import EventMessageCreate
from shared.py.intraservice import client as intraclient
from shared.py.discovery import DiscoveryManager
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.message import MessageType, create_message
from shared.py.grpcgen import channel_pb2, message_pb2_grpc

discovery = DiscoveryManager()
grpcmessage = LazyGRPC(discovery.discover_dataservices(), message_pb2_grpc.MessageServiceStub)

@tracer.start_as_current_span("create_system_message")
async def create_system_message(channel: channel_pb2.ChannelObjectResponse, author_id: id_t, message_type: MessageType, content: bytes | None = None, fan_out: bool = True):
    message = await create_message(
        grpcmessage,
        channel.channel_id,
        message_type=message_type,
        last_edited=None,
        content=content,
        request_asset=None,
        author_id=author_id,
        in_reply_to=None
    )
    if not fan_out:
        return message

    await intraclient.fan_out(channel.channel_id, channel.channel_members, "message_create", lambda _: EventMessageCreate(
        author_id=id_puuid(author_id),
        message_id=message.message_id,
        channel_id=channel.channel_id,
        message_type=message_type.value,
        content=content,
    ))
    return message