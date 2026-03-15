from opentelemetry import trace

from shared.py.grpcgen.traceparent_pb2 import TraceParent

def get_current_traceparent() -> TraceParent | None:
    span = trace.get_current_span()
    ctx = span.get_span_context()

    if not span.is_recording():
        return None

    trace_id_hi=ctx.trace_id >> 64
    trace_id_lo=ctx.trace_id & ((1 << 64) - 1)

    return TraceParent(
        trace_id_hi=trace_id_hi,
        trace_id_lo=trace_id_lo,
        parent_id=ctx.span_id,
        flags=ctx.trace_flags
    )


def span_from_traceparent(parent: TraceParent):

    trace_id = (parent.trace_id_hi << 64) | parent.trace_id_lo

    span_context = trace.SpanContext(
        trace_id=trace_id,
        span_id=parent.parent_id,
        is_remote=True,      # Usually True if you're getting these from another service
        trace_flags=trace.TraceFlags(parent.flags)
    )
    return trace.NonRecordingSpan(span_context)
