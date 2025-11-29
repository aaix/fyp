use crate::db_conn::db;
use crate::errors::{DSResult};
use crate::helpers::gen_timeuuid;
use crate::models::user::User;
use crate::protos::{user_service};

use scylla::statement::prepared::PreparedStatement;
use scylla::value::CqlTimeuuid;
use tonic::{Request, Response, Status};


use user_service::user_service_server::{UserService, UserServiceServer};
use user_service::{CreateUserRequest, ReadUserResponse};
use user_service::{DeleteUserRequest, DeleteUserResponse, ReadUserRequest, UpdateUserRequest};




#[derive(Debug)]
pub struct ScyllaUserService {
    read_user_prepared: PreparedStatement,
    create_user_prepared: PreparedStatement,
}

impl ScyllaUserService {
    pub async fn service() -> UserServiceServer<ScyllaUserService> {

        let read_user_prepared = db().await.prepare(
            "SELECT * FROM user WHERE user_id = ?"
        ).await.unwrap();

        let create_user_prepared = db().await.prepare(
            "INSERT INTO user (user_id, username, public_key) VALUES (?, ?, ?)"
        ).await.unwrap();

        UserServiceServer::new(Self {
            read_user_prepared,
            create_user_prepared,
        })
    }

    async fn read_user_impl(
        &self,
        request: Request<ReadUserRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {

        let user_id: CqlTimeuuid = request.get_ref().user_id.map(|parts| parts.into()).ok_or(Status::invalid_argument("invalid user_id"))?;


        let res = db().await.execute_unpaged(
            &self.read_user_prepared, (&user_id,)
        ).await?;

        let row = res.into_rows_result()?.first_row::<User>()?;
        let (_, username, public_key, avatar) = row.consume();

        Ok(Response::new(ReadUserResponse {
            user_id: Some(request.get_ref().user_id.unwrap()),
            avatar_asset_id: avatar.map(|asset_id| asset_id.into()),
            public_key,
            username,
        }))
    }

    async fn create_user_impl(
        &self,
        request: Request<CreateUserRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {

        let user_id = gen_timeuuid();

        // extract parts for zero copy
        let parts = request.into_inner();
        let username = parts.username;
        let public_key = parts.public_key;


        db().await.execute_unpaged(
            &self.create_user_prepared,
            (&user_id, &username, &public_key)
        ).await?;



        Ok(Response::new(ReadUserResponse {
            user_id: Some(user_id.into()),
            avatar_asset_id: None,
            public_key: public_key,
            username: username,
        }))
    }


}



#[tonic::async_trait]
impl UserService for ScyllaUserService {
    async fn create_user(
        &self,
        request: Request<CreateUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {

        Ok(self.create_user_impl(request).await?)
    }

    async fn read_user(
        &self,
        request: Request<ReadUserRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        Ok(self.read_user_impl(request).await?)
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