use tokio;
use tokio::signal::unix::{signal, SignalKind};
use tonic::transport::Server;

use bigpicture::BigPictureNode;

use dataservices::{chat::{channel::ScyllaChannelServiceServer, message::ScyllaMessageServiceServer}, helpers::gen_uuid, user::{account::ScyllaUserService, device::ScyallaUserDeviceService, relationship::ScyllaUserRelationshipService}};

use tonic_tracing_opentelemetry::middleware::server::OtelGrpcLayer;
use init_tracing_opentelemetry::resource::DetectResource;


#[tokio::main]
async fn main() {
    println!("Hello, world!");
    gen_uuid();

    let listen_addr = "0.0.0.0:3114".parse().unwrap();

    let valkey_uri = std::env::var("VALKEY_URI").expect("Could not get valkey uri");
    let current_ip = local_ip_address::local_ip().expect("Could not get IP addr");

    let bigpicturenode = BigPictureNode::new(
        &valkey_uri,
        "dataservices.join",
        "dataservices.leave",
        "dataservices.members",
        current_ip,
    ).await.unwrap();

    let mut shutdown_sig = signal(SignalKind::terminate())
        .expect("failed to install SIGTERM handler");

    let mut shutdown_future = async || {
        shutdown_sig.recv().await;
        bigpicturenode.leave().await.unwrap_or_else(|e| {tracing::error!("FAILED TO LEAVE BIG PICTURE {e:?}")});
    };

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

    bigpicturenode.join().await.unwrap();

    if let Err(e) = Server::builder()
        .layer(tracer)
        .add_optional_service(ScyllaUserService::server().await)
        .add_optional_service(ScyallaUserDeviceService::server().await)
        .add_optional_service(ScyllaUserRelationshipService::server().await)
        .add_optional_service(ScyllaChannelServiceServer::server().await)
        .add_optional_service(ScyllaMessageServiceServer::server().await)
        .serve_with_shutdown(listen_addr, shutdown_future())
        .await {
            bigpicturenode.leave().await.unwrap_or_else(|e| {tracing::error!("FAILED TO LEAVE BIG PICTURE {e:?}")});
            Err(e).unwrap()
        }

}
