use crate::db_conn::db;
use crate::models::user::User;

use scylla::value::CqlTimeuuid;
use tonic::{Request, Response, Status};


use user_service::user_service_server::{UserService, UserServiceServer};
use user_service::{CreateUserRequest, ReadUserResponse};
use user_service::{DeleteUserRequest, DeleteUserResponse, ReadUserRequest, UpdateUserRequest};


mod user_service {
    tonic::include_proto!("dataservices.userproto");
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

        Ok(Response::new(todo!()))
    }

    async fn read_user(
        &self,
        request: Request<ReadUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        let user_id = match CqlTimeuuid::from_slice(&request.get_ref().user_id) {
            Ok(id) => id,
            Err(e) => {
                println!("Error parsing user_id: {:?}", e);
                return Err(Status::invalid_argument("Invalid user_id format"));
            }
        };

        println!("Searchinf for user_id: {:?}", user_id);

        let res = db().await.query_unpaged("SELECT * FROM dataservices.user WHERE user_id = ?", (&user_id,)).await.unwrap();
        let row = match res.into_rows_result().unwrap().first_row::<User>() {
            Ok(user) => user,
            Err(e) => {
                println!("Error fetching user from DB: {:?}", e);
                return Err(Status::not_found("User not found"));
            }
        };

        println!("Fetched user from DB: {:?}", row);

        let (user_id, username, public_key, avatar) = row.consume();

        Ok(Response::new(ReadUserResponse {
            user_id: user_id.as_bytes().to_vec(),
            avatar_asset_id: avatar.map(|id| id.as_bytes().to_vec()),
            public_key,
            username,
        }))
    }

    async fn update_user(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        println!("Got a request: {:?}", request);
        
        Ok(Response::new(todo!()))
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