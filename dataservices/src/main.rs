use tokio;
use tonic::transport::Server;


use dataservices::user::account::ScyllaUserService;

#[tokio::main]
async fn main() {
    println!("Hello, world!");
    let addr = "[::1]:3114".parse().unwrap();

    Server::builder()
        .add_service(ScyllaUserService::service())
        .serve(addr)
        .await.unwrap();
}
