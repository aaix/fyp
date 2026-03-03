use tokio;
use tonic::transport::Server;


use dataservices::{helpers::gen_uuid, user::{account::ScyllaUserService, device::ScyallaUserDeviceService, relationship::ScyllaUserRelationshipService}};

#[tokio::main]
async fn main() {
    println!("Hello, world!");
    gen_uuid();
    let addr = "0.0.0.0:3114".parse().unwrap();

    Server::builder()
        .add_optional_service(ScyllaUserService::server().await)
        .add_optional_service(ScyallaUserDeviceService::server().await)
        .add_optional_service(ScyllaUserRelationshipService::server().await)
        .serve(addr)
        .await.unwrap();
}
