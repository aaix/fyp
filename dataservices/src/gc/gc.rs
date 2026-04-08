use tonic::async_trait;

use crate::protos::dataservices::gc_service::{*, garbage_service_server::{GarbageService, GarbageServiceServer}};


pub struct ScyllaGarbageServiceServer {

}


impl ScyllaGarbageServiceServer {
    
    pub async fn server() -> Option<GarbageServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating GarbageService server: {:?}", e);
            None
        } else {
            Some(GarbageServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaGarbageServiceServer, Box<dyn std::error::Error>> {

        Ok(Self {

        })
    }
}

#[async_trait]
impl GarbageService for ScyllaGarbageServiceServer {
    async fn file_for_collection(
        &self,
        request: tonic::Request<FileGarbageRequest>,
    ) -> std::result::Result<
        tonic::Response<FileGarbageResponse>,
        tonic::Status,
    > {
        todo!()
    }
    async fn read_garbage(
        &self,
        request: tonic::Request<ReadGarbageRequest>,
    ) -> std::result::Result<tonic::Response<GarbageResponse>, tonic::Status> {
        todo!()
    }
}