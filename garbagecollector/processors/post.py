from garbagecollector.tracing import tracer
from shared.py.grpc.id import id_t


@tracer.start_as_current_span("process_post")
async def process_post(bucket: int, post_id: id_t):
    # if post is large
    # buckets = USER_EPOCH..bucket_now
    # else buckets = fetch post like buckets

    # delete post likes bucket at a time (partition at a time)
    pass