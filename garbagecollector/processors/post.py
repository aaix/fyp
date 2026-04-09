from datetime import UTC, datetime

from garbagecollector.tracing import tracer
from shared.py.grpc.gc import GarbageFlags, delete_garbage
from shared.py.grpc.id import USER_EPOCH, calc_bucket, id_t, id_timestamp
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.post import delete_post_like_buckets, delete_post_likes_by_bucket, read_post_like_buckets
from shared.py.grpcgen import gc_pb2_grpc, post_pb2_grpc


grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)
grpcgarbage = DataservicesLazyGRPC(gc_pb2_grpc.GarbageServiceStub)


@tracer.start_as_current_span("process_post")
async def process_post(garbage_bucket: int, post_id: id_t, flags: GarbageFlags):
    if flags & GarbageFlags.LARGE:
        bucket_now = calc_bucket(datetime.now(UTC))
        epoch = calc_bucket(id_timestamp(USER_EPOCH))
        buckets = range(epoch, bucket_now)
    else:
        buckets = (await read_post_like_buckets(
            grpcpost,
            post_id,
        )).buckets

    # dont gather futures to keep load consistent
    for bucket in buckets:
        await delete_post_likes_by_bucket(
            grpcpost,
            post_id,
            bucket,
        )
    
    await delete_post_like_buckets(grpcpost, post_id)

    await delete_garbage(grpcgarbage, garbage_bucket, post_id)