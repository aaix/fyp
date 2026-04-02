

from collections.abc import Iterable

from grpc import StatusCode

from api.feed import fan_in, utils

from shared.py.grpc import feed as grpc
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc
from shared.py.grpcgen import feed_pb2
from shared.py.grpcgen.feed_pb2 import FeedEntry
from shared.py.misc import SuppressRpcErr
from shared.py.tracing import tracer


grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)



@tracer.start_as_current_span("feed.generate_feed")
async def get_feed(user_id: id_t, timeline_type: grpc.TimelineType, before: id_t | None, limit: int) -> Iterable[FeedEntry]:
    
    meta = feed_pb2.FeedMetaResponse()
    with SuppressRpcErr(StatusCode.UNIMPLEMENTED):
        meta = await grpc.read_feed_meta(grpcfeed, user_id, timeline_type)


    if reason := await utils.needs_fan_in(meta, before):
       await fan_in.do_feed_fan_in(user_id, timeline_type, reason, before)
    
    rpc = await grpc.read_feed(grpcfeed, user_id, timeline_type, before=before, limit=limit)
    return rpc.entries
    