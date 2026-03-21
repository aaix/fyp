from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


from shared.py.discovery import DiscoveryManager
from shared.py import grpc as shared_grpc


__all__ = (
    "tracer",
)


discovery = DiscoveryManager()

resource = Resource(attributes={
    SERVICE_NAME: "api"
})

provider = TracerProvider(resource=resource)
otlp_exporter = OTLPSpanExporter(endpoint=discovery.discover_otel(), insecure=True)

# hook grpc to add a prefix to the grpc calls
provider.add_span_processor(shared_grpc.GrpcRenameProcessor())


processor = BatchSpanProcessor(otlp_exporter)
provider.add_span_processor(processor)


trace.set_tracer_provider(provider)

print("tracer provider set")

def instrument_fastapi_app(app: FastAPI):
    FastAPIInstrumentor.instrument_app(app, exclude_spans=["receive", "send"])

tracer = trace.get_tracer("api")

shared_grpc.start_instrumentation()



