use crate::{db_conn::db, errors::DSResult, helpers::time_now, models::{relationship_v2::RelationshipV2, user_num_relationships::UserNumRelationships}, protos::{dataservices::user_service::{self, CreateRelationshipRequest, DeleteRelationshipResponse, GetUserRelationshipCountsRequest, GetUserRelationshipCountsResponse, HalfRelationship, ReadRelationshipRequest, ReadRelationshipResponse, ReadRelationshipsChunkedRequest, ReadRelationshipsRequest, RelationshipObject, RelationshipTestResponse, RelationshipsResponse, TestManyRelationshipsRequest, TestManyRelationshipsResponse}, plib::AllignedCqlTimeuuid}, req_tuuid};

use async_singleflight::UnaryGroup;
use futures::{StreamExt, future::join_all};
use scylla::{errors::FirstRowError, statement::prepared::PreparedStatement, value::{Counter}};
use tonic::{Request, Response, Status, async_trait};
use user_service::user_relationship_service_server::{UserRelationshipService, UserRelationshipServiceServer};


const REL_TYPE_FRIENDS: i32 = 3;
const REL_TYPE_A_FOLLOWING_B: i32 = 7;
const REL_TYPE_B_FOLLOWING_A: i32 = 8;



pub struct ScyllaUserRelationshipService {
    create_relationship_prepared: PreparedStatement,
    modify_relationship_counters_prepared: PreparedStatement,
    read_relationship_prepared: PreparedStatement,
    read_relationships_prepared: PreparedStatement,
    delete_relationship_prepared: PreparedStatement,
    test_relationship_prepared: PreparedStatement,
    read_relationship_counters_prepared: PreparedStatement,
    read_relationships_chunked_prepared: PreparedStatement,

    relationships_counters_read_group: UnaryGroup<AllignedCqlTimeuuid, DSResult<GetUserRelationshipCountsResponse>>
}


impl ScyllaUserRelationshipService {
    pub async fn server() -> Option<UserRelationshipServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating UserRelationshipService server: {:?}", e);
            None
        } else {
            Some(UserRelationshipServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {

        let create_relationship_prepared = db().await.prepare(
            "BEGIN BATCH
            INSERT INTO dataservices.relationship_v2 (user_id_a, user_id_b, created_at, relationship_type)
            VALUES (?, ?, ?, ?);
            INSERT INTO dataservices.relationship_v2 (user_id_a, user_id_b, created_at, relationship_type)
            VALUES (?, ?, ?, ?);
            APPLY BATCH"
        ).await?;

        let modify_relationship_counters_prepared = db().await.prepare(
            "
            UPDATE dataservices.user_num_relationships \
            SET num_friends = num_friends + ?, num_followers = num_followers + ?, opt_num_following = opt_num_following + ? \
            WHERE user_id = ?;"
        ).await?;



        let read_relationship_counters_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_num_relationships WHERE user_id = ?"
        ).await?;

        let read_relationship_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship_v2 WHERE user_id_a = ? AND user_id_b = ? AND relationship_type IN ?"
        ).await?;

        let read_relationships_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship_v2 WHERE user_id_a = ? AND relationship_type = ? LIMIT 1000"
        ).await?;

        let delete_relationship_prepared = db().await.prepare(
            "BEGIN BATCH
            DELETE FROM dataservices.relationship_v2 WHERE user_id_a = ? AND user_id_b = ? AND relationship_type = ?;
            DELETE FROM dataservices.relationship_v2 WHERE user_id_a = ? AND user_id_b = ? AND relationship_type = ?;
            APPLY BATCH"
        ).await?;
        
        let test_relationship_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship_v2 WHERE user_id_a = ? AND user_id_b = ? AND relationship_type = ?"
        ).await?;

        let read_relationships_chunked_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship_v2 WHERE user_id_a = ? AND (relationship_type, user_id_b) > (?, ?) LIMIT ?"
        ).await?;

        Ok(Self {
            create_relationship_prepared, 
            modify_relationship_counters_prepared,
            read_relationship_prepared,
            read_relationships_prepared,
            delete_relationship_prepared,
            test_relationship_prepared,
            read_relationship_counters_prepared,
            read_relationships_chunked_prepared,

            relationships_counters_read_group: UnaryGroup::new(),
        })
    }
}

impl ScyllaUserRelationshipService {
    async fn create_relationship_impl(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> DSResult<Response<RelationshipObject>> {
        let user_a_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let created_at = time_now();
        let inner = request.get_ref();

        let a_to_b_type = inner.a_to_b_type;
        let b_to_a_type = inner.b_to_a_type;


        match (a_to_b_type, b_to_a_type) {
            // creating friendship
            (REL_TYPE_FRIENDS,REL_TYPE_FRIENDS ) => {
                
                let (a, b) = tokio::join!(
                    // increment a
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(1), Counter(0), Counter(0), &user_a_id,),
                    ),
                    // increment b
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(1), Counter(0), Counter(0), &user_b_id,),
                    )
                );
                if a.is_err() {
                    tracing::error!("error updating counter a {a:?}");
                }
                if b.is_err() {
                    tracing::error!("error updating counter b {b:?}");
                }
                if a.is_err() && b.is_err() {
                    b?;
                }
                
            },
            // a is following b
            (REL_TYPE_A_FOLLOWING_B, REL_TYPE_B_FOLLOWING_A) => {
                let (a, b) = tokio::join!(
                    // a now following more
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(0), Counter(0), Counter(1), &user_a_id,),
                    ),
                    // b now has more followers
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(0), Counter(1), Counter(0), &user_b_id,),
                    )
                );
                if a.is_err() {
                    tracing::error!("error updating counter a {a:?}");
                }
                if b.is_err() {
                    tracing::error!("error updating counter b {b:?}");
                }
                if a.is_err() && b.is_err() {
                    b?;
                }
            },
            // default
            _ => {}
        }

        db().await.execute_unpaged(
            &self.create_relationship_prepared,
            (
                &user_a_id,
                &user_b_id,
                &created_at,
                &a_to_b_type,
                &user_b_id,
                &user_a_id,
                &created_at,
                &b_to_a_type,
            ),
        )
        .await?;


        Ok(Response::new(RelationshipObject {
            user_id_a: Some(user_a_id.into()),
            user_id_b: Some(user_b_id.into()),
            created_at: created_at.0,
            relationship_type: a_to_b_type,
        }))
    }

    async fn read_relationship_impl(
        &self,
        request: Request<ReadRelationshipRequest>,
    ) -> DSResult<Response<ReadRelationshipResponse>> {
        let user_a: AllignedCqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b: AllignedCqlTimeuuid = req_tuuid!(request, user_id_b)?;

        let r_types = &request.get_ref().relationship_types;

        let mut pager = db().await.execute_iter(
            self.read_relationship_prepared.clone(),
            (&user_a, &user_b, &r_types)
        ).await?.rows_stream::<RelationshipV2>()?;

        let mut out = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            out.push(RelationshipObject {
                user_id_a: Some(row.user_id_a.into()),
                user_id_b: Some(row.user_id_b.into()),
                relationship_type: row.relationship_type,
                created_at: row.created_at.0,
            })

        }

        Ok(Response::new(ReadRelationshipResponse { relationships: out }))
    }

    async fn delete_relationship_impl(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> DSResult<Response<DeleteRelationshipResponse>> {
        let user_a_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let inner = request.get_ref();
        let a_to_b_type = inner.a_to_b_type;
        let b_to_a_type = inner.b_to_a_type;

        match (a_to_b_type, b_to_a_type) {
            // creating friendship
            (REL_TYPE_FRIENDS, REL_TYPE_FRIENDS ) => {
                let (a, b) = tokio::join!(
                    // decrement a
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(-1), Counter(0), Counter(0), &user_a_id,),
                    ),
                    // decrement b
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(-1), Counter(0), Counter(0), &user_b_id,),
                    )
                );
                if a.is_err() {
                    tracing::error!("error updating counter a {a:?}");
                }
                if b.is_err() {
                    tracing::error!("error updating counter b {b:?}");
                }
                if a.is_err() && b.is_err() {
                    b?;
                }            
            },
            // a is following b
            (REL_TYPE_A_FOLLOWING_B, REL_TYPE_B_FOLLOWING_A) => {
                let (a, b) = tokio::join!(
                    // a now following less
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(0), Counter(0), Counter(-1), &user_a_id,),
                    ),
                    // b now has less followers
                    db().await.execute_unpaged(
                        &self.modify_relationship_counters_prepared,
                        (Counter(0), Counter(-1), Counter(0), &user_b_id,),
                    )
                );
                if a.is_err() {
                    tracing::error!("error updating counter a {a:?}");
                }
                if b.is_err() {
                    tracing::error!("error updating counter b {b:?}");
                }
                if a.is_err() && b.is_err() {
                    b?;
                }
            },
            // default
            _ => {}
        }
            
        db().await.execute_unpaged(
            &self.delete_relationship_prepared,
            (
                &user_a_id,
                &user_b_id,
                &a_to_b_type,
                &user_b_id,
                &user_a_id,
                &b_to_a_type,
            ),
        )
        .await?;
            
        



        Ok(Response::new(DeleteRelationshipResponse {}))
    }

    async fn test_relationship_impl(
        &self,
        request: Request<RelationshipObject>,
    ) -> DSResult<Response<RelationshipTestResponse>> {
        let user_a: AllignedCqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b: AllignedCqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let inner = request.get_ref();
        let relationship_type = inner.relationship_type;

        let rows = db().await.execute_unpaged(
            &self.test_relationship_prepared,
            (&user_a, &user_b, &relationship_type)
        ).await?.into_rows_result()?;

        let exists = rows.rows_num() > 0;

        

        Ok(Response::new(RelationshipTestResponse {exists}))
    }

    async fn test_many_relationships_impl(
        &self,
        request: tonic::Request<TestManyRelationshipsRequest>,
    ) -> DSResult<tonic::Response<TestManyRelationshipsResponse>> {
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;

        let futures = request.get_ref().tests.iter().map(async |t| {

            let user_b = t.user_id_b.ok_or(Status::invalid_argument("missing user_id in request"))?;
            let relationship_type = t.relationship_type;

            let rows = db().await.execute_unpaged(
                &self.test_relationship_prepared,
                (&user_id, &Into::<AllignedCqlTimeuuid>::into(user_b), &relationship_type)
            ).await?.into_rows_result()?;

            let exists: DSResult<bool> = Ok(rows.rows_num() > 0);
            exists
        });


        // it is important we return an error so that the api can distinguish
        // relationship doesnt exist vs error
        let mut exist: i32 = 0;
        let mut errors: i32 = 0;

        for r in join_all(futures).await {
            match r {
                Ok(b) => {if b {exist += 1}},
                Err(_e) => { errors += 1 },
            }
        }

        Ok(Response::new(TestManyRelationshipsResponse {
            exist,
            errors
        }))
    }


    async fn read_relationships_impl(
        &self,
        request: Request<ReadRelationshipsRequest>,
    ) -> DSResult<Response<RelationshipsResponse>> {
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;

        let r_type = request.get_ref().relationship_type;

        let mut pager = db().await.execute_iter(
            self.read_relationships_prepared.clone(),
            (user_id, r_type)
        ).await?.rows_stream::<RelationshipV2>()?;


        let mut relationships = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;
            relationships.push(HalfRelationship {
                user_id_b: Some(row.user_id_b.into()),
                created_at: row.created_at.0,
            })
        }


        Ok(Response::new(RelationshipsResponse { relationships }))
    }

    async fn _get_user_relationship_counts_no_coalesce(
        &self,
        user_id: AllignedCqlTimeuuid,
    ) -> DSResult<GetUserRelationshipCountsResponse>{
        let row_res = db().await.execute_unpaged(
            &self.read_relationship_counters_prepared, 
        &(
            user_id,
            )
        ).await?.into_rows_result()?.first_row::<UserNumRelationships>();


        // in case of no row we can default to 0
        let (num_friends, num_followers, num_following) = match row_res {
            Err(e) => {
                if let FirstRowError::RowsEmpty = e {
                    (0, 0, 0)
                } else {
                    return Err(e.into());
                }
            }
            Ok(r) => {
                (r.num_friends.0, r.num_followers.0, r.opt_num_following.map(|v| v.0).unwrap_or_default())
            }
        };

        Ok(GetUserRelationshipCountsResponse {
            user_id: Some(user_id.into()),
            num_friends,
            num_followers,
            num_following,
        })
    }

    async fn get_user_relationship_counts_impl(
        &self,
        request: tonic::Request<GetUserRelationshipCountsRequest>,
    ) -> DSResult<
        tonic::Response<GetUserRelationshipCountsResponse>> {
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        

        let r = self.relationships_counters_read_group.work(
            &user_id,
            self._get_user_relationship_counts_no_coalesce(user_id)
        ).await?;



        Ok(Response::new(r))
    }

    async fn read_relationships_chunked_impl(
        &self,
        request: tonic::Request<ReadRelationshipsChunkedRequest>,
    ) -> DSResult<
    tonic::Response<RelationshipsResponse>> {

        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        let inner = request.get_ref();
        let rel_type = inner.relationship_type;
        let chunk_size = inner.chunk_size;

        let after = match inner.after {
            Some(v) => v.into(),
            None => AllignedCqlTimeuuid::from(*uuid::Builder::nil().with_version(uuid::Version::Mac).as_uuid()),
        };

        let mut pager = db().await.execute_iter(
            self.read_relationships_chunked_prepared.clone(),
            (
                &user_id,
                &rel_type,
                &after,
                &chunk_size
            )
        ).await?.rows_stream::<RelationshipV2>()?;

        let mut relationships = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            // we have exhausted all relationships of our type
            // we cannot limit in cql because we are using it as a composite order
            if row.relationship_type != rel_type {
                break;
            }

            relationships.push(HalfRelationship {
                user_id_b: Some(row.user_id_b.into()),
                created_at: row.created_at.0,
            })
        }


        Ok(Response::new(RelationshipsResponse { relationships }))
    }

}





#[async_trait]
impl UserRelationshipService for ScyllaUserRelationshipService {
    async fn create_relationship(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> Result<
        Response<RelationshipObject>,
        Status,
    > {
        Ok(self.create_relationship_impl(request).await?)
    }

    /// users may have multiple relationships (e.g. they both blocked eachother)
    async fn read_relationship(
        &self,
        request: Request<ReadRelationshipRequest>,
    ) -> Result<
        Response<ReadRelationshipResponse>,
        Status,
    > {
        Ok(self.read_relationship_impl(request).await?)

    }

    async fn delete_relationship(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> Result<
        Response<DeleteRelationshipResponse>,
        Status,
    > {
        Ok(self.delete_relationship_impl(request).await?)

    }
    /// test a specific relationship type
    async fn test_relationship(
        &self,
        request: Request<RelationshipObject>,
    ) -> Result<
        Response<RelationshipTestResponse>,
        Status,
    > {
        Ok(self.test_relationship_impl(request).await?)

    }

    async fn test_many_relationships(
        &self,
        request: tonic::Request<TestManyRelationshipsRequest>,
    ) -> std::result::Result<
        tonic::Response<TestManyRelationshipsResponse>,
        tonic::Status,
    > {
        Ok(self.test_many_relationships_impl(request).await?)
    }
    /// read all of a users relationships with others
    async fn read_relationships(
        &self,
        request: Request<ReadRelationshipsRequest>,
    ) -> Result<
        Response<RelationshipsResponse>,
        Status,
    > {
        Ok(self.read_relationships_impl(request).await?)

    }

    async fn get_user_relationship_counts(
        &self,
        request: tonic::Request<GetUserRelationshipCountsRequest>,
    ) -> std::result::Result<
        tonic::Response<GetUserRelationshipCountsResponse>,
        tonic::Status,
    > {
        Ok(self.get_user_relationship_counts_impl(request).await?)
    }
    
    async fn read_relationships_chunked(
        &self,
        request: tonic::Request<ReadRelationshipsChunkedRequest>,
    ) -> std::result::Result<
        tonic::Response<RelationshipsResponse>,
        tonic::Status,
    > {
        Ok(self.read_relationships_chunked_impl(request).await?)
    }
}