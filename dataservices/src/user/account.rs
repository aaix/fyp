
/*
TABLE user
*/
use tonic::{Request, Response, Status};

use user_service::user_service_server::{UserService, UserServiceServer};
use user_service::{CreateUserRequest, ReadUserResponse};

use user_service::{DeleteUserRequest, DeleteUserResponse, ReadUserRequest, UpdateUserRequest};


pub mod user_service {
    tonic::include_proto!("dataservices.userproto");
}


fn create_response() -> ReadUserResponse {
    ReadUserResponse {
        user_id:"1234".to_string(),
        avatar_asset_id: "12345".to_string(),
        created_at: 0,
        public_key: "real key :smirk_cat:".to_string(),
        username: "john".to_string(),
    }
}


#[derive(Debug)]
pub struct ScyllaUserService;

impl ScyllaUserService {
    pub fn service() -> UserServiceServer<ScyllaUserService> {
        UserServiceServer::new(Self {})
    }
}

#[tonic::async_trait]
impl UserService for ScyllaUserService {
    async fn create_user(
        &self,
        request: Request<CreateUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        Ok(Response::new(create_response()))
    }

    async fn read_user(
        &self,
        request: Request<ReadUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        Ok(Response::new(create_response()))
    }

    async fn update_user(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        
        Ok(Response::new(create_response()))
    }

    async fn delete_user(
        &self,
        request: Request<DeleteUserRequest>,
    ) -> Result<Response<DeleteUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        let response = DeleteUserResponse {};
        Ok(Response::new(response))
    }
}