/*
TABLE channel

TABLE member
*/

use std::collections::HashSet;

use futures::{StreamExt, future::join_all};
use scylla::{statement::prepared::PreparedStatement, value::{CqlTimeuuid, MaybeUnset}};
use tonic::{Response, Status, async_trait};

use crate::{db_conn::db, errors::DSResult, helpers::{gen_timeuuid, time_now}, maybe_opt_field, maybe_opt_field_into, models::{channel::Channel, user_channel::UserChannel}, profile_statement, protos::dataservices::channel_service::{AddChannelMembersRequest, AddChannelMembersResponse, ChannelMemberObject, ChannelObjectResponse, CreateChannelRequest, DeleteChannelResponse, GetUserChannelsRequest, ReadChannelRequest, RemoveChannelMembersRequest, RemoveChannelMembersResponse, UpdateChannelMemberRequest, UpdateChannelMemberResponse, UpdateChannelRequest, UserChannelsResponse, channel_service_server::{ChannelService, ChannelServiceServer}}, req_ref, req_tuuid};


#[derive(Debug)]
pub struct ScyllaChannelServiceServer {
    create_channel_prepared: PreparedStatement,
    read_channel_prepared: PreparedStatement,
    update_channel_prepared: PreparedStatement,
    delete_channel_prepared: PreparedStatement,

    add_channel_members_prepared: PreparedStatement,
    remove_channel_members_prepared: PreparedStatement,


    add_user_channel_prepared: PreparedStatement,
    update_user_channel_denorm_prepared: PreparedStatement,
    update_user_channel_norm_prepared: PreparedStatement,
    delete_user_channel_prepared: PreparedStatement,

    get_user_channels_prepared: PreparedStatement,
}

impl ScyllaChannelServiceServer {
    
    pub async fn server() -> Option<ChannelServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating ChannelService server: {:?}", e);
            None
        } else {
            Some(ChannelServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaChannelServiceServer, Box<dyn std::error::Error>> {

        let create_channel_prepared = db().await.prepare(
            "INSERT INTO dataservices.channel \
                (channel_id, channel_type, opt_channel_name, channel_members, opt_channel_icon_asset_id, latest_bucket) \
                VALUES (?, ?, ?, ?, ?, ?)"
        ).await?;

        let read_channel_prepared = db().await.prepare(
            "SELECT * FROM dataservices.channel WHERE channel_id = ?"
        ).await?;

        let update_channel_prepared = db().await.prepare(
            "UPDATE dataservices.channel SET opt_channel_name = ?, opt_channel_icon_asset_id = ?, latest_bucket = ? \
            WHERE channel_id = ?"
        ).await?;

        let delete_channel_prepared = db().await.prepare(
            "DELETE FROM dataservices.channel WHERE channel_id = ?"
        ).await?;

        let add_user_channel_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_channel \
            (user_id, channel_id, encrypted_channel_key, last_accessed, opt_channel_name, opt_channel_icon_asset_id) \
            VALUES (?, ?, ?, ?, ?, ?)"
        ).await?;

        let add_channel_members_prepared = db().await.prepare(
            "UPDATE dataservices.channel SET channel_members = channel_members + ? WHERE channel_id = ?"
        ).await?;

        let remove_channel_members_prepared = db().await.prepare(
            "UPDATE dataservices.channel SET channel_members = channel_members - ? WHERE channel_id = ?"
        ).await?;

        let delete_user_channel_prepared = db().await.prepare(
            "DELETE FROM dataservices.user_channel WHERE user_id = ? AND channel_id = ?"
        ).await?;


        let get_user_channels_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_channel WHERE user_id = ?",
        ).await?;

        let update_user_channel_denorm_prepared = db().await.prepare(
            "UPDATE dataservices.user_channel SET opt_channel_name = ?, opt_channel_icon_asset_id = ? WHERE user_id = ? AND channel_id = ?"
        ).await?;

        let update_user_channel_norm_prepared = db().await.prepare(
            "UPDATE dataservices.user_channel SET last_accessed = ? WHERE user_id = ? AND channel_id = ?"
        ).await?;

        Ok(Self {
            create_channel_prepared,
            read_channel_prepared,
            update_channel_prepared,
            delete_channel_prepared,

            add_user_channel_prepared,
            add_channel_members_prepared,
            remove_channel_members_prepared,
            delete_user_channel_prepared,
            update_user_channel_denorm_prepared,
            update_user_channel_norm_prepared,

            get_user_channels_prepared,
        })
    }

    async fn create_channel_impl(
        &self,
        request: tonic::Request<CreateChannelRequest>,
    ) -> DSResult<tonic::Response<ChannelObjectResponse>> {

        let owned = request.into_inner();

        let channel_id = gen_timeuuid();
        let members: HashSet<CqlTimeuuid> = HashSet::new();
        let asset_id: Option<CqlTimeuuid> = owned.opt_channel_icon_asset_id.map(|u| u.into());
        let latest_bucket: i64 = 0;

        db().await.execute_unpaged(
            &self.create_channel_prepared,
            (channel_id, owned.channel_type, &owned.opt_channel_name, members, asset_id, latest_bucket)
        ).await?;


        Ok(Response::new(ChannelObjectResponse {
            channel_id: Some(channel_id.into()),
            channel_type: owned.channel_type,
            opt_channel_name: owned.opt_channel_name,
            opt_channel_icon_asset_id: asset_id.map(|i| i.into()),
            channel_members: Vec::new(),
            latest_bucket: 0,
        }))
    }

    async fn _read_channel_reuse(&self, channel_id: CqlTimeuuid) -> DSResult<ChannelObjectResponse> {

        let res = db().await.execute_unpaged(
            &self.read_channel_prepared,
            (channel_id,)
        ).await?.into_rows_result()?.first_row::<Channel>()?;

        Ok(ChannelObjectResponse {
            channel_id: Some(res.channel_id.into()),
            channel_type: res.channel_type,
            opt_channel_name: res.opt_channel_name,
            channel_members: res.channel_members.into_iter().map(Into::into).collect(),
            opt_channel_icon_asset_id: res.opt_channel_icon_asset_id.map(|i| i.into()),
            latest_bucket: res.latest_bucket,
        })
    }

    async fn read_channel_impl(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> DSResult<tonic::Response<ChannelObjectResponse>> {
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;


        Ok(Response::new(self._read_channel_reuse(channel_id).await?))

    }

    async fn update_channel_impl(
        &self,
        request: tonic::Request<UpdateChannelRequest>,
    ) -> DSResult<tonic::Response<ChannelObjectResponse>> {
        
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;
        let owned = request.into_inner();

        let map = owned.update_mask.ok_or(Status::invalid_argument("bad mask"))?;

        let channel_name = maybe_opt_field!(owned, opt_channel_name, map);
        let channel_icon: MaybeUnset<Option<CqlTimeuuid>> = maybe_opt_field_into!(owned, opt_channel_icon_asset_id, map);
        let bucket: MaybeUnset<i64> = MaybeUnset::from_option(owned.last_bucket);


        db().await.execute_unpaged(
            &self.update_channel_prepared,
            (
                &channel_name, channel_icon, bucket, channel_id,
            )
        ).await?;

        let futures = owned.members_to_update.iter().map(async |r| {
            let user_id: CqlTimeuuid = r.into();
            db().await.execute_unpaged(
                &self.update_user_channel_denorm_prepared,
                (
                    &channel_name,
                    &channel_icon,
                    user_id,
                    channel_id,
                )
            ).await.map(|_| user_id)?;
            // cooerce for error logging
            DSResult::Ok(user_id)
        });

        join_all(futures).await;


        Ok(Response::new(self._read_channel_reuse(channel_id).await?))

    }

    async fn delete_channel_impl(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> DSResult<tonic::Response<DeleteChannelResponse>> { 
        
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;

        db().await.execute_unpaged(
            &self.delete_channel_prepared,
            (channel_id,)
        ).await?;

        Ok(Response::new(DeleteChannelResponse {  }))

    }

    async fn add_channel_members_impl(
        &self,
        request: tonic::Request<AddChannelMembersRequest>,
    ) -> DSResult<tonic::Response<AddChannelMembersResponse>> {

        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;
        let channel = req_ref!(request, channel)?;

        let inner = request.get_ref();

        let member_ids = inner.requests.iter().filter_map(|r| {
            r.user_id.map(Into::into)
        }).collect::<Vec<CqlTimeuuid>>();

        if member_ids.len() != inner.requests.len() {
            return Err(Status::invalid_argument("member ids are not all Some").into());
        }

        let last_accessed = time_now();

        db().await.execute_unpaged(
            &self.add_channel_members_prepared,
            (member_ids, channel_id)
        ).await?;



        let futures = inner.requests.iter().map(async |r| {
            let user_id: CqlTimeuuid = r.user_id.unwrap().into();
            profile_statement!(
                "add_user_channel_prepared",
                db().await.execute_unpaged(
                    &self.add_user_channel_prepared,
                    (
                        user_id,
                        channel_id,
                        &r.encrypted_channel_key,
                        last_accessed,
                        &channel.opt_channel_name,
                        channel.opt_channel_icon_asset_id.map(Into::<CqlTimeuuid>::into)
                    )
                ).await
            )
        });

        join_all(futures).await;

        Ok(Response::new(AddChannelMembersResponse {}))


    }
    

    async fn get_user_channels_impl(
        &self,
        request: tonic::Request<GetUserChannelsRequest>,
    ) -> DSResult<tonic::Response<UserChannelsResponse>> {

        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        let mut pager = db().await.execute_iter(
            self.get_user_channels_prepared.clone(),
            (user_id,)
        ).await?.rows_stream::<UserChannel>()?;

        let mut out = Vec::new();

        while let Some(channel_res) = pager.next().await {
            let channel = channel_res?;
            out.push(
                ChannelMemberObject {
                    channel_id: Some(channel.channel_id.into()),
                    user_id: None,
                    encrypted_channel_key: channel.encrypted_channel_key,
                    last_accessed: channel.last_accessed.0,
                    opt_channel_name: channel.opt_channel_name,
                    opt_channel_icon_asset_id: channel.opt_channel_icon_asset_id.map(Into::into),
                }
            );
        }

        Ok(Response::new(UserChannelsResponse {
            channels: out
        }))

    }

    async fn remove_channel_members_impl(
        &self,
        request: tonic::Request<RemoveChannelMembersRequest>,
    ) -> DSResult<tonic::Response<RemoveChannelMembersResponse>> {
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;

        let inner = request.get_ref();

        let member_ids = inner.members.iter().map(Into::into).collect::<Vec<CqlTimeuuid>>();


        db().await.execute_unpaged(
            &self.remove_channel_members_prepared,
            (member_ids, channel_id)
        ).await?;



        let futures = inner.members.iter().map(async |r| {
            let user_id: CqlTimeuuid = r.into();
            db().await.execute_unpaged(
                &self.delete_user_channel_prepared,
                (
                    user_id,
                    channel_id,
                )
            ).await.map(|_| user_id)
        });

        join_all(futures).await;

        Ok(Response::new(RemoveChannelMembersResponse {}))


    }
    async fn update_channel_member_impl(
        &self,
        request: tonic::Request<UpdateChannelMemberRequest>,
    ) -> DSResult<tonic::Response<UpdateChannelMemberResponse>> {
        
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;

        let inner = request.get_ref();

        let last_accessed = MaybeUnset::from_option(inner.last_accessed);


        db().await.execute_unpaged(
            &self.update_user_channel_norm_prepared,
            (
                last_accessed,
                user_id,
                channel_id,
            )
        ).await?;


        Ok(Response::new(UpdateChannelMemberResponse {}))
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
        Ok(self.create_channel_impl(request).await?)
    }
    async fn read_channel(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelObjectResponse>,
        tonic::Status,
    > {
        Ok(self.read_channel_impl(request).await?)
    }
    async fn update_channel(
        &self,
        request: tonic::Request<UpdateChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<ChannelObjectResponse>,
        tonic::Status,
    > {
        Ok(self.update_channel_impl(request).await?)
    }
    async fn delete_channel(
        &self,
        request: tonic::Request<ReadChannelRequest>,
    ) -> std::result::Result<
        tonic::Response<DeleteChannelResponse>,
        tonic::Status,
    > { 
        Ok(self.delete_channel_impl(request).await?)
    }
    async fn add_channel_members(
        &self,
        request: tonic::Request<AddChannelMembersRequest>,
    ) -> std::result::Result<
        tonic::Response<AddChannelMembersResponse>,
        tonic::Status,
    > {
        Ok(self.add_channel_members_impl(request).await?)
    }
    async fn remove_channel_members(
        &self,
        request: tonic::Request<RemoveChannelMembersRequest>,
    ) -> std::result::Result<
        tonic::Response<RemoveChannelMembersResponse>,
        tonic::Status,
    > {
        Ok(self.remove_channel_members_impl(request).await?)
    }
    async fn update_channel_member(
        &self,
        request: tonic::Request<UpdateChannelMemberRequest>,
    ) -> std::result::Result<
        tonic::Response<UpdateChannelMemberResponse>,
        tonic::Status,
    > {
        Ok(self.update_channel_member_impl(request).await?)
    }
    async fn get_user_channels(
        &self,
        request: tonic::Request<GetUserChannelsRequest>,
    ) -> std::result::Result<
        tonic::Response<UserChannelsResponse>,
        tonic::Status,
    > {
        Ok(self.get_user_channels_impl(request).await?)
    }
}
