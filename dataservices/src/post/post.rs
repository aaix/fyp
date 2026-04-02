use futures::{StreamExt, future::join_all};
use scylla::{errors::FirstRowError, statement::prepared::PreparedStatement, value::{Counter, CqlTimeuuid, MaybeUnset}};
use tonic::{Response, Status, async_trait};

use crate::{db_conn::db, errors::DSResult, helpers::{gen_timeuuid, time_now}, maybe_opt_field, models::{post_num_counters::PostNumCounters, post_v2::PostV2}, protos::dataservices::post_service::{CreatePostRequest, DeletePostRequest, DeletePostResponse, ManyPostsResponse, PostResponse, ReadManyPostsRequest, ReadPostRequest, ReadUserDehydratedPostsRequest, ReadUserPostsRequest, UpdatePostRequest, UserDehydratedPostsResponse, UserPostsResponse, post_service_server::{PostService, PostServiceServer}}, req_tuuid};



fn post_to_post_response(post: PostV2, post_counters: Option<PostNumCounters>) -> PostResponse {

    let (post_comments, post_likes) = match post_counters {
        Some(counters) => (counters.post_comments.0, counters.post_likes.0),
        None => (0, 0)
    };

    PostResponse {
        post_id: Some(post.post_id.into()),
        author_id: Some(post.author_id.into()),
        asset_id: Some(post.asset_id.into()),
        post_type: post.post_type,
        body: post.opt_body,
        last_edited: post.opt_last_edited.map(|t| {t.0.into()}),
        num_comments: post_comments,
        num_likes: post_likes,
    }
}



#[derive(Debug)]
pub struct ScyllaPostService {
    create_post_prepared: PreparedStatement,
    read_post_prepared: PreparedStatement,
    read_post_num_counters_prepared: PreparedStatement,
    update_post_prepared: PreparedStatement,
    delete_post_prepared: PreparedStatement,
    read_user_posts_prepared_before: PreparedStatement,
    read_user_posts_prepared_no_before: PreparedStatement,
    delete_post_counters_prepared: PreparedStatement,
    read_user_posts_dehydrated_prepared_before: PreparedStatement,
    read_user_posts_dehydrated_prepared_no_before: PreparedStatement,
}

impl ScyllaPostService {
    
    pub async fn server() -> Option<PostServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating PostService server: {:?}", e);
            None
        } else {
            Some(PostServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaPostService, Box<dyn std::error::Error>> {

        let create_post_prepared = db().await.prepare(
            "INSERT INTO dataservices.post_v2 (post_id, timeline_type, author_id, asset_id, post_type, opt_body, is_private) \
            VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).await?;

        let read_post_prepared = db().await.prepare(
            "SELECT * FROM dataservices.post_v2 WHERE author_id = ? AND post_id = ? AND timeline_type = ?"
        ).await?;

        let read_post_num_counters_prepared = db().await.prepare(
            "SELECT * FROM dataservices.post_num_counters WHERE post_id = ?"
        ).await?;

        let update_post_prepared = db().await.prepare(
            "UPDATE dataservices.post_v2 SET opt_body = ?, is_private = ?, opt_last_edited = ? WHERE author_id = ? AND post_id = ? AND timeline_type = ?"
        ).await?;

        let delete_post_prepared = db().await.prepare(
            "DELETE FROM dataservices.post_v2 WHERE author_id = ? AND post_id = ? AND timeline_type = ?"
        ).await?;

        let delete_post_counters_prepared = db().await.prepare(
            "DELETE FROM dataservices.post_num_counters WHERE post_id = ?"
        ).await?;

        let read_user_posts_prepared_before = db().await.prepare(
            "SELECT * FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? AND post_id < ? LIMIT ?"
        ).await?;

        let read_user_posts_prepared_no_before = db().await.prepare(
            "SELECT * FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? LIMIT ?"
        ).await?;

        let read_user_posts_dehydrated_prepared_before = db().await.prepare(
            "SELECT post_id FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? AND post_id < ? LIMIT ?"
        ).await?;

        let read_user_posts_dehydrated_prepared_no_before = db().await.prepare(
            "SELECT post_id FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? LIMIT ?"
        ).await?;

        Ok(Self {
            create_post_prepared,
            read_post_prepared,
            read_post_num_counters_prepared,
            update_post_prepared,
            delete_post_prepared,
            read_user_posts_prepared_before,
            read_user_posts_prepared_no_before,
            delete_post_counters_prepared,
            read_user_posts_dehydrated_prepared_before,
            read_user_posts_dehydrated_prepared_no_before,
        })
    }
}

impl ScyllaPostService {

    async fn _read_post_reuse(
        &self,
        author_id: CqlTimeuuid,
        post_id: CqlTimeuuid,
        timeline_type: i32,
    ) -> DSResult<PostResponse> {

        let row = db().await.execute_unpaged(
            &self.read_post_prepared,
            (
                author_id,
                post_id,
                timeline_type,
            )
        ).await?.into_rows_result()?.first_row::<PostV2>()?;

        let counters = self._read_post_counters_reuse(post_id).await?;


        Ok(post_to_post_response(row, Some(counters)))

    }

    async fn _read_post_counters_reuse(&self, post_id: CqlTimeuuid) -> DSResult<PostNumCounters>{

        let row_res = db().await.execute_unpaged(
            &self.read_post_num_counters_prepared,
            (
                &post_id,
            )
        ).await?.into_rows_result()?.first_row::<PostNumCounters>();


        if let Err(e) = row_res {
            if let FirstRowError::RowsEmpty = e {
                Ok(PostNumCounters {post_id, post_comments: Counter(0), post_likes: Counter(0)})
            } else {
                return Err(e.into());
            }
        } else {
            Ok(row_res?)
        }
    }

    async fn create_post_impl(
        &self,
        request: tonic::Request<CreatePostRequest>,
    ) -> DSResult<tonic::Response<PostResponse>> {
        
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.into_inner();

        let post_id = gen_timeuuid();
        let asset_id = gen_timeuuid();

        let post_type = inner.post_type;
        let timeline_type = inner.timeline_type;
        let is_private = true;


        let body = MaybeUnset::from_option(inner.body.as_ref());

        db().await.execute_unpaged(
            &self.create_post_prepared,
            (
                &post_id,
                &timeline_type,
                &author_id,
                &asset_id,
                post_type,
                body,
                is_private,
            )
        ).await?;

        Ok(Response::new(PostResponse {
            post_id: Some(post_id.into()),
            author_id: inner.author_id,
            asset_id: Some(asset_id.into()),
            post_type: post_type,
            body: inner.body,
            last_edited: None,
            num_comments: 0,
            num_likes: 0,
        }))
    }

    async fn read_post_impl(
        &self,
        request: tonic::Request<ReadPostRequest>,
    ) -> std::result::Result<
        tonic::Response<PostResponse>,
        tonic::Status,
    > {
        let post_id: CqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let timeline_type = request.get_ref().timeline_type;


        Ok(Response::new(self._read_post_reuse(author_id, post_id, timeline_type).await?))

    }

    async fn update_post_impl(
        &self,
        request: tonic::Request<UpdatePostRequest>,
    ) -> DSResult<
        tonic::Response<PostResponse>> {
        
        let post_id = req_tuuid!(request, post_id)?;
        let author_id = req_tuuid!(request, author_id)?;

        let owned = request.into_inner();

        let timeline_type = owned.timeline_type;

        let map = owned.field_mask.ok_or(Status::invalid_argument("bad mask"))?;

        let body = maybe_opt_field!(owned, body, map);
        let is_private = MaybeUnset::from_option(owned.is_private);

        // if body then we set last edited
        let last_edited = if let MaybeUnset::Set(_) = body {
            MaybeUnset::Set(time_now())
        } else {
            MaybeUnset::Unset
        };

        db().await.execute_unpaged(
            &self.update_post_prepared,
            (
                body,
                is_private,
                &last_edited,
                &author_id,
                &post_id,
                &timeline_type,
            )
        ).await?;

        Ok(Response::new(self._read_post_reuse(author_id, post_id, timeline_type).await?))

    }

    async fn delete_post_impl(
        &self,
        request: tonic::Request<DeletePostRequest>,
    ) -> DSResult<
        tonic::Response<DeletePostResponse>> {
        
        let post_id: CqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let timeline_type = request.get_ref().timeline_type;


        db().await.execute_unpaged(
            &self.delete_post_counters_prepared,
            (&post_id,)
        ).await?;

        db().await.execute_unpaged(
            &self.delete_post_prepared,
            (
                &author_id,
                &post_id,
                &timeline_type,
            )
        ).await?;

        Ok(Response::new(DeletePostResponse {  }))
    }

    async fn read_many_posts_impl(
        &self,
        request: tonic::Request<ReadManyPostsRequest>,
    ) -> DSResult<
        tonic::Response<ManyPostsResponse>> {
        
        let futures = request.get_ref().requests.iter().map(async |r| {
            let author_id = r.author_id?.into();
            let post_id = r.post_id?.into();
            let timeline_type = r.timeline_type;
            let res = self._read_post_reuse(author_id, post_id, timeline_type).await;

            match res {
                Err(e) => {
                    tracing::error!("Error reading a post {e:?}");
                    None
                }
                Ok(r) => Some(r)
            }
        });

        let futures = join_all(futures).await;

        let responses = futures.into_iter().filter_map(|s| {s}).collect();


        Ok(Response::new(ManyPostsResponse { responses: responses }))
    }

    async fn read_user_posts_impl(
        &self,
        request: tonic::Request<ReadUserPostsRequest>,
    ) -> DSResult<
        tonic::Response<UserPostsResponse>> {
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.get_ref();

        let timeline_type = inner.timeline_type;

        let maybe_before: Option<CqlTimeuuid> = inner.before.map(Into::into);
        let limit = inner.limit;

        let pager = match maybe_before {
            Some(before) => {
                db().await.execute_iter(
                self.read_user_posts_prepared_before.clone(),
                    (
                        &author_id,
                        &timeline_type,
                        &before,
                        &limit,
                    )
                ).await?.rows_stream::<PostV2>()?
            }
            None => {
                db().await.execute_iter(
                self.read_user_posts_prepared_no_before.clone(),
                    (
                        &author_id,
                        &timeline_type,
                        &limit,
                    )
                ).await?.rows_stream::<PostV2>()?
            }
        };


        let mut posts = Vec::with_capacity(limit as usize);

        let size = limit.min(self.read_user_posts_prepared_before.get_page_size()) as usize;
        
        let mut with_counters = pager.map(async |row_res| {
            let row = row_res?;

            let post_counters = self._read_post_counters_reuse(row.post_id).await?;

            DSResult::Ok(post_to_post_response(row, Some(post_counters)))
        }).buffered(size);

        while let Some(post_res) = with_counters.next().await {
            let post = post_res?;

            posts.push(post);
        };

        Ok(Response::new(UserPostsResponse { posts }))

    }

    async fn read_dehydrated_user_posts_impl(
        &self,
        request: tonic::Request<ReadUserDehydratedPostsRequest>,
    ) -> DSResult<tonic::Response<UserDehydratedPostsResponse>> {
        

        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.get_ref();

        let timeline_type = inner.timeline_type;

        let maybe_before: Option<CqlTimeuuid> = inner.before.map(Into::into);
        let limit = inner.limit;

        let mut pager = match maybe_before {
            Some(before) => {
                db().await.execute_iter(
                self.read_user_posts_dehydrated_prepared_before.clone(),
                    (
                        &author_id,
                        &timeline_type,
                        &before,
                        &limit,
                    )
                ).await?.rows_stream::<(CqlTimeuuid,)>()?
            }
            None => {
                db().await.execute_iter(
                self.read_user_posts_dehydrated_prepared_no_before.clone(),
                    (
                        &author_id,
                        &timeline_type,
                        &limit,
                    )
                ).await?.rows_stream::<(CqlTimeuuid,)>()?
            }
        };

        let mut post_ids = Vec::with_capacity(limit as usize);

        while let Some(post_id_res) = pager.next().await {
            let post_id = post_id_res?;

            post_ids.push(post_id.0.into());

        }

        Ok(Response::new(UserDehydratedPostsResponse { post_ids }))
    }
}

#[async_trait]
impl PostService for ScyllaPostService {
    async fn create_post(
        &self,
        request: tonic::Request<CreatePostRequest>,
    ) -> std::result::Result<
        tonic::Response<PostResponse>,
        tonic::Status,
    > {
        Ok(self.create_post_impl(request).await?)
    }
    async fn read_post(
        &self,
        request: tonic::Request<ReadPostRequest>,
    ) -> std::result::Result<
        tonic::Response<PostResponse>,
        tonic::Status,
    > {
        Ok(self.read_post_impl(request).await?)
    }
    async fn update_post(
        &self,
        request: tonic::Request<UpdatePostRequest>,
    ) -> std::result::Result<
        tonic::Response<PostResponse>,
        tonic::Status,
    > {
        Ok(self.update_post_impl(request).await?)
    }
    async fn delete_post(
        &self,
        request: tonic::Request<DeletePostRequest>,
    ) -> std::result::Result<
        tonic::Response<DeletePostResponse>,
        tonic::Status,
    > {
        Ok(self.delete_post_impl(request).await?)
    }
    async fn read_many_posts(
        &self,
        request: tonic::Request<ReadManyPostsRequest>,
    ) -> std::result::Result<
        tonic::Response<ManyPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_many_posts_impl(request).await?)
    }
    async fn read_user_posts(
        &self,
        request: tonic::Request<ReadUserPostsRequest>,
    ) -> std::result::Result<
        tonic::Response<UserPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_user_posts_impl(request).await?)
    }

    async fn read_dehydrated_user_posts(
        &self,
        request: tonic::Request<ReadUserDehydratedPostsRequest>,
    ) -> std::result::Result<
        tonic::Response<UserDehydratedPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_dehydrated_user_posts_impl(request).await?)
    }
}