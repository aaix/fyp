import asyncio
from typing import Annotated

from uuid import UUID

from fastapi import APIRouter, Query


from api import *
from api import feed
from api.routes.post.models import *
from api.types.params import TimelineTypeParam

from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.post import scatter_gather_posts
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
    entries = await feed.get_feed(s.user_id, timeline_type, before, limit=50)

    unsorted_posts = await scatter_gather_posts(grpcpost, timeline_type, entries)

    responses = await asyncio.gather(*map(PostResponse.from_rpc, unsorted_posts))

    # sort manually because the scatter gather doesnt guaruntee uniqueness
    sorted_posts = sorted(responses, key=lambda p: p.post_id.time, reverse=True)

    return FeedResponse(posts=sorted_posts)


    

    

    
    