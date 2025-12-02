use tokio;
use tonic::transport::Server;


use dataservices::{helpers::gen_uuid, user::{account::ScyllaUserService, device::ScyallaUserDeviceService}};

#[tokio::main]
async fn main() {
    println!("Hello, world!");
    gen_uuid();
    let addr = "[::1]:3114".parse().unwrap();

    Server::builder()
        .add_optional_service(ScyllaUserService::server().await)
        .add_optional_service(ScyallaUserDeviceService::server().await)
        .serve(addr)
        .await.unwrap();
}
