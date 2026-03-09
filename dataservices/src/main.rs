use tokio;
use tonic::transport::Server;


use dataservices::{chat::channel::ScyllaChannelServiceServer, helpers::gen_uuid, user::{account::ScyllaUserService, device::ScyallaUserDeviceService, relationship::ScyllaUserRelationshipService}};

use tonic_tracing_opentelemetry::middleware::server::OtelGrpcLayer;
use init_tracing_opentelemetry::resource::DetectResource;


#[tokio::main]
async fn main() {
    println!("Hello, world!");
    gen_uuid();

    let addr = "0.0.0.0:3114".parse().unwrap();

    // dropped on exit to export spans    
    let _guard = init_tracing_opentelemetry::TracingConfig::default()
        .with_json_format()
        .with_stdout()
        .with_line_numbers(false)
        .with_thread_names(false)
        .without_span_events()
        .with_otel(true)
        .with_otel_tracer_name("dataservices")
        .with_resource_config(
            DetectResource::default()
            .with_fallback_service_name("dataservices")
            .with_fallback_service_version("latest")
        )
        .init_subscriber()
        .expect("init subscribers");


    let tracer = OtelGrpcLayer::default();

    Server::builder()
        .layer(tracer)
        .add_optional_service(ScyllaUserService::server().await)
        .add_optional_service(ScyallaUserDeviceService::server().await)
        .add_optional_service(ScyllaUserRelationshipService::server().await)
        .add_optional_service(ScyllaChannelServiceServer::server().await)
        .serve(addr)
        .await.unwrap();

}
