from garbagecollector.tracing import tracer
from shared.py.grpc.id import id_t


@tracer.start_as_current_span("process_post")
async def process_post(bucket: int, post_id: id_t):
    ...