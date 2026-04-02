

from collections.abc import AsyncGenerator, Iterator
from typing import Iterable
from uuid import UUID
import uuid

from opentelemetry import trace

from api.feed.utils import FanInReason
from shared.py.grpc.feed import TimelineType, add_posts_to_feed
from shared.py.grpc.id import id_t, puuid_uuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.post import scatter_gather_users_dehydrated_posts
from shared.py.grpc.relationship import RelationshipType, read_relationships_chunkned
from shared.py.grpcgen import feed_pb2_grpc, post_pb2_grpc, user_pb2_grpc
from shared.py.grpcgen.feed_pb2 import PartialFeedEntry
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.grpcgen.user_pb2 import HalfRelationship
from shared.py.tracing import tracer

CONF_FOLLOWING_CHUNK_SIZE = 2 # 1000
CONF_FAN_IN_CHUNK_SIZE = 2 # 500
CONF_FEED_BACKFILL_NUM_POSTS = 100


grpcrelationship = DataservicesLazyGRPC(user_pb2_grpc.UserRelationshipServiceStub)
grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)
grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)

@tracer.start_as_current_span("feed.chunk_following")
async def get_following_chunked(user_id: id_t) -> AsyncGenerator[HalfRelationship]:
    chunk = await read_relationships_chunkned(
        grpcrelationship,
        user_id,
        RelationshipType.CURRENT_FOLLOWING_PEER,
        None,
        CONF_FOLLOWING_CHUNK_SIZE
    )
    
    for r in chunk.relationships:
        yield r

    while len(chunk.relationships) >= CONF_FOLLOWING_CHUNK_SIZE:
        last = chunk.relationships[-1]
        chunk = await read_relationships_chunkned(
            grpcrelationship,
            user_id,
            RelationshipType.CURRENT_FOLLOWING_PEER,
            last.user_id_b,
            CONF_FOLLOWING_CHUNK_SIZE
        )
        for r in chunk.relationships:
            yield r


@tracer.start_as_current_span("feed.do_feed_fan_in")
async def do_feed_fan_in(
    user_id: id_t,
    timeline_type: TimelineType,
    reason: FanInReason,
    before: id_t | None,
):

    span = trace.get_current_span()
    span.set_attribute("az.api.feed.fan_in.reason", str(reason))

    users: list[pUUID] = []

    if not reason.before_based:
        before = None

    min_uuid = uuid.NIL

    async for rel in get_following_chunked(user_id):
        users.append(rel.user_id_b)
        if len(users) < CONF_FAN_IN_CHUNK_SIZE:
            continue

        chunk_min_uuid = await fan_in_chunk(user_id, timeline_type, users, before)
        min_uuid = min(min_uuid, chunk_min_uuid)
        users.clear()
    
    if len(users) > 0:
        chunk_min_uuid = await fan_in_chunk(user_id, timeline_type, users, before)
        min_uuid = min(min_uuid, chunk_min_uuid)


@tracer.start_as_current_span("feed.fan_in_chunk")
async def fan_in_chunk(
    user_id: id_t,
    timeline_type: TimelineType,
    user_ids: Iterable[pUUID],
    before: id_t | None,
) -> UUID:
    
    dehydrated = await scatter_gather_users_dehydrated_posts(
        grpcpost,
        timeline_type,
        user_ids,
        CONF_FEED_BACKFILL_NUM_POSTS,
        before=before,
    )

    min_uuid = uuid.NIL

    posts = []
    for entry in dehydrated:
        if len(entry.post_ids) == 0:
            continue

        for post_id in entry.post_ids:
            posts.append(PartialFeedEntry(
                author_id=entry.user_id,
                post_id=post_id
            ))

        if last := puuid_uuid(entry.post_ids[-1]):
            min_uuid = min(last, min_uuid)

    if len(posts) > 0:
        await add_posts_to_feed(
            grpcfeed,
            user_id,
            timeline_type,
            posts
        )

    return min_uuid
