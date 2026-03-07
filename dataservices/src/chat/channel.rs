/*
TABLE channel

TABLE member
*/

use tonic::async_trait;

use crate::protos::channel_service::{AddChannelMembersRequest, AddChannelMembersResponse, ChannelMemberObject, ChannelObjectResponse, CreateChannelRequest, DeleteChannelResponse, GetUserChannelsRequest, ReadChannelRequest, RemoveChannelMembersRequest, RemoveChannelMembersResponse, UpdateChannelMemberRequest, UpdateChannelRequest, UserChannelsResponse, channel_service_server::{ChannelService, ChannelServiceServer}};


#[derive(Debug)]
pub struct ScyllaChannelServiceServer {

}

impl ScyllaChannelServiceServer {
    
    pub async fn server() -> Option<ChannelServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating UserService server: {:?}", e);
            None
        } else {
            Some(ChannelServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaChannelServiceServer, Box<dyn std::error::Error>> {

        Ok(Self {})
    }
}

#[async_trait]
impl ChannelService for ScyllaChannelServiceServer {
    async fn create_channel(
        &self,
        request: tonic::Request<CreateChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelObjectResponse>,
        tonic::Status,
    > {
        todo!()
    }
    async fn read_channel(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelObjectResponse>,
        tonic::Status,
    > { todo!()}
    async fn update_channel(
        &self,
        request: tonic::Request<UpdateChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelObjectResponse>,
        tonic::Status,
    > { todo!()}
    async fn delete_channel(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<DeleteChannelResponse>,
        tonic::Status,
    > { todo!()}
    async fn add_channel_members(
        &self,
        request: tonic::Request<AddChannelMembersRequest>,
    ) -> std::result::Result<
        tonic::Response<AddChannelMembersResponse>,
        tonic::Status,
    > { todo!()}
    async fn remove_channel_members(
        &self,
        request: tonic::Request<RemoveChannelMembersRequest>,
    ) -> std::result::Result<
        tonic::Response<RemoveChannelMembersResponse>,
        tonic::Status,
    > { todo!()}
    async fn update_channel_member(
        &self,
        request: tonic::Request<UpdateChannelMemberRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelMemberObject>,
        tonic::Status,
    > { todo!()}
    async fn get_user_channels(
        &self,
        request: tonic::Request<GetUserChannelsRequest>,
    ) -> std::result::Result<
        tonic::Response<UserChannelsResponse>,
        tonic::Status,
    > { todo!()}
}
