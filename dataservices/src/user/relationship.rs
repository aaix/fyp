/*
TABLE friendship

TABLE friendship_request

TABLE blocked_user
*/

use crate::protos::user_service;

use tonic::async_trait;
use user_service::user_relationship_service_server::{UserRelationshipService, UserRelationshipServiceServer};


pub struct ScyllaUserRelationshipService {}

impl ScyllaUserRelationshipService {
    pub async fn service() -> Option<UserRelationshipServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating UserRelationshipService server: {:?}", e);
            None
        } else {
            Some(UserRelationshipServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {})
    }
}

//#[async_trait]
//impl UserRelationshipService for ScyllaUserRelationshipService {    }