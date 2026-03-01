use crate::db_conn::db;
use crate::errors::{DSResult};
use crate::helpers::gen_timeuuid;
use crate::models::user::User;
use crate::protos::user_service::{CheckUsernameResponse, ReadUserByUsernameRequest, UsernameSearch, UsernameSearchResponse, UserSearchEntry};
use crate::protos::{user_service};
use crate::req_tuuid;

use futures::stream::StreamExt;



use scylla::errors::FirstRowError;
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
    fetch_user_id_by_username_prepared: PreparedStatement,

    username_searcher_prepared: PreparedStatement, 
}

impl ScyllaUserService {
    
    pub async fn server() -> Option<UserServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating UserService server: {:?}", e);
            None
        } else {
            Some(UserServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaUserService, Box<dyn std::error::Error>> {

        let read_user_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user WHERE user_id = ?"
        ).await?;

        let create_username_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_by_username (username, user_id) VALUES (?, ?) IF NOT EXISTS"
        ).await?;

        let create_user_prepared = db().await.prepare(
            "INSERT INTO dataservices.user (user_id, email, username, public_key) VALUES (?, ?, ?, ?)"
        ).await?;

        let delete_user_prepared = db().await.prepare(
            "DELETE FROM dataservices.user WHERE user_id = ?"
        ).await?;

        let update_user_prepared = db().await.prepare(
            "UPDATE dataservices.user SET username = ?, opt_avatar_asset_id = ? WHERE user_id = ?"
        ).await?;

        let fetch_user_id_by_username_prepared = db().await.prepare(
            "SELECT user_id FROM dataservices.user_by_username WHERE username = ?"
        ).await?;

        let mut username_searcher_prepared = db().await.prepare(
            "SELECT user_id, opt_avatar_asset_id, public_key, username FROM dataservices.user WHERE username like ? LIMIT 25 ALLOW FILTERING"
        ).await?;

        username_searcher_prepared.set_page_size(25);


        Ok(Self {
            read_user_prepared,
            create_user_prepared,
            create_username_prepared,
            delete_user_prepared,
            update_user_prepared,
            fetch_user_id_by_username_prepared,
            username_searcher_prepared,
        })
    }

    async fn _read_user_reuse(
        &self,
        user_id: CqlTimeuuid,
    ) -> DSResult<Response<ReadUserResponse>> {

        let res = db().await.execute_unpaged(
            &self.read_user_prepared, (&user_id,)
        ).await?;

        let row = res.into_rows_result()?.first_row::<User>()?;

        let username = row.username;
        let public_key = row.public_key;
        let avatar = row.opt_avatar_asset_id;
        let email = row.email;

        Ok(Response::new(ReadUserResponse {
            user_id: Some(user_id.into()),
            avatar_asset_id: avatar.map(|asset_id| asset_id.into()),
            public_key,
            username,
            email,
        }))
    }


    async fn read_user_impl(
        &self,
        request: Request<ReadUserRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        Ok(self._read_user_reuse(user_id).await?)
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
        let email = parts.email;


        let (applied, _, _) = db().await.execute_unpaged(
            &self.create_username_prepared,
            (&username, &user_id)
        ).await?.into_rows_result()?.first_row::<(bool, Option<&str>, Option<CqlTimeuuid>)>()?;


        if !applied {
            return Err(Status::already_exists("Username already exists").into());
        }

        db().await.execute_unpaged(
            &self.create_user_prepared,
            (&user_id, &email, &username, &public_key)
        ).await?;



        Ok(Response::new(ReadUserResponse {
            user_id: Some(user_id.into()),
            avatar_asset_id: None,
            public_key: public_key,
            email: email,
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
        request: Request<ReadUserByUsernameRequest>,
    ) -> DSResult<Response<CheckUsernameResponse>> {
        let username = &request.get_ref().username;

        let rows = db().await.execute_unpaged(
            &self.fetch_user_id_by_username_prepared,
            (username,)
        ).await?.into_rows_result()?.rows_num();

        if rows != 0 {
            Err(Status::already_exists("username taken").into())
        } else {
            Ok(Response::new(CheckUsernameResponse {  }))
        }

    }

    async fn read_user_by_username_impl(
        &self,
        request: Request<ReadUserByUsernameRequest>,
    ) -> DSResult<Response<ReadUserResponse>> {

        let username = &request.get_ref().username;


        let user_id = match db().await.execute_unpaged(
            &self.fetch_user_id_by_username_prepared,
            (username,)
        ).await?.into_rows_result()?.first_row::<(CqlTimeuuid,)>() {
            Ok(user_id) => user_id.0,
            Err(e) => {
                match e {
                    FirstRowError::RowsEmpty => return Err(Status::not_found("no user_id with username").into()),
                    _ => Err(e)?,
                }
            },
        };


        Ok(self._read_user_reuse(user_id).await?)

    }

    async fn username_searcher_impl(
        &self,
        request: Request<UsernameSearch>,
    ) -> DSResult<Response<UsernameSearchResponse>> {
        // TODO: use elastisearch

        let query = &request.get_ref().query;

        // page here bc there may be many tombstones even though we limit to 25
        let mut stream = db().await.execute_iter(self.username_searcher_prepared.clone(), (query,)).await?
            .rows_stream::<(CqlTimeuuid, Option<CqlTimeuuid>, Vec<u8>, String)>()?;

        // SELECT user_id, opt_avatar_asset_id, public_key, username

        let mut users: Vec<UserSearchEntry> = Vec::with_capacity(25);

        while let Some(next_row_res) = stream.next().await {
            let (user_id, avatar, public_key, username) = next_row_res?;
            users.push(UserSearchEntry {
                user_id: Some(user_id.into()),
                username,
                opt_avatar_asset_id: avatar.map(|a| a.into()),
                public_key,
            });
        }

        Ok(Response::new(UsernameSearchResponse { users: users }))

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
        request: Request<ReadUserByUsernameRequest>,
    ) -> Result<Response<CheckUsernameResponse>, Status> {
        Ok(self.check_username_impl(request).await?)
    }

    async fn read_user_by_username(
        &self,
        request: Request<ReadUserByUsernameRequest>,
    ) -> Result<Response<ReadUserResponse>, Status> {
        Ok(self.read_user_by_username_impl(request).await?)
    }

    async fn username_searcher(
        &self,
        request: Request<UsernameSearch>,
    ) -> Result<Response<UsernameSearchResponse>, Status> {

        Ok(self.username_searcher_impl(request).await?)
    }

}