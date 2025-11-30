use crate::db_conn::db;
use crate::errors::{DSResult};
use crate::helpers::gen_timeuuid;
use crate::models::user::User;
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
    delete_user_prepared: PreparedStatement,
    update_user_prepared: PreparedStatement,
}

impl ScyllaUserService {
    pub async fn service() -> UserServiceServer<ScyllaUserService> {

        let read_user_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user WHERE user_id = ?"
        ).await.unwrap();

        let create_user_prepared = db().await.prepare(
            "INSERT INTO dataservices.user (user_id, username, public_key) VALUES (?, ?, ?)"
        ).await.unwrap();

        let delete_user_prepared = db().await.prepare(
            "DELETE FROM dataservices.user WHERE user_id = ?"
        ).await.unwrap();

        let update_user_prepared = db().await.prepare(
            "UPDATE dataservices.user SET username = ?, opt_avatar_asset_id = ? WHERE user_id = ?"
        ).await.unwrap();

        UserServiceServer::new(Self {
            read_user_prepared,
            create_user_prepared,
            delete_user_prepared,
            update_user_prepared,
        })
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
}