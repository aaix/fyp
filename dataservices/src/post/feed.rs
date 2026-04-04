use futures::{StreamExt, future::join_all};
use scylla::{statement::prepared::PreparedStatement, value::{CqlTimeuuid, MaybeUnset}};
use tonic::{Response, async_trait};

use crate::{db_conn::db, errors::DSResult, models::{user_timeline_entry::UserTimelineEntry, user_timeline_meta::UserTimelineMeta}, protos::dataservices::feed_service::{feed_service_server::{FeedService, FeedServiceServer}, *}, req_tuuid};






#[derive(Debug)]
pub struct ScyllaFeedService {
    read_feed_meta_prepared: PreparedStatement,
    update_feed_meta_prepared: PreparedStatement,
    read_feed_prepared_no_before: PreparedStatement,
    read_feed_prepared_before: PreparedStatement,
    add_to_feed_prepared: PreparedStatement,
}

impl ScyllaFeedService {
    
    pub async fn server() -> Option<FeedServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating FeedService server: {:?}", e);
            None
        } else {
            Some(FeedServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaFeedService, Box<dyn std::error::Error>> {


        let read_feed_meta_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_timeline_meta WHERE user_id = ? AND timeline_type = ?"
        ).await?;

        let update_feed_meta_prepared = db().await.prepare(
            "UPDATE dataservices.user_timeline_meta SET \
            opt_last_fanned_in_at = ?, \
            opt_fanned_in_up_to = ?, \
            opt_explicit_fan_in_users = opt_explicit_fan_in_users + ?, \
            opt_explicit_fan_in_users = opt_explicit_fan_in_users - ?, \
            opt_exclude_users = opt_exclude_users + ?, \
            opt_exclude_users = opt_exclude_users - ? \
            WHERE user_id = ? AND timeline_type = ?
            "
        ).await?;

        let read_feed_prepared_no_before = db().await.prepare(
            "SELECT * FROM dataservices.user_timeline_entry WHERE user_id = ? AND timeline_type = ? LIMIT ?"
        ).await?;

        let read_feed_prepared_before = db().await.prepare(
            "SELECT * FROM dataservices.user_timeline_entry WHERE user_id = ? AND timeline_type = ? AND post_id < ? LIMIT ?"
        ).await?;


        let add_to_feed_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_timeline_entry (user_id, timeline_type, post_author_id, post_id, entry_type)\
            VALUES (?, ?, ?, ?, ?)"
        ).await?;

        Ok(Self {
            read_feed_meta_prepared,
            update_feed_meta_prepared,
            read_feed_prepared_before,
            read_feed_prepared_no_before,
            add_to_feed_prepared,
        })
    }
}


impl ScyllaFeedService {

    async fn _read_feed_meta_reuse(
        &self,
        user_id: CqlTimeuuid,
        timeline_type: i32,
    ) -> DSResult<FeedMetaResponse> {

        
        let meta = db().await.execute_unpaged(
            &self.read_feed_meta_prepared,
            (
                &user_id,
                timeline_type,
            )
        ).await?.into_rows_result()?.first_row::<UserTimelineMeta>()?;


        Ok(FeedMetaResponse {
            user_id: Some(meta.user_id.into()),
            timeline_type: meta.timeline_type,
            last_fanned_in_at: meta.opt_last_fanned_in_at,
            exclude_users: meta.opt_exclude_users
                .unwrap_or_default().into_iter().map(Into::into).collect(),
            explicit_fan_in_users: meta.opt_explicit_fan_in_users
                .unwrap_or_default().into_iter().map(Into::into).collect(),
            fanned_in_up_to: meta.opt_fanned_in_up_to.map(Into::into)
        })
    }

    async fn read_feed_meta_impl(
        &self,
        request: tonic::Request<ReadFeedMetaRequest>,
    ) -> DSResult<tonic::Response<FeedMetaResponse>> {
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;
        let timeline_type = request.get_ref().timeline_type;

        Ok(Response::new(self._read_feed_meta_reuse(user_id, timeline_type).await?))
    }

    async fn update_feed_meta_impl(
        &self,
        request: tonic::Request<UpdateFeedMetaRequest>,
    ) -> DSResult<
        tonic::Response<FeedMetaResponse>> {
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;
        let owned = request.into_inner();

        let timeline_type = owned.timeline_type;


        let last_fanned_in_at = MaybeUnset::from_option(owned.last_fanned_in_at);
        let fanned_in_up_to: MaybeUnset<CqlTimeuuid> = MaybeUnset::from_option(owned.fanned_in_up_to.map(Into::into));

        let exclude_to_remove: Vec<CqlTimeuuid> = owned.exclude_to_delete.into_iter().map(Into::into).collect();
        let exclude_to_add: Vec<CqlTimeuuid> = owned.exclude_to_add.into_iter().map(Into::into).collect();

        let explicit_to_remove: Vec<CqlTimeuuid> = owned.explicit_fan_in_to_delete.into_iter().map(Into::into).collect();
        let explicit_to_add: Vec<CqlTimeuuid> = owned.explicit_fan_in_to_add.into_iter().map(Into::into).collect();
   

        db().await.execute_unpaged(
            &self.update_feed_meta_prepared,
            (
                last_fanned_in_at,
                fanned_in_up_to,
                explicit_to_add,
                explicit_to_remove,
                exclude_to_add,
                exclude_to_remove,
                user_id,
                timeline_type,
            )
        ).await?;

        Ok(Response::new(self._read_feed_meta_reuse(user_id, timeline_type).await?))
    }

    async fn read_feed_impl(
        &self,
        request: tonic::Request<ReadFeedRequest>,
    ) -> DSResult<tonic::Response<FeedResponse>> {
        
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;
        let owned = request.into_inner();
        let timeline_type = owned.timeline_type;
        let maybe_before: Option<CqlTimeuuid> = owned.before.map(Into::into);
        let limit = owned.limit;


        let mut pager = match maybe_before {
            None => {
                db().await.execute_iter(
                    self.read_feed_prepared_no_before.clone(),
                    (
                        user_id,
                        timeline_type,
                        limit,
                    )
                ).await?.rows_stream::<UserTimelineEntry>()?
            },
            Some(before) => {
                db().await.execute_iter(
                    self.read_feed_prepared_before.clone(),
                    (
                        user_id,
                        timeline_type,
                        before,
                        limit
                    )
                ).await?.rows_stream::<UserTimelineEntry>()?
            }
        };


        let mut entries = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            entries.push(FeedEntry {
                post_author_id: Some(row.post_author_id.into()),
                post_id: Some(row.post_id.into()),
                entry_type: row.entry_type,
            });

        }

        Ok(Response::new(FeedResponse { entries }))
        

    }

    async fn add_to_feeds_impl(
        &self,
        request: tonic::Request<AddToFeedsRequest>,
    ) -> DSResult<
        tonic::Response<AddToFeedsResponse>> {
        todo!()
    }

    async fn remove_from_feed_impl(
        &self,
        request: tonic::Request<RemovePostsFromFeedRequest>,
    ) -> DSResult<
        tonic::Response<RemovePostsFromFeedResponse>> {
        todo!()
    }

    async fn add_posts_to_feed_impl(
        &self,
        request: tonic::Request<AddPostsToFeedRequest>,
    ) -> DSResult<
        tonic::Response<AddPostsToFeedResponse>> {
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;
        let owned = request.into_inner();
        let timeline_type = owned.timeline_type;
        let entry_type = owned.entry_type;


        let futures = owned.to_add.iter().map(async |entry: &PartialFeedEntry| {

            let post_id: CqlTimeuuid = entry.post_id?.into();
            let author_id: CqlTimeuuid = entry.author_id?.into();
            
            let res = db().await.execute_unpaged(
                &self.add_to_feed_prepared,
                (
                    user_id,
                    timeline_type,
                    author_id,
                    post_id,
                    entry_type,
                )
            ).await;

            if let Err(e) = res {
                tracing::error!("{e:?}");
            }
            Some(())
        });


        join_all(futures).await;

        Ok(Response::new(AddPostsToFeedResponse {  }))
    }
}



#[async_trait]
impl FeedService for ScyllaFeedService {
    async fn read_feed_meta(
        &self,
        request: tonic::Request<ReadFeedMetaRequest>,
    ) -> std::result::Result<
        tonic::Response<FeedMetaResponse>,
        tonic::Status,
    > {
        Ok(self.read_feed_meta_impl(request).await?)
    }
    async fn update_feed_meta(
        &self,
        request: tonic::Request<UpdateFeedMetaRequest>,
    ) -> std::result::Result<
        tonic::Response<FeedMetaResponse>,
        tonic::Status,
    > {
        Ok(self.update_feed_meta_impl(request).await?)
    }
    /// / Read a users feed
    async fn read_feed(
        &self,
        request: tonic::Request<ReadFeedRequest>,
    ) -> std::result::Result<tonic::Response<FeedResponse>, tonic::Status> {
        Ok(self.read_feed_impl(request).await?)
    }
    /// / Add a post to many feeds (fan out)
    async fn add_to_feeds(
        &self,
        request: tonic::Request<AddToFeedsRequest>,
    ) -> std::result::Result<
        tonic::Response<AddToFeedsResponse>,
        tonic::Status,
    > {
        Ok(self.add_to_feeds_impl(request).await?)
    }
    /// / Remove many posts from a users feed (fan in)
    async fn remove_from_feed(
        &self,
        request: tonic::Request<RemovePostsFromFeedRequest>,
    ) -> std::result::Result<
        tonic::Response<RemovePostsFromFeedResponse>,
        tonic::Status,
    > {
        Ok(self.remove_from_feed_impl(request).await?)
    }
    /// / Add posts to a feed (fan in)
    async fn add_posts_to_feed(
        &self,
        request: tonic::Request<AddPostsToFeedRequest>,
    ) -> std::result::Result<
        tonic::Response<AddPostsToFeedResponse>,
        tonic::Status,
    > {
        Ok(self.add_posts_to_feed_impl(request).await?)
    }
}