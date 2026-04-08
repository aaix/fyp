from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter


from shared.py.discovery import DiscoveryManager
from shared.py import grpc as shared_grpc


__all__ = (
    "tracer",
)


discovery = DiscoveryManager()

resource = Resource(attributes={
    SERVICE_NAME: "garbagecollector"
})

provider = TracerProvider(resource=resource)
otlp_exporter = OTLPSpanExporter(endpoint=discovery.discover_otel(), insecure=True)

provider.add_span_processor(shared_grpc.GrpcRenameProcessor())
processor = BatchSpanProcessor(otlp_exporter)
provider.add_span_processor(processor)


trace.set_tracer_provider(provider)

print("tracer provider set")

tracer = trace.get_tracer("garbagecollector")

shared_grpc.start_instrumentation()
