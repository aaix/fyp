use futures::{StreamExt, future::join_all};
use scylla::{errors::FirstRowError, statement::prepared::PreparedStatement, value::{Counter, CqlTimeuuid, MaybeUnset}};
use tonic::{Response, Status, async_trait};

use crate::{db_conn::db, errors::DSResult, helpers::gen_timeuuid, maybe_opt_field, models::{post::Post, post_num_counters::PostNumCounters}, protos::dataservices::post_service::{CreatePostRequest, DeletePostRequest, DeletePostResponse, ReadManyPostsRequest, ReadManyPostsResponse, ReadPostRequest, ReadPostResponse, ReadUserPostsRequest, ReadUserPostsResponse, UpdatePostRequest, post_service_server::{PostService, PostServiceServer}}, req_tuuid};


const POST_TYPE_PRIVATE: i32 = 0;



fn post_to_post_response(post: Post, post_counters: Option<PostNumCounters>) -> ReadPostResponse {

    let (post_comments, post_likes) = match post_counters {
        Some(counters) => (counters.post_comments.0, counters.post_likes.0),
        None => (0, 0)
    };

    ReadPostResponse {
        post_id: Some(post.post_id.into()),
        author_id: Some(post.author_id.into()),
        asset_id: Some(post.asset_id.into()),
        post_type: post.post_type,
        content_type: post.content_type,
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
}

impl ScyllaPostService {
    
    pub async fn server() -> Option<PostServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating UserService server: {:?}", e);
            None
        } else {
            Some(PostServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaPostService, Box<dyn std::error::Error>> {

        let create_post_prepared = db().await.prepare(
            "INSERT INTO dataservices.post (post_id, author_id, asset_id, post_type, content_type, opt_body) \
            VALUES (?, ?, ?, ?, ?, ?)"
        ).await?;

        let read_post_prepared = db().await.prepare(
            "SELECT * FROM dataservices.post WHERE author_id = ? AND post_id = ?"
        ).await?;

        let read_post_num_counters_prepared = db().await.prepare(
            "SELECT * FROM dataservices.post_num_counters WHERE post_id = ?"
        ).await?;

        let update_post_prepared = db().await.prepare(
            "UPDATE dataservices.post SET opt_body = ?, post_type = ? WHERE author_id = ? AND post_id = ?"
        ).await?;

        let delete_post_prepared = db().await.prepare(
            "DELETE FROM dataservices.post WHERE author_id = ? AND post_id = ?"
        ).await?;

        let delete_post_counters_prepared = db().await.prepare(
            "DELETE FROM dataservices.post_num_counters WHERE post_id = ?"
        ).await?;

        let read_user_posts_prepared_before = db().await.prepare(
            "SELECT * FROM dataservices.post WHERE author_id = ? AND post_id < ? LIMIT ?"
        ).await?;

        let read_user_posts_prepared_no_before = db().await.prepare(
            "SELECT * FROM dataservices.post WHERE author_id = ? LIMIT ?"
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
        })
    }
}

impl ScyllaPostService {

    async fn _read_post_reuse(
        &self,
        author_id: CqlTimeuuid,
        post_id: CqlTimeuuid,
    ) -> DSResult<ReadPostResponse> {

        let row = db().await.execute_unpaged(
            &self.read_post_prepared,
            (
                author_id,
                post_id
            )
        ).await?.into_rows_result()?.first_row::<Post>()?;

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
    ) -> DSResult<tonic::Response<ReadPostResponse>> {
        
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.into_inner();

        let post_id = gen_timeuuid();
        let asset_id = gen_timeuuid();

        let post_type = POST_TYPE_PRIVATE;

        let content_type = inner.content_type;

        let body = MaybeUnset::from_option(inner.body.as_ref());

        db().await.execute_unpaged(
            &self.create_post_prepared,
            (
                &post_id,
                &author_id,
                &asset_id,
                post_type,
                &content_type,
                body,
            )
        ).await?;

        Ok(Response::new(ReadPostResponse {
            post_id: Some(post_id.into()),
            author_id: inner.author_id,
            asset_id: Some(asset_id.into()),
            post_type: post_type,
            content_type: content_type,
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
        tonic::Response<ReadPostResponse>,
        tonic::Status,
    > {
        let post_id: CqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;


        Ok(Response::new(self._read_post_reuse(author_id, post_id).await?))

    }

    async fn update_post_impl(
        &self,
        request: tonic::Request<UpdatePostRequest>,
    ) -> DSResult<
        tonic::Response<ReadPostResponse>> {
        
        let post_id = req_tuuid!(request, post_id)?;
        let author_id = req_tuuid!(request, author_id)?;

        let owned = request.into_inner();
        let map = owned.field_mask.ok_or(Status::invalid_argument("bad mask"))?;

        let body = maybe_opt_field!(owned, body, map);
        let post_type = MaybeUnset::from_option(owned.post_type);

        db().await.execute_unpaged(
            &self.update_post_prepared,
            (
                body,
                post_type,
            &author_id,
                &post_id,
            )
        ).await?;

        Ok(Response::new(self._read_post_reuse(author_id, post_id).await?))

    }

    async fn delete_post_impl(
        &self,
        request: tonic::Request<DeletePostRequest>,
    ) -> DSResult<
        tonic::Response<DeletePostResponse>> {
        
        let post_id: CqlTimeuuid = req_tuuid!(request, post_id)?;
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;


        db().await.execute_unpaged(
            &self.delete_post_counters_prepared,
            (&post_id,)
        ).await?;

        db().await.execute_unpaged(
            &self.delete_post_prepared,
            (
                &author_id,
                &post_id,
            )
        ).await?;

        Ok(Response::new(DeletePostResponse {  }))
    }

    async fn read_many_posts_impl(
        &self,
        request: tonic::Request<ReadManyPostsRequest>,
    ) -> DSResult<
        tonic::Response<ReadManyPostsResponse>> {
        
        let futures = request.get_ref().requests.iter().map(async |r| {
            let author_id = r.author_id?.into();
            let post_id = r.post_id?.into();
            let res = self._read_post_reuse(author_id, post_id).await;

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


        Ok(Response::new(ReadManyPostsResponse { responses: responses }))
    }

    async fn read_user_posts_impl(
        &self,
        request: tonic::Request<ReadUserPostsRequest>,
    ) -> DSResult<
        tonic::Response<ReadUserPostsResponse>> {
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        let inner = request.get_ref();

        let maybe_before: Option<CqlTimeuuid> = inner.before.map(Into::into);
        let limit = inner.limit;

        let pager = match maybe_before {
            Some(before) => {
                db().await.execute_iter(
                self.read_user_posts_prepared_before.clone(),
                    (
                        &author_id,
                        &before,
                        &limit,
                    )
                ).await?.rows_stream::<Post>()?
            }
            None => {
                db().await.execute_iter(
                self.read_user_posts_prepared_no_before.clone(),
                    (
                        &author_id,
                        &limit,
                    )
                ).await?.rows_stream::<Post>()?
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

        Ok(Response::new(ReadUserPostsResponse { posts }))

    }
}

#[async_trait]
impl PostService for ScyllaPostService {
    async fn create_post(
        &self,
        request: tonic::Request<CreatePostRequest>,
    ) -> std::result::Result<
        tonic::Response<ReadPostResponse>,
        tonic::Status,
    > {
        Ok(self.create_post_impl(request).await?)
    }
    async fn read_post(
        &self,
        request: tonic::Request<ReadPostRequest>,
    ) -> std::result::Result<
        tonic::Response<ReadPostResponse>,
        tonic::Status,
    > {
        Ok(self.read_post_impl(request).await?)
    }
    async fn update_post(
        &self,
        request: tonic::Request<UpdatePostRequest>,
    ) -> std::result::Result<
        tonic::Response<ReadPostResponse>,
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
        tonic::Response<ReadManyPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_many_posts_impl(request).await?)
    }
    async fn read_user_posts(
        &self,
        request: tonic::Request<ReadUserPostsRequest>,
    ) -> std::result::Result<
        tonic::Response<ReadUserPostsResponse>,
        tonic::Status,
    > {
        Ok(self.read_user_posts_impl(request).await?)
    }
}