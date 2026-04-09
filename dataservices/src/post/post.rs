
use async_singleflight::UnaryGroup;
use futures::{StreamExt, future::join_all};
use scylla::{errors::FirstRowError, statement::prepared::PreparedStatement, value::{Counter, CqlTimestamp, MaybeUnset}};
use tonic::{Response, Status, async_trait};

use crate::{db_conn::db, errors::DSResult, helpers::{calc_bucket, gen_timeuuid, time_now}, maybe_opt_field, models::{post_like::LWTPostLike, post_num_counters::PostNumCounters, post_v2::PostV2}, protos::{dataservices::post_service::{post_service_server::{PostService, PostServiceServer}, *}, plib::AllignedCqlTimeuuid}, req_tuuid};

const POST_AFTER_FLOOR: i64 = 24 * 60 * 60 * 1000; // 1 day (in ms)


fn post_to_post_response(post: PostV2, post_counters: Option<PostNumCounters>, liked_by_me: Option<bool>) -> PostResponse {

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
        is_private: post.is_private,
        liked_by_me: liked_by_me,
        large: post.opt_large,
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
    like_post_prepared: PreparedStatement,
    unlike_post_prepared: PreparedStatement,
    update_post_counters: PreparedStatement,
    read_post_like_prepared: PreparedStatement,

    post_read_group: UnaryGroup<(AllignedCqlTimeuuid, AllignedCqlTimeuuid, i32), DSResult<PostResponse>>,
    post_counters_read_group: UnaryGroup<AllignedCqlTimeuuid, DSResult<PostNumCounters>>,
    user_posts_read_group: UnaryGroup<(AllignedCqlTimeuuid, i32, Option<AllignedCqlTimeuuid>, i32), DSResult<Vec<PostResponse>>>,
    user_dehydrated_posts_read_group: UnaryGroup<(AllignedCqlTimeuuid, i32, Option<AllignedCqlTimeuuid>, i32, i64), DSResult<DehydratedPosts>>
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
            "UPDATE dataservices.post_v2 SET opt_body = ?, is_private = ?, opt_last_edited = ?, opt_large = ? WHERE author_id = ? AND post_id = ? AND timeline_type = ?"
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
            "SELECT post_id FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? AND post_id < ? AND post_id > minTimeuuid(?) LIMIT ?"
        ).await?;

        let read_user_posts_dehydrated_prepared_no_before = db().await.prepare(
            "SELECT post_id FROM dataservices.post_v2 WHERE author_id = ? AND timeline_type = ? AND post_id >= minTimeuuid(?) LIMIT ?"
        ).await?;

        
        let like_post_prepared = db().await.prepare(
            "INSERT INTO dataservices.post_like (post_id, bucket, liker_id) VALUES (?, ?, ?) IF NOT EXISTS"
        ).await?;

        let unlike_post_prepared = db().await.prepare(
            "DELETE FROM dataservices.post_like WHERE post_id = ? AND bucket = ? AND liker_id = ? IF EXISTS"
        ).await?;

        let update_post_counters = db().await.prepare(
            "UPDATE dataservices.post_num_counters SET post_likes = post_likes + ?, post_comments = post_comments + ? \
            WHERE post_id = ?"
        ).await?;

        let read_post_like_prepared = db().await.prepare(
            "SELECT * FROM dataservices.post_like WHERE post_id = ? AND bucket = ? AND liker_id = ?"
        ).await?;

        let post_read_group = UnaryGroup::new();
        let post_counters_read_group = UnaryGroup::new();
        let user_posts_read_group = UnaryGroup::new();
        let user_dehydrated_posts_read_group = UnaryGroup::new();

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

            unlike_post_prepared,
            like_post_prepared,
            update_post_counters,
            read_post_like_prepared,

            post_read_group,
            post_counters_read_group,
            user_posts_read_group,
            user_dehydrated_posts_read_group,
        })
    }
}

impl ScyllaPostService {

    async fn _read_post_reuse(
        &self,
        author_id: AllignedCqlTimeuuid,
        post_id: AllignedCqlTimeuuid,
        timeline_type: i32,
        maybe_liked_by: Option<AllignedCqlTimeuuid>,
    ) -> DSResult<PostResponse> {

        let key = &(author_id, post_id, timeline_type);
        let read_post = self.post_read_group.work(
            key,
            self._read_post_reuse_nocoalesce(author_id, post_id, timeline_type)
        );

        let (post_res, like) = match maybe_liked_by {
            Some(liked_by) => {
                let (post, liked_res) = tokio::join!(read_post, self._read_post_liked_by(post_id, liked_by));

                if let Err(ref e) = liked_res {
                    tracing::error!("Error fetching like {e:?}");
                }

                (post, liked_res.ok())
            },
            None => (read_post.await, None)
        };

        let mut post = post_res?;
        post.liked_by_me = like;
        Ok(post)
    }

    async fn _read_post_reuse_nocoalesce(
        &self,
        author_id: AllignedCqlTimeuuid,
        post_id: AllignedCqlTimeuuid,
        timeline_type: i32,
    ) -> DSResult<PostResponse> {

        let read_post = db().await.execute_unpaged(
            &self.read_post_prepared,
            (
                author_id,
                post_id,
                timeline_type,
            )
        );

        let read_counters  = self._read_post_counters_reuse_nocoalesce(post_id);

        let (post, counters) = tokio::join!(read_post, read_counters);

        let row = post?.into_rows_result()?.first_row::<PostV2>()?;

        Ok(post_to_post_response(row, Some(counters?), None))

    }

    async fn _read_post_counters_reuse(&self, post_id: AllignedCqlTimeuuid) -> DSResult<PostNumCounters>{
        self.post_counters_read_group.work(
            &post_id,
            self._read_post_counters_reuse_nocoalesce(post_id)
        ).await
    }

    async fn _read_post_counters_reuse_nocoalesce(&self, post_id: AllignedCqlTimeuuid) -> DSResult<PostNumCounters> {

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
        
        let author_id: AllignedCqlTimeuuid = req_tuuid!(request, author_id)?;
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
            is_private,
            liked_by_me: Some(false),
            large: None,
        }))
    }

    async fn read_post_impl(
        &self,
        request: tonic::Request<ReadPostRequest>,
    ) -> std::result::Result<
        tonic::Response<PostResponse>,
        tonic::Status,
    > {
        let post_id: AllignedCqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: AllignedCqlTimeuuid = req_tuuid!(request, author_id)?;
        let timeline_type = request.get_ref().timeline_type;
        let liked_by = request.get_ref().liked_by.map(Into::into);



        Ok(Response::new(self._read_post_reuse(author_id, post_id, timeline_type, liked_by).await?))

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

        let large = MaybeUnset::from_option(owned.large);

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
                large,
                &author_id,
                &post_id,
                &timeline_type,
            )
        ).await?;

        Ok(Response::new(self._read_post_reuse(author_id, post_id, timeline_type, None).await?))

    }

    async fn delete_post_impl(
        &self,
        request: tonic::Request<DeletePostRequest>,
    ) -> DSResult<
        tonic::Response<DeletePostResponse>> {
        
        let post_id: AllignedCqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: AllignedCqlTimeuuid = req_tuuid!(request, author_id)?;
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

        let maybe_liked_by: Option<AllignedCqlTimeuuid> = request.get_ref().liked_by.map(Into::into);
        let timeline_type = request.get_ref().timeline_type;
        
        let futures = request.get_ref().requests.iter().map(async |r| {
            let author_id = r.author_id?.into();
            let post_id = r.post_id?.into();
    
            let post_res = self._read_post_reuse(
                author_id, post_id, timeline_type, maybe_liked_by
            ).await;

            if let Err(ref e) = post_res {
                tracing::error!("Error reading post {e:?}");
            }

            post_res.ok()

        });

        let futures = join_all(futures).await;

        let responses = futures.into_iter().filter_map(|s| {s}).collect();


        Ok(Response::new(ManyPostsResponse { responses: responses }))
    }

    async fn _read_user_posts_nocoalesce(
        &self,
        author_id: AllignedCqlTimeuuid,
        timeline_type: i32,
        maybe_before: &Option<AllignedCqlTimeuuid>,
        limit: i32
    ) -> DSResult<Vec<PostResponse>> {
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

            DSResult::Ok(post_to_post_response(row, Some(post_counters), None))
        }).buffered(size);

        while let Some(post_res) = with_counters.next().await {
            let post = post_res?;

            posts.push(post);
        };

        Ok(posts)
    }


    async fn read_user_posts_impl(
        &self,
        request: tonic::Request<ReadUserPostsRequest>,
    ) -> DSResult<
        tonic::Response<UserPostsResponse>> {
        let author_id: AllignedCqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.get_ref();

        let timeline_type = inner.timeline_type;

        let maybe_before: Option<AllignedCqlTimeuuid> = inner.before.map(Into::into);
        let limit = inner.limit;

        let posts = self.user_posts_read_group.work(
            &(author_id, timeline_type, maybe_before, limit),
            self._read_user_posts_nocoalesce(author_id, timeline_type, &maybe_before, limit)
        ).await?;

        Ok(Response::new(UserPostsResponse { posts }))

    }

    async fn _read_user_dehydrated_posts_nocoalesce(
        &self,
        author_id: AllignedCqlTimeuuid,
        timeline_type: i32,
        maybe_before: &Option<AllignedCqlTimeuuid>,
        limit: i32,
        after: i64,

    ) -> DSResult<DehydratedPosts> {

        let after_time = CqlTimestamp(after);

        let mut pager = match maybe_before {
            Some(before) => {
                db().await.execute_iter(
                self.read_user_posts_dehydrated_prepared_before.clone(),
                    (
                        &author_id,
                        timeline_type,
                        &before,
                        after_time,
                        limit,
                    )
                ).await?.rows_stream::<(AllignedCqlTimeuuid,)>()?
            }
            None => {
                db().await.execute_iter(
                self.read_user_posts_dehydrated_prepared_no_before.clone(),
                    (
                        &author_id,
                        timeline_type,
                        after_time,
                        limit,
                    )
                ).await?.rows_stream::<(AllignedCqlTimeuuid,)>()?
            }
        };

        let mut post_ids = Vec::with_capacity(limit as usize);

        while let Some(post_id_res) = pager.next().await {
            let post_id = post_id_res?;

            post_ids.push(post_id.0.into());

        }
        
        Ok(DehydratedPosts { user_id: Some(author_id.into()), post_ids})
    }

    async fn read_users_dehydrated_posts_impl(
        &self,
        request: tonic::Request<ReadUsersDehydratedPostsRequest>,
    ) -> DSResult<tonic::Response<UsersDehydratedPostsResponse>> {
        
        let inner = request.get_ref();

        let timeline_type = inner.timeline_type;

        let maybe_before: Option<AllignedCqlTimeuuid> = inner.before.map(Into::into);
        let limit = inner.limit;

        // we round post after down for more efficient request coalescing
        let after = inner.after - (inner.after % POST_AFTER_FLOOR);

        let futures = inner.author_ids.iter().map(async |author_id| {
            let author_id = author_id.into();
            self.user_dehydrated_posts_read_group.work(
                &(author_id, timeline_type, maybe_before, limit, after),
                self._read_user_dehydrated_posts_nocoalesce(author_id, timeline_type, &maybe_before, limit, after)
            ).await
            
        });

        let posts = join_all(futures).await.into_iter().filter_map(|r| {
            match r {
                Err(e) => {
                    tracing::error!("{e:?}");
                    None
                },
                Ok(posts) => Some(posts)
            }
        }).collect();



        Ok(Response::new(UsersDehydratedPostsResponse { posts }))
    }

    async fn _read_post_liked_by(
        &self,
        post_id: AllignedCqlTimeuuid, liked_by: AllignedCqlTimeuuid
    ) -> DSResult<bool> {

        let bucket = calc_bucket(liked_by);

        let is_liked = db().await.execute_unpaged(
            &self.read_post_like_prepared, 
            (
                post_id,
                bucket,
                liked_by
            )
        ).await?.into_rows_result()?.rows_num() > 0;

        Ok(is_liked)
    }


    async fn like_post_impl(
        &self,
        request: tonic::Request<LikePostRequest>,
    ) -> DSResult<
        tonic::Response<LikePostResponse>> {

        let post_id: AllignedCqlTimeuuid = req_tuuid!(request, post_id)?;
        let liker_id: AllignedCqlTimeuuid = req_tuuid!(request, liker_id)?;
        let bucket = calc_bucket(liker_id);

        let res = db().await.execute_unpaged(
            &self.like_post_prepared,
            (
                post_id,
                bucket,
                liker_id
            )
        ).await?.into_rows_result()?.first_row::<LWTPostLike>()?;

        if !res.applied {
            return Err(Status::invalid_argument("Post already liked").into())
        }

        db().await.execute_unpaged(
            &self.update_post_counters,
            (
                Counter(1),
                Counter(0),
                post_id
            )
        ).await?;


        Ok(Response::new(LikePostResponse {  }))
    }
    async fn unlike_post_impl(
        &self,
        request: tonic::Request<LikePostRequest>,
    ) -> DSResult<
        tonic::Response<LikePostResponse>> {
        let post_id: AllignedCqlTimeuuid = req_tuuid!(request, post_id)?;
        let liker_id: AllignedCqlTimeuuid = req_tuuid!(request, liker_id)?;
        let bucket = calc_bucket(liker_id);

        let res = db().await.execute_unpaged(
            &self.unlike_post_prepared,
            (
                post_id,
                bucket,
                liker_id
            )
        ).await?.into_rows_result()?.first_row::<LWTPostLike>()?;

        if !res.applied {
            return Err(Status::invalid_argument("Post was not liked").into())
        }

        db().await.execute_unpaged(
            &self.update_post_counters,
            (
                Counter(-1),
                Counter(0),
                post_id
            )
        ).await?;


        Ok(Response::new(LikePostResponse {  }))
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
    async fn read_users_dehydrated_posts(
        &self,
        request: tonic::Request<ReadUsersDehydratedPostsRequest>,
    ) -> std::result::Result<
        tonic::Response<UsersDehydratedPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_users_dehydrated_posts_impl(request).await?)
    }
    async fn like_post(
        &self,
        request: tonic::Request<LikePostRequest>,
    ) -> std::result::Result<
        tonic::Response<LikePostResponse>,
        tonic::Status,
    > {
        Ok(self.like_post_impl(request).await?)
    }
    async fn unlike_post(
        &self,
        request: tonic::Request<LikePostRequest>,
    ) -> std::result::Result<
        tonic::Response<LikePostResponse>,
        tonic::Status,
    > {
        Ok(self.unlike_post_impl(request).await?)
    }
}