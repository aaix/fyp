from typing import LiteralString
from collections.abc import Callable, Iterable

import asyncio


from google.protobuf.message import Message
from opentelemetry import trace

from shared.py.grpc import amplifier
from shared.py.grpc.id import id_puuid, id_t, id_uuid, puuid_uuid
from shared.py.grpc.lazy import AmplifierLazyGRPC
from shared.py.grpc.traceparent import get_current_traceparent
from shared.py.grpcgen import amplify_pb2_grpc
from shared.py.grpcgen.amplified_pb2 import AmplifiedIntraMessage
from shared.py.grpcgen.internalmessage_pb2 import IntraMessage
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.intraservice.discoverystore import GATEWAY_SERVICE
from shared.py.intraservice.discoverystore.client import BigPictureClientServiceFactory
from shared.py.intraservice.mpi.client import Pub
from shared.py.misc import bucketby
from shared.py.tracing import tracer

publisher = Pub()
gateway_bigpicture = BigPictureClientServiceFactory(GATEWAY_SERVICE)

grpcamp = AmplifierLazyGRPC(amplify_pb2_grpc.AmplifierServiceStub)


@tracer.start_as_current_span("LEGACY.shared.send_to_remote")
async def send_to_remote(to: id_t, key: str, value: Message):
    """Discover the recipient, serialise and send the event"""


    event = IntraMessage(
        traceparent=get_current_traceparent()
    )



    getattr(event, key).SetInParent()
    getattr(event, key).CopyFrom(value)

    
    intra_payload = event.SerializeToString()
    node = gateway_bigpicture.get_node(to)
    if node is None:
        return


    if (span := trace.get_current_span()).is_recording():
        span.set_attribute("az.bigpicture.to", node)
        span.set_attribute("az.bigpicture.payload.size", len(intra_payload))
        span.set_attribute("az.bigpicture.payload.type", key)

    recipient = id_puuid(to)

    fake_amplified = AmplifiedIntraMessage(
        recipients=(recipient,) if recipient else (),
        intramessage=intra_payload
    )

    await publisher.send_to(node, fake_amplified.SerializeToString())

@tracer.start_as_current_span("LEGACY.shared.fan_out")
async def fan_out[T: id_t](bucket: id_t, recipients: Iterable[T], event_name: LiteralString, message_factory: Callable[[T], Message]):
    futures = []
    for recipient in recipients:
        futures.append(
            send_to_remote(recipient, event_name, message_factory(recipient))
        )
    await asyncio.gather(*futures)

@tracer.start_as_current_span("shared.fan_out")
async def fan_out_amplified(bucket: id_t, recipients: Iterable[pUUID], event_name: LiteralString, message: Message):
    futures = []

    to = bucketby(filter(None, recipients), gateway_bigpicture.get_node)


    event = IntraMessage(
        traceparent=get_current_traceparent(),
    )

    getattr(event, event_name).SetInParent()
    getattr(event, event_name).CopyFrom(message)
    
    payload = event.SerializeToString()

    await amplifier.amplified_fan_out(
        grpcamp,
        bucket,
        coalesced_recipients=to,
        data=payload
    )

    await asyncio.gather(*futures)
