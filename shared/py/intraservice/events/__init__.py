from typing import LiteralString
from collections.abc import Callable, Iterable

import asyncio


from google.protobuf.message import Message
from opentelemetry import trace

from shared.py.grpc.id import id_puuid, id_t, puuid_uuid
from shared.py.grpc.traceparent import get_current_traceparent
from shared.py.grpcgen.internalmessage_pb2 import IntraMessage
from shared.py.intraservice.discoverystore import GATEWAY_SERVICE
from shared.py.intraservice.discoverystore.client import BigPictureClient
from shared.py.intraservice.mpi.client import Pub
from shared.py.tracing import tracer

publisher = Pub()
gateway_bigpicture = BigPictureClient(GATEWAY_SERVICE)


@tracer.start_as_current_span("shared.send_to_remote")
async def send_to_remote(to: id_t, key: str, value: Message):
    """Discover the recipient, serialise and send the event"""



    event = IntraMessage(
        to=id_puuid(to),
        traceparent=get_current_traceparent(),
    )

    getattr(event, key).SetInParent()
    getattr(event, key).CopyFrom(value)

    if not (uuid := puuid_uuid(event.to)):
        return
    
    payload = event.SerializeToString()
    node = await gateway_bigpicture.get_node(uuid)
    if node is None:
        return


    if (span := trace.get_current_span()).is_recording():
        span.set_attribute("az.bigpicture.to", node)
        span.set_attribute("az.bigpicture.payload.size", len(payload))
        span.set_attribute("az.bigpicture.payload.type", key)

    await publisher.send_to(node, payload)

@tracer.start_as_current_span("shared.fan_out")
async def fan_out[T: id_t](bucket: id_t, recipients: Iterable[T], event_name: LiteralString, message_factory: Callable[[T], Message]):
    futures = []
    for recipient in recipients:
        futures.append(
            send_to_remote(recipient, event_name, message_factory(recipient))
        )
    await asyncio.gather(*futures)