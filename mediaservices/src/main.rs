use mediaservices::{cloudadapter, rpc::TransformerServer};
use tokio;
use tonic::transport::Server;


use tonic_tracing_opentelemetry::middleware::server::OtelGrpcLayer;
use init_tracing_opentelemetry::resource::DetectResource;


const MAX_FRAME_SIZE: u32 = 16 * 1000 * 1000; // 16 MB

#[tokio::main]
async fn main() {
    println!("Hello, world!");

    cloudadapter::client().await;
    cloudadapter::private_url().await;
    cloudadapter::public_url().await;


    let addr = "0.0.0.0:3119".parse().unwrap();

    // dropped on exit to export spans    
    let _guard = init_tracing_opentelemetry::TracingConfig::default()
        .with_json_format()
        .with_stdout()
        .with_line_numbers(false)
        .with_thread_names(false)
        .without_span_events()
        .with_otel(true)
        .with_otel_tracer_name("mediaservices")
        .with_resource_config(
            DetectResource::default()
            .with_fallback_service_name("mediaservices")
            .with_fallback_service_version("latest")
        )
        .init_subscriber()
        .expect("init subscribers");


    let tracer = OtelGrpcLayer::default();

    Server::builder()
        .max_frame_size(MAX_FRAME_SIZE)
        .layer(tracer)
        .add_service(TransformerServer::server().max_decoding_message_size(MAX_FRAME_SIZE as usize))
        .serve(addr)
        .await.unwrap();

}
