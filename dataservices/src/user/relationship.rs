/*
TABLE friendship

TABLE friendship_request

TABLE blocked_user
*/

use crate::{db_conn::db, errors::DSResult, protos::user_service::{self, BlockedUserObjectResponse, CreateBlockedUserRequest, CreateFriendshipRequest, DeleteBlockedUserRequest, DeleteBlockedUserResponse, DeleteFriendshipInviteRequest, DeleteFriendshipInviteResponse, DeleteFriendshipRequest, DeleteFriendshipResponse, FriendshipInviteRequest, FriendshipInviteResponse, FriendshipObjectResponse, ReadBlockedUserRequest, ReadBlockedUsersRequest, ReadBlockedUsersResponse, ReadFriendshipsRequest, ReadFriendshipsResponse, ReadRecvFriendshipInviteResponse, ReadRecvFriendshipInvitesRequest, ReadSentFriendshipInviteResponse, ReadSentFriendshipInvitesRequest}, req_tuuid};

use scylla::{statement::prepared::PreparedStatement, value::CqlTimeuuid};
use tonic::{Request, Response, Status, async_trait};
use user_service::user_relationship_service_server::{UserRelationshipService, UserRelationshipServiceServer};


pub struct ScyllaUserRelationshipService {
    create_friendship_invite_prepared: PreparedStatement,
    read_friendship_invite_prepared: PreparedStatement,
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

        Ok(Self {
            create_friendship_invite_prepared,
            read_friendship_invite_prepared,
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
        todo!();
    }

    async fn read_sent_friendship_invites(
        &self,
        request: Request<ReadSentFriendshipInvitesRequest>,
    ) -> Result<
        Response<ReadSentFriendshipInviteResponse>,
        Status,
    > {
        todo!()
    }
    async fn delete_friendship_invite(
        &self,
        request: Request<DeleteFriendshipInviteRequest>,
    ) -> Result<
        Response<DeleteFriendshipInviteResponse>,
        Status,
    > {
        todo!()
    }
    async fn create_friendship(
        &self,
        request: Request<CreateFriendshipRequest>,
    ) -> Result<
        Response<FriendshipObjectResponse>,
        Status,
    > {
        todo!()
    }
    async fn read_friendships(
        &self,
        request: Request<ReadFriendshipsRequest>,
    ) -> Result<
        Response<ReadFriendshipsResponse>,
        Status,
    > {
        todo!()
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