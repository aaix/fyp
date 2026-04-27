
from typing import cast

from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import AmplifierLazyGRPC
from shared.py.grpcgen.amplify_pb2 import *
from shared.py.grpcgen.amplify_pb2_grpc import AmplifierServiceStub
from shared.py.grpcgen.plib_pb2 import pUUID


async def amplified_fan_out(
    grpc: AmplifierLazyGRPC[AmplifierServiceStub],
    bucket: id_t | None,
    coalesced_recipients: dict[str, list[pUUID]],
    data: bytes,
) -> FanOutResponse:
    stub = grpc(bucket)

    recipients = (LocalRecipients(host=h, recipients=r) for h, r in coalesced_recipients.items())

    return cast(FanOutResponse, await stub.FanOut(FanOutRequest(single=FanOutMessage(
        recipients=recipients,
        payload=data
    ))))