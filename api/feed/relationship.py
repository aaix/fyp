import asyncio
from itertools import product

from api.utils import unwrap
from shared.py.grpc.feed import TimelineType, update_feed_meta
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import feed_pb2_grpc

grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)


async def handle_new_following(follower: id_t, following: id_t):
    """Updates the follower's feed meta to explicitly fan in"""

    pfollowing = id_puuid(following)
    if not pfollowing:
        return

    futures = (
        update_feed_meta(grpcfeed, follower, timeline_type, explicit_fan_in_to_add=(pfollowing,), exclude_to_delete=(pfollowing,)) for timeline_type in TimelineType
    )

    await asyncio.gather(*futures)


async def handle_new_friend(user1: id_t, user2: id_t):
    """Updates both friends feed meta to explicitly fan in"""

    p1 = id_puuid(user1) or unwrap()
    p2 = id_puuid(user2) or unwrap()

    pairs = ((p1, p2), (p2, p1))

    futures = (
        update_feed_meta(grpcfeed, me, timeline_type, explicit_fan_in_to_add=(other,), exclude_to_delete=(other,))
        for (me, other), timeline_type in product(pairs, TimelineType)
    )


    await asyncio.gather(
        *futures
    )

async def handle_remove_friend(user1: id_t, user2: id_t):
    """Update both friends feed meta to exclude"""

    p1 = id_puuid(user1) or unwrap()
    p2 = id_puuid(user2) or unwrap()

    pairs = ((p1, p2), (p2, p1))

    futures = (
        update_feed_meta(grpcfeed, me, timeline_type, exclude_to_add=(other,), explicit_fan_in_to_delete=(other,))
        for (me, other), timeline_type in product(pairs, TimelineType)
    )


    await asyncio.gather(
        *futures
    )