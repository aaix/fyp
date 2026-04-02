from typing import Annotated, Literal

from uuid import UUID

from fastapi import APIRouter, Query


from api import *
from api import feed
from api.routes.post.models import *
from api.types.params import TimelineTypeParam

from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc, post_pb2_grpc




discovery = DiscoveryManager()

FeedRouter = APIRouter()

grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)
grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)

@FeedRouter.get("/{timeline_type}")
async def get_feed(
    s: SessionParam,
    timeline_type: TimelineTypeParam,
    before: Annotated[UUID | None, Query()] = None,
) -> FeedResponse:
    entries = await feed.get_feed(s.user_id, timeline_type, before, limit=25)

    return FeedResponse(posts=[])


    

    

    
    