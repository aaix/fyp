from shared.py.grpc.id import id_puuid, id_t, puuid_uuid
from shared.py.grpc.traceparent import get_current_traceparent
from shared.py.grpcgen.internalmessage_pb2 import IntraMessage
from shared.py.intraservice.discoverystore.client import BigPictureClient
from shared.py.intraservice.mpi.client import Pub

publisher = Pub()
bigpicture = BigPictureClient()

def new_event(to: id_t) -> IntraMessage:
    return IntraMessage(
        to=id_puuid(to),
        traceparent=get_current_traceparent(),
    )


async def send_to_remote(event: IntraMessage):
    """Discover the recipient, serialise and send the event"""
    
    if not (uuid := puuid_uuid(event.to)):
        return
    
    payload = event.SerializeToString()
    node = await bigpicture.get_node(uuid)
    await publisher.send_to(node, payload)