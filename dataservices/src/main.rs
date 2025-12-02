use tokio;
use tonic::transport::Server;


use dataservices::{helpers::gen_uuid, user::account::ScyllaUserService};

#[tokio::main]
async fn main() {
    println!("Hello, world!");
    gen_uuid();
    let addr = "[::1]:3114".parse().unwrap();

    Server::builder()
        .add_service(ScyllaUserService::server().await)
        .serve(addr)
        .await.unwrap();
}
