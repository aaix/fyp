from typing import Iterable

from collections.abc import AsyncGenerator


import uuid
from uuid import UUID
from datetime import UTC, datetime

from opentelemetry import trace

from api.feed.utils import FanInReason
from shared.py.grpc.feed import EntryType, TimelineType, add_posts_to_feed, update_feed_meta
from shared.py.grpc.id import MIN_UUID_V1, id_t, puuid_uuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.post import scatter_gather_users_dehydrated_posts
from shared.py.grpc.relationship import RelationshipType, read_relationships_chunkned
from shared.py.grpcgen import feed_pb2_grpc, post_pb2_grpc, user_pb2_grpc
from shared.py.grpcgen.feed_pb2 import FeedMetaResponse, PartialFeedEntry
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.grpcgen.user_pb2 import HalfRelationship
from shared.py.tracing import tracer
from shared.py.types import UNSET

# read users following in chunks of 1000
CONF_FOLLOWING_CHUNK_SIZE = 1000

# fan in 500 users
CONF_FAN_IN_CHUNK_SIZE = 500

# with 20 posts from each user
CONF_FEED_BACKFILL_NUM_POSTS = 20

# fill friends with more posts because they dont get fanned in on demand like followers
CONF_FEED_BACKFILL_FRIENDS_NUM_POSTS = 100


grpcrelationship = DataservicesLazyGRPC(user_pb2_grpc.UserRelationshipServiceStub)
grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)
grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)


async def get_following_chunked(user_id: id_t) -> AsyncGenerator[HalfRelationship]:
    """
    Provides an async iterator over the users relationships
    relationships are fetched in chunks using CONF_FOLLOWING_CHUNK_SIZE
    """
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
    meta: FeedMetaResponse,
):

    last_fanned_in_at = UNSET

    span = trace.get_current_span()
    span.set_attribute("az.api.feed.fan_in.reason", str(reason))

    if not reason.before_based:
        before = None

    min_uuid = uuid.MAX


    # fan in explicit first because the after may mess with
    # fanning in old posts from new friends
    if reason.explicit_based:
        min_uuid = await fan_in_chunk(
            user_id,
            timeline_type,
            meta.explicit_fan_in_users,
            None,
            min_uuid,
            None,
            CONF_FEED_BACKFILL_FRIENDS_NUM_POSTS
        )


    # only fan in followers if we have a reason
    # otherwise wait for time based cool down if it was from explicit based
    if before or reason.time_based:
        users: list[pUUID] = []

        last_fanned_in_at=int((datetime.now(UTC).timestamp() - 1) * 1000)

        after = meta.last_fanned_in_at or None

        with tracer.start_as_current_span("feed.chunk_following"):
            async for rel in get_following_chunked(user_id):
                users.append(rel.user_id_b)
                if len(users) < CONF_FAN_IN_CHUNK_SIZE:
                    continue

                min_uuid = await fan_in_chunk(user_id, timeline_type, users, before, min_uuid, after)
                users.clear()

            if len(users) > 0:
                # fan in the final chunk
                min_uuid = await fan_in_chunk(user_id, timeline_type, users, before, min_uuid, after)
    
    to_remove = meta.explicit_fan_in_users if reason.explicit_based else ()

    # if we have fanned in EVERYONE and nobody has more posts
    if min_uuid == uuid.MAX:
        min_uuid = MIN_UUID_V1

    await update_feed_meta(
        grpcfeed,
        user_id,
        timeline_type,
        explicit_fan_in_to_delete=to_remove,
        fanned_in_up_to=min_uuid,
        last_fanned_in_at=last_fanned_in_at
    )
    



@tracer.start_as_current_span("feed.fan_in_chunk")
async def fan_in_chunk(
    user_id: id_t,
    timeline_type: TimelineType,
    user_ids: Iterable[pUUID],
    before: id_t | None,
    current_min_uuid: UUID,
    after: int | None,
    to_backfill = CONF_FEED_BACKFILL_NUM_POSTS,
) -> UUID:
    
    dehydrated = await scatter_gather_users_dehydrated_posts(
        grpcpost,
        timeline_type,
        user_ids,
        to_backfill,
        before=before,
        after=after,
    )

    min_uuid = uuid.MAX

    posts = []
    for entry in dehydrated:
        if len(entry.post_ids) == 0:
            continue

        for post_id in entry.post_ids:
            posts.append(PartialFeedEntry(
                author_id=entry.user_id,
                post_id=post_id
            ))

        # only update the MIN value if the users posts fetched was greater or equal to the num requested
        # i.e. if the user has less posts, then all their posts are in the feed
        # so there is no reason to look back
        if len(entry.post_ids) >= to_backfill and (last := puuid_uuid(entry.post_ids[-1])):
            min_uuid = min(last, min_uuid)

    if len(posts) > 0:
        await add_posts_to_feed(
            grpcfeed,
            user_id,
            timeline_type,
            posts,
            EntryType.FANNED_IN,
        )

    if min_uuid is not uuid.MAX:
        current_min_uuid = min(min_uuid, current_min_uuid)

    return current_min_uuid
