from collections.abc import Iterable, Iterator
from typing import cast

from enum import Enum, IntEnum

from api.logger import log
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc
from shared.py.grpcgen.feed_pb2 import *

class StrTimelineType(str, Enum):
    _MAIN = "feed"
    _SHORT = "short"

    def to_enum(self) -> TimelineType:
        match self:
            case self._MAIN:
                return TimelineType.MAIN
            case self._SHORT:
                return TimelineType.SHORT_FORM


class TimelineType(IntEnum):
    MAIN = 0
    SHORT_FORM = 1


async def read_feed_meta(
    grpc: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    user_id: id_t,
    timeline_type: TimelineType
) -> FeedMetaResponse:
    
    stub = await grpc(user_id)
    return cast(FeedMetaResponse, await stub.ReadFeedMeta(ReadFeedMetaRequest(
        user_id=id_puuid(user_id),
        timeline_type=timeline_type
    )))

async def read_feed(
    grpc: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    user_id: id_t,
    timeline_type: TimelineType,
    *,
    before: id_t | None,
    limit: int
) -> FeedResponse:
    
    stub = await grpc(user_id)
    return cast(FeedResponse, await stub.ReadFeed(ReadFeedRequest(
        user_id=id_puuid(user_id),
        timeline_type=timeline_type,
        before=id_puuid(before) if before else None,
        limit=limit
    )))

async def add_posts_to_feed(
    grpc: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    user_id: id_t,
    timeline_type: TimelineType,
    posts: Iterable[PartialFeedEntry]
):
    log(f"Adding posts to feed {posts=}")
    stub = await grpc(user_id)
    cast(AddPostsToFeedResponse, await stub.AddPostsToFeed(AddPostsToFeedRequest(
        user_id=id_puuid(user_id),
        timeline_type=timeline_type,
        to_add=posts
    )))