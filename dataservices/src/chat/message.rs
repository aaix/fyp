use tonic::async_trait;

use crate::protos::dataservices::message_service::{CreateMessageRequest, DeleteMessageRequest, DeleteMessageResponse, MessageObject, ReadMessageRequest, ReadMessagesRequest, ReadMessagesResponse, UpdateMessageRequest, message_service_server::{MessageService, MessageServiceServer}};


#[derive(Debug)]
pub struct ScyllaMessageServiceServer {

}

impl ScyllaMessageServiceServer {
    
    pub async fn server() -> Option<MessageServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating MessageService server: {:?}", e);
            None
        } else {
            Some(MessageServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaMessageServiceServer, Box<dyn std::error::Error>> {
        Ok(Self {})
    }
}

#[async_trait]
impl MessageService for ScyllaMessageServiceServer {
        async fn create_message(
        &self,
        request: tonic::Request<CreateMessageRequest>,
    ) -> std::result::Result<tonic::Response<MessageObject>, tonic::Status> {
        todo!();
    }

    async fn update_message(
        &self,
        request: tonic::Request<UpdateMessageRequest>,
    ) -> std::result::Result<tonic::Response<MessageObject>, tonic::Status> {
        todo!();
    }

    async fn read_message(
        &self,
        request: tonic::Request<ReadMessageRequest>,
    ) -> std::result::Result<tonic::Response<MessageObject>, tonic::Status> {
        todo!();
    }

    async fn delete_message(
        &self,
        request: tonic::Request<DeleteMessageRequest>,
    ) -> std::result::Result<
        tonic::Response<DeleteMessageResponse>,
        tonic::Status,
    > {
        todo!();
    }

    async fn read_messages(
        &self,
        request: tonic::Request<ReadMessagesRequest>,
    ) -> std::result::Result<
        tonic::Response<ReadMessagesResponse>,
        tonic::Status,
    > {
        todo!();
    }
    
}