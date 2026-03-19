from collections.abc import Callable

from opentelemetry.instrumentation.grpc import GrpcAioInstrumentorClient

from shared.py.discovery import DiscoveryManager
from shared.py.tracing import tracer
from opentelemetry.sdk.trace import SpanProcessor

discovery = DiscoveryManager()

class GrpcRenameProcessor(SpanProcessor):
    def on_start(self, span, parent_context=None):
        if span.attributes and span.attributes.get("rpc.system") == "grpc":
            # Update the name with your desired prefix
            new_name = f"gRPC Call {span.name}"
            span.update_name(new_name)


def start_instrumentation():
    print("Starting grpc instrumentation", flush=True)
    client = GrpcAioInstrumentorClient()

    client.instrument()

def instrument_call[**P, T](f: Callable[P, T]) -> Callable[P, T]:

    if discovery.is_prod():
        return f

    def wrapper(*args: P.args, **kwargs: P.kwargs):
        with tracer.start_as_current_span(f"autoinstrument.{f.__name__}") as span:
            for i, arg in enumerate(args):
                span.set_attribute(f"az.shared.instrumentor.arg[{i}]", str(arg))
            for k, v in kwargs.items():
                span.set_attribute(f"az.shared.instrumentor.kwargs.{k}", str(v))
            return f(*args, **kwargs)
    return wrapper