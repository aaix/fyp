use crate::protos::dataservices::feed_service::feed_service_server::FeedServiceServer;






#[derive(Debug)]
pub struct ScyllaFeedService {

}

impl ScyllaFeedService {
    
    pub async fn server() -> Option<FeedServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating FeedService server: {:?}", e);
            None
        } else {
            Some(FeedServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaFeedService, Box<dyn std::error::Error>> {


        Ok(Self {
        })
    }
}