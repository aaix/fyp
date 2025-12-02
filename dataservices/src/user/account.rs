use crate::db_conn::db;
use crate::errors::{DSResult};
use crate::helpers::gen_timeuuid;
use crate::models::user::User;
use crate::protos::user_service::{CheckUsernameRequest, CheckUsernameResponse};
use crate::protos::{user_service};
use crate::req_tuuid;

use scylla::statement::prepared::PreparedStatement;
use scylla::value::{CqlTimeuuid, MaybeUnset};
use tonic::{Request, Response, Status};


use user_service::user_service_server::{UserService, UserServiceServer};
use user_service::{CreateUserRequest, ReadUserResponse};
use user_service::{DeleteUserRequest, DeleteUserResponse, ReadUserRequest, UpdateUserRequest};
use uuid::Uuid;




#[derive(Debug)]
pub struct ScyllaUserService {
    read_user_prepared: PreparedStatement,
    create_user_prepared: PreparedStatement,
    create_username_prepared: PreparedStatement,
    delete_user_prepared: PreparedStatement,
    update_user_prepared: PreparedStatement,
    check_username_prepared: PreparedStatement,
}

impl ScyllaUserService {
    
    pub async fn server() -> Option<UserServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating UserService server: {:?}", e);
        };
        server.ok()
    }

    pub async fn new() -> Result<UserServiceServer<ScyllaUserService>, Box<dyn std::error::Error>> {

        let read_user_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user WHERE user_id = ?"
        ).await?;

        let create_username_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_by_username (username, user_id) VALUES (?, ?) IF NOT EXISTS"
        ).await?;

        let create_user_prepared = db().await.prepare(
            "INSERT INTO dataservices.user (user_id, username, public_key) VALUES (?, ?, ?)"
        ).await?;

        let delete_user_prepared = db().await.prepare(
            "DELETE FROM dataservices.user WHERE user_id = ?"
        ).await?;

        let update_user_prepared = db().await.prepare(
            "UPDATE dataservices.user SET username = ?, opt_avatar_asset_id = ? WHERE user_id = ?"
        ).await?;

        let check_username_prepared = db().await.prepare(
            "SELECT COUNT(user_id) FROM dataservices.user_by_username WHERE username = ?"
        ).await.unwrap();

        Ok(UserServiceServer::new(Self {
            read_user_prepared,
            create_user_prepared,
            create_username_prepared,
            delete_user_prepared,
            update_user_prepared,
            check_username_prepared,
        }))
    }

    async fn read_user_impl(
        &self,
        request: Request<ReadUserRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        let res = db().await.execute_unpaged(
            &self.read_user_prepared, (&user_id,)
        ).await?;

        let row = res.into_rows_result()?.first_row::<User>()?;

        let username = row.username;
        let public_key = row.public_key;
        let avatar = row.opt_avatar_asset_id;

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


        let (applied, _, _) = db().await.execute_unpaged(
            &self.create_username_prepared,
            (&username, &user_id)
        ).await?.into_rows_result()?.first_row::<(bool, Option<&str>, Option<CqlTimeuuid>)>()?;


        if !applied {
            return Err(Status::already_exists("Username already exists").into());
        }

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

    async fn update_user_impl(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {
        
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        let unpacked = request.into_inner();

        if unpacked.username.is_some() {
            return Err(Status::unimplemented("Username updates not supported yet").into());
        }

        let username = MaybeUnset::from_option(unpacked.username);
        let avatar: MaybeUnset<Uuid> = MaybeUnset::from_option(unpacked.avatar_asset_id.map(|id| id.into()));



        db().await.execute_unpaged(
            &self.update_user_prepared,
            (&username, &avatar, &user_id)
        ).await?;


        todo!()
    }

    async fn delete_user_impl(
        &self,
        request: Request<DeleteUserRequest>,
    ) -> DSResult<Response<DeleteUserResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        db().await.execute_unpaged(
            &self.delete_user_prepared,
            (&user_id,)
        ).await?;
        Ok(Response::new(DeleteUserResponse {}))
    }

    async fn check_username_impl(
        &self,
        request: Request<CheckUsernameRequest>,
    ) -> DSResult<Response<CheckUsernameResponse>> {
        let username = &request.get_ref().username;

        let rows = db().await.execute_unpaged(
            &self.check_username_prepared,
            (username,)
        ).await?.into_rows_result()?.first_row::<(i64,)>()?.0;

        if rows != 0 {
            Err(Status::already_exists("username taken").into())
        } else {
            Ok(Response::new(CheckUsernameResponse {  }))
        }

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
        
        Ok(self.update_user_impl(request).await?)
    }

    async fn delete_user(
        &self,
        request: Request<DeleteUserRequest>,
    ) -> Result<Response<DeleteUserResponse>, Status> {
        println!("Got a request: {:?}", request);

        Ok(self.delete_user_impl(request).await?)
    }

    async fn check_username(
        &self,
        request: Request<CheckUsernameRequest>,
    ) -> Result<Response<CheckUsernameResponse>, Status> {
        Ok(self.check_username_impl(request).await?)
    }

}