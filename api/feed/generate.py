

from collections.abc import Sequence, Iterator

from itertools import chain
from uuid import UUID

from grpc import StatusCode

from api.feed import fan_in, utils

from shared.py.grpc import feed as grpc
from shared.py.grpc.id import id_t, puuid_uuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc
from shared.py.grpcgen import feed_pb2
from shared.py.grpcgen.feed_pb2 import FeedEntry, FeedMetaResponse
from shared.py.misc import SuppressRpcErr
from shared.py.tracing import tracer


grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)



@tracer.start_as_current_span("feed.generate_feed")
async def get_feed(user_id: id_t, timeline_type: grpc.TimelineType, before: id_t | None, limit: int) -> list[FeedEntry]:
    
    meta = feed_pb2.FeedMetaResponse()
    with SuppressRpcErr(StatusCode.NOT_FOUND):
        meta = await grpc.read_feed_meta(grpcfeed, user_id, timeline_type)

    to_exclude = set(filter(None, (puuid_uuid(u) for u in meta.exclude_users)))

    slices: list[Sequence[FeedEntry]] = []

    # take initial feed
    unique_authors, entries = await take_feed_slice(user_id, timeline_type, before, limit, meta)

    slices.append(entries)

    # if a user to exclude took up the entire feed slice we should get another slice
    # to avoid returning an empty array after filtering
    while len(unique_authors) > 0 and len(to_exclude) > 0 and unique_authors.issubset(to_exclude):
        before = entries[-1].post_id
        unique_authors, entries = await take_feed_slice(user_id, timeline_type, before, limit, meta)

        slices.append(entries)
    
    include_posts: list[FeedEntry] = []
    exclude_posts: list[FeedEntry] = []
    for entry in  chain(*slices):
        if puuid_uuid(entry.post_author_id) not in to_exclude:
            include_posts.append(entry)
            continue

        exclude_posts.append(entry)

    if len(exclude_posts) > 0:
        await grpc.remove_posts_from_feed(
            grpcfeed,
            user_id,
            timeline_type,
            (p.post_id for p in exclude_posts),
        )

    return include_posts


@tracer.start_as_current_span("feed.take_feed_slice")
async def take_feed_slice(user_id: id_t, timeline_type: grpc.TimelineType, before: id_t | None, limit: int, meta: FeedMetaResponse) -> tuple[set[UUID], Sequence[FeedEntry]]:
    if reason := await utils.needs_fan_in(meta, before):
       await fan_in.do_feed_fan_in(user_id, timeline_type, reason, before, meta)
    
    rpc =  await grpc.read_feed(grpcfeed, user_id, timeline_type, before=before, limit=limit)
    return set(filter(None, (puuid_uuid(p.post_author_id) for p in rpc.entries))), rpc.entries