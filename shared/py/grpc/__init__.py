from opentelemetry.instrumentation.grpc import GrpcAioInstrumentorClient

from opentelemetry import trace
from opentelemetry.sdk.trace import SpanProcessor

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