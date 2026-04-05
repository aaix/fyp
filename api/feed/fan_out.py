

from shared.py.grpc.feed import EntryType, TimelineType, scatter_gather_add_to_feeds
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.relationship import RelationshipType, read_relationships
from shared.py.grpcgen import feed_pb2_grpc, user_pb2_grpc

grpcrelationship = DataservicesLazyGRPC(user_pb2_grpc.UserRelationshipServiceStub)
grpcfeed = DataservicesLazyGRPC(feed_pb2_grpc.FeedServiceStub)



async def fan_out(author_id: id_t, timeline_type: TimelineType, post_id: id_t) -> int:
    rels = await read_relationships(grpcrelationship, author_id, RelationshipType.FRIENDS)
    friends = list(r.user_id_b for r in rels.relationships)

    return await scatter_gather_add_to_feeds(
        grpcfeed,
        author_id,
        timeline_type,
        post_id,
        EntryType.FANNED_OUT,
        friends
    )