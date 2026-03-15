from opentelemetry import trace

__all__ = (
    "tracer",
)

tracer = trace.get_tracer("shared")
