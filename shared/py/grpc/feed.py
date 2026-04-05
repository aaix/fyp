import asyncio
from collections.abc import Iterable, Iterator
from functools import partial
from typing import cast

from enum import Enum, IntEnum

from api.logger import log
from shared.py.grpc import instrument_call
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc
from shared.py.grpcgen.feed_pb2 import *
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.misc import bucketby
from shared.py.tracing import tracer
from shared.py.types import UNSET, MaybeUnset

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

class EntryType(IntEnum):
    FANNED_IN = 1
    FANNED_OUT = 2


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


@instrument_call
async def update_feed_meta(
    grpc: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    user_id: id_t,
    timeline_type: TimelineType,
    *,
    last_fanned_in_at: MaybeUnset[int] = UNSET,
    fanned_in_up_to: MaybeUnset[id_t] = UNSET,
    exclude_to_add: Iterable[pUUID] = (),
    exclude_to_delete: Iterable[pUUID] = (),
    explicit_fan_in_to_add: Iterable[pUUID] = (),
    explicit_fan_in_to_delete: Iterable[pUUID] = (),
) -> FeedMetaResponse:
    
    stub = await grpc(user_id)

    return cast(FeedMetaResponse, await stub.UpdateFeedMeta(UpdateFeedMetaRequest(
        user_id=id_puuid(user_id),
        timeline_type=timeline_type,
        fanned_in_up_to=id_puuid(fanned_in_up_to) if fanned_in_up_to else None,
        exclude_to_add=exclude_to_add,
        exclude_to_delete=exclude_to_delete,
        explicit_fan_in_to_add=explicit_fan_in_to_add,
        explicit_fan_in_to_delete=explicit_fan_in_to_delete,
        last_fanned_in_at=last_fanned_in_at if last_fanned_in_at else None
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

@instrument_call
async def add_posts_to_feed(
    grpc: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    user_id: id_t,
    timeline_type: TimelineType,
    posts: Iterable[PartialFeedEntry],
    entry_type: int,
):
    stub = await grpc(user_id)
    cast(AddPostsToFeedResponse, await stub.AddPostsToFeed(AddPostsToFeedRequest(
        user_id=id_puuid(user_id),
        timeline_type=timeline_type,
        to_add=posts,
        entry_type=entry_type,
    )))


@instrument_call
@tracer.start_as_current_span("feed.scatter_gather_add_to_feeds")
async def scatter_gather_add_to_feeds(
    lazy: DataservicesLazyGRPC[feed_pb2_grpc.FeedServiceStub],
    author_id: id_t,
    timeline_type: TimelineType,
    post_id: id_t,
    entry_type: EntryType,
    user_ids: Iterable[pUUID],
) -> int:
    buckets = await bucketby(user_ids, lazy)

    partial_req = partial(AddToFeedsRequest,
        timeline_type=timeline_type.value,
        post_id=id_puuid(post_id),
        author_id=id_puuid(author_id),
        entry_type=entry_type.value,
    )


    res = cast(list[AddToFeedsResponse], await asyncio.gather(*(
        grpc.AddToFeeds(partial_req(user_ids=users)) for grpc, users in buckets.items()
    )))
    return sum(rpc.successes for rpc in res)
