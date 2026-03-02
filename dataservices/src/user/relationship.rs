/*
TABLE friendship

TABLE friendship_request

TABLE blocked_user
*/

use crate::{db_conn::db, errors::DSResult, helpers::time_now, models::{friendship::Friendship, friendship_request::FriendshipRequest}, protos::user_service::{self, BlockedUserObjectResponse, CreateBlockedUserRequest, CreateFriendshipRequest, DeleteBlockedUserRequest, DeleteBlockedUserResponse, DeleteFriendshipInviteRequest, DeleteFriendshipInviteResponse, DeleteFriendshipRequest, DeleteFriendshipResponse, FriendshipInviteObject, FriendshipInviteRequest, FriendshipInviteResponse, FriendshipObjectResponse, ReadBlockedUserRequest, ReadBlockedUsersRequest, ReadBlockedUsersResponse, ReadFriendshipsRequest, ReadFriendshipsResponse, ReadRecvFriendshipInviteResponse, ReadRecvFriendshipInvitesRequest, ReadSentFriendshipInviteResponse, ReadSentFriendshipInvitesRequest}, req_tuuid};

use futures::StreamExt;
use scylla::{statement::prepared::PreparedStatement, value::{CqlTimestamp, CqlTimeuuid}};
use tonic::{Request, Response, Status, async_trait};
use user_service::user_relationship_service_server::{UserRelationshipService, UserRelationshipServiceServer};


pub struct ScyllaUserRelationshipService {
    // friend requests
    create_friendship_invite_prepared: PreparedStatement,
    read_friendship_invite_prepared: PreparedStatement,
    read_recv_friendship_invites_prepared: PreparedStatement,
    read_sent_friendship_invites_prepared: PreparedStatement,
    delete_friendship_invite_prepared: PreparedStatement,
    // friendships
    create_friendship_prepared: PreparedStatement,
    
}

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

        let create_friendship_invite_prepared = db().await.prepare(
            "INSERT INTO dataservices.friendship_request (requester__user_id , recipient__user_id) VALUES \
            (?, ?)"
        ).await?;

        let read_friendship_invite_prepared = db().await.prepare(
            "SELECT 1 FROM dataservices.friendship_request WHERE requester__user_id ? AND recipient__user_id = ?"
        ).await?;

        let read_recv_friendship_invites_prepared = db().await.prepare(
            "SELECT requester__user_id FROM dataservices.friendship_request WHERE recipient__user_id = ?"
        ).await?;

        let read_sent_friendship_invites_prepared = db().await.prepare(
            "SELECT recipient__user_id FROM dataservices.friendship_request WHERE requester__user_id = ?"
        ).await?;

        let delete_friendship_invite_prepared = db().await.prepare(
            "DELETE FROM dataservices.friendship_request WHERE requester__user_id = ? AND recipient__user_id = ?"
        ).await?;

        let create_friendship_prepared = db().await.prepare(
            "INSERT INTO dataservices.friendship (lower__user_id, higher__user_id, created_at) VALUES (?, ?, ?)"
        ).await?;

        let read_friendships_prepared = db().await.prepare(
            "SELECT * FROM dataservices.friendship WHERE "
        )

        Ok(Self {
            create_friendship_invite_prepared,
            read_friendship_invite_prepared,
            read_recv_friendship_invites_prepared,
            read_sent_friendship_invites_prepared,
            delete_friendship_invite_prepared,
            create_friendship_prepared,
            read_friendships_prepared,
        })
    }
}

impl ScyllaUserRelationshipService {
    async fn create_friendship_invite_impl(
        &self,
        request: Request<FriendshipInviteRequest>,
    ) -> DSResult<Response<FriendshipInviteResponse>> {
        
        let requester_id: CqlTimeuuid = req_tuuid!(request, from_user_id)?;
        let recipient_id: CqlTimeuuid = req_tuuid!(request, to_user_id)?;

        db().await.execute_unpaged(&self.create_friendship_invite_prepared,
            (requester_id, recipient_id)
        ).await?;

        Ok(Response::new(FriendshipInviteResponse {  }))
    }


    async fn read_friendship_invite_impl(
        &self,
        request: Request<FriendshipInviteRequest>,
    ) -> DSResult<Response<FriendshipInviteResponse>> {
        
        let requester_id: CqlTimeuuid = req_tuuid!(request, from_user_id)?;
        let recipient_id: CqlTimeuuid = req_tuuid!(request, to_user_id)?;

        let rows = db().await.execute_unpaged(&self.read_friendship_invite_prepared,
            (requester_id, recipient_id)
        ).await?.into_rows_result()?.rows_num();

        if rows > 0 {
            Ok(Response::new(FriendshipInviteResponse {  }))
        } else {
            Err(Status::not_found("no request exists").into())
        }
    }

    async fn read_recv_friendship_invites_impl(
        &self,
        request: Request<ReadRecvFriendshipInvitesRequest>
    ) -> DSResult<Response<ReadRecvFriendshipInviteResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, to_user_id)?;

        let mut rows = db().await.execute_iter(
            self.read_recv_friendship_invites_prepared.clone(),
            (user_id,)
        ).await?.rows_stream::<(CqlTimeuuid,)>()?;

        let mut out: Vec<FriendshipInviteObject> = Vec::new();

        while let Some(row_res) = rows.next().await {
            let from_id = row_res?.0;

            out.push(FriendshipInviteObject { user_id: Some(from_id.into()) })
        }

        Ok(Response::new(ReadRecvFriendshipInviteResponse { invites: out }))
    }

    async fn read_sent_friendship_invites_impl(
        &self,
        request: Request<ReadSentFriendshipInvitesRequest>
    ) -> DSResult<Response<ReadSentFriendshipInviteResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, from_user_id)?;

        let mut rows = db().await.execute_iter(
            self.read_sent_friendship_invites_prepared.clone(),
            (user_id,)
        ).await?.rows_stream::<(CqlTimeuuid,)>()?;

        let mut out: Vec<FriendshipInviteObject> = Vec::new();

        while let Some(row_res) = rows.next().await {
            let from_id = row_res?.0;

            out.push(FriendshipInviteObject { user_id: Some(from_id.into()) })
        }

        Ok(Response::new(ReadSentFriendshipInviteResponse { invites: out }))
    }

    async fn delete_friendship_invite_impl(
        &self,
        request: Request<DeleteFriendshipInviteRequest>,
    ) -> DSResult<Response<DeleteFriendshipInviteResponse>> {

        let from_id: CqlTimeuuid = req_tuuid!(request, from_user_id)?;
        let to_id:CqlTimeuuid = req_tuuid!(request, to_user_id)?;


        db().await.execute_unpaged(
            &self.delete_friendship_invite_prepared,
            (from_id, to_id)
        ).await?;

        Ok(Response::new(DeleteFriendshipInviteResponse {  }))

    }

    async fn create_friendship_impl(
        &self,
        request: Request<CreateFriendshipRequest>,
    ) -> DSResult<Response<FriendshipObjectResponse>> {
        let id_1: CqlTimeuuid = req_tuuid!(request, user_id_1)?;
        let id_2: CqlTimeuuid = req_tuuid!(request, user_id_2)?;

        let (lower, higher) = if id_1 < id_2 {(id_1, id_2)} else {(id_2, id_1)};
        let created_at = time_now();


        db().await.execute_unpaged(
            &self.create_friendship_prepared,
            (lower, higher, created_at)
        ).await?;


        Ok(Response::new(FriendshipObjectResponse {
            user_id_1: Some(lower.into()),
            user_id_2: Some(higher.into()),
            created_at: created_at.0
        }))
    }

    async fn read_friendships_impl(
        &self,
        request: Request<ReadFriendshipsRequest>,
    ) -> DSResult<Response<ReadFriendshipsResponse>> {
        
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        let pager = db().await.execute_iter(
            self.read_friendships_prepared.clone(),
            (user_id,)
        ).await?.rows_stream::<Friendship>().await?;

    }
        
}





#[async_trait]
impl UserRelationshipService for ScyllaUserRelationshipService {
    async fn create_friendship_invite(
        &self,
        request: Request<FriendshipInviteRequest>,
    ) -> Result<Response<FriendshipInviteResponse>, Status,> {
        Ok(self.create_friendship_invite_impl(request).await?)
    }

    async fn read_friendship_invite(
        &self,
        request: Request<FriendshipInviteRequest>,
    ) -> Result<Response<FriendshipInviteResponse>, Status,> {
        Ok(self.read_friendship_invite_impl(request).await?)
    }

    async fn read_recv_friendship_invites(
        &self,
        request: Request<ReadRecvFriendshipInvitesRequest>,
    ) -> Result<
        Response<ReadRecvFriendshipInviteResponse>,
        Status,
    > {
        Ok(self.read_recv_friendship_invites_impl(request).await?)
    }

    async fn read_sent_friendship_invites(
        &self,
        request: Request<ReadSentFriendshipInvitesRequest>,
    ) -> Result<
        Response<ReadSentFriendshipInviteResponse>,
        Status,
    > {
        Ok(self.read_sent_friendship_invites_impl(request).await?)
    }

    async fn delete_friendship_invite(
        &self,
        request: Request<DeleteFriendshipInviteRequest>,
    ) -> Result<
        Response<DeleteFriendshipInviteResponse>,
        Status,
    > {
        Ok(self.delete_friendship_invite_impl(request).await?)
    }
    
    async fn create_friendship(
        &self,
        request: Request<CreateFriendshipRequest>,
    ) -> Result<
        Response<FriendshipObjectResponse>,
        Status,
    > {
        Ok(self.create_friendship_impl(request).await?)
    }

    async fn read_friendships(
        &self,
        request: Request<ReadFriendshipsRequest>,
    ) -> Result<
        Response<ReadFriendshipsResponse>,
        Status,
    > {
        Ok(self.read_friendships_impl(request).await?)
    }
    async fn delete_friendship(
        &self,
        request: Request<DeleteFriendshipRequest>,
    ) -> Result<
        Response<DeleteFriendshipResponse>,
        Status,
    > {
        todo!()
    }
    async fn create_blocked_user(
        &self,
        request: Request<CreateBlockedUserRequest>,
    ) -> Result<
        Response<BlockedUserObjectResponse>,
        Status,
    > {
        todo!()
    }
    async fn read_blocked_users(
        &self,
        request: Request<ReadBlockedUsersRequest>,
    ) -> Result<
        Response<ReadBlockedUsersResponse>,
        Status,
    > {
        todo!()
    }
    async fn read_blocked_user(
        &self,
        request: tonic::Request<ReadBlockedUserRequest>,
    ) -> Result<
        Response<BlockedUserObjectResponse>,
        Status,
    > {
        todo!()
    }
    async fn delete_blocked_user(
        &self,
        request: Request<DeleteBlockedUserRequest>,
    ) -> Result<
        Response<DeleteBlockedUserResponse>,
        Status,
    > {
        todo!()
    }
}