/*
TABLE friendship

TABLE friendship_request

TABLE blocked_user
*/

use crate::{db_conn::db, errors::DSResult, helpers::time_now, models::relationship::Relationship, protos::user_service::{self, CreateRelationshipRequest, HalfRelationship, ReadRelationshipRequest, ReadRelationshipResponse, ReadRelationshipsRequest, RelationshipObject, RelationshipTestResponse, RelationshipsResponse, DeleteRelationshipResponse}, req_tuuid};

use futures::StreamExt;
use scylla::{statement::prepared::PreparedStatement, value::CqlTimeuuid};
use tonic::{Request, Response, Status, async_trait};
use user_service::user_relationship_service_server::{UserRelationshipService, UserRelationshipServiceServer};


pub struct ScyllaUserRelationshipService {
    // prepared statements for our CRUD operations
    create_relationship_prepared: PreparedStatement,
    read_relationship_prepared: PreparedStatement,
    read_relationships_prepared: PreparedStatement,
    delete_relationship_prepared: PreparedStatement,
}


impl ScyllaUserRelationshipService {
    pub async fn server() -> Option<UserRelationshipServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating UserRelationshipService server: {:?}", e);
            None
        } else {
            Some(UserRelationshipServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {

        let create_relationship_prepared = db().await.prepare(
            "BEGIN BATCH
            INSERT INTO dataservices.relationship (user_id_a, user_id_b, created_at, relationship_type)
            VALUES (?, ?, ?, ?);
            INSERT INTO dataservices.relationship (user_id_a, user_id_b, created_at, relationship_type)
            VALUES (?, ?, ?, ?);
            APPLY BATCH"
        ).await?;

        let read_relationship_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship WHERE user_id_a = ? AND user_id_b = ?"
        ).await?;

        let read_relationships_prepared = db().await.prepare(
            "SELECT * FROM dataservices.relationship WHERE user_id_a = ?"
        ).await?;

        let delete_relationship_prepared = db().await.prepare(
            "BEGIN BATCH
            DELETE FROM dataservices.relationship WHERE user_id_a = ? AND user_id_b = ? AND relationship_type = ?;
            DELETE FROM dataservices.relationship WHERE user_id_a = ? AND user_id_b = ? AND relationship_type = ?;
            APPLY BATCH"
        ).await?;

        Ok(Self {
            create_relationship_prepared,
            read_relationship_prepared,
            read_relationships_prepared,
            delete_relationship_prepared,
        })
    }
}

impl ScyllaUserRelationshipService {
    async fn create_relationship_impl(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> DSResult<Response<RelationshipObject>> {
        let user_a_id: CqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b_id: CqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let created_at = time_now();
        let inner = request.get_ref();

        let a_to_b_type = inner.a_to_b_type;
        let b_to_a_type = inner.b_to_a_type;

        // batch insert/upsert both directions
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
            relationship_type: a_to_b_type,
        }))
    }

    async fn read_relationship_impl(
        &self,
        request: Request<ReadRelationshipRequest>,
    ) -> DSResult<Response<ReadRelationshipResponse>> {
        let user_a: CqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b: CqlTimeuuid = req_tuuid!(request, user_id_b)?;

        let mut pager = db().await.execute_iter(
            self.read_relationship_prepared.clone(),
            (&user_a, &user_b)
        ).await?.rows_stream::<Relationship>()?;

        let mut out = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            out.push(RelationshipObject {
                user_id_a: Some(row.user_id_a.into()),
                user_id_b: Some(row.user_id_b.into()),
                relationship_type: row.relationship_type
            })

        }

        Ok(Response::new(ReadRelationshipResponse { relationships: out }))
    }

    async fn delete_relationship_impl(
        &self,
        request: Request<CreateRelationshipRequest>,
    ) -> DSResult<Response<DeleteRelationshipResponse>> {
        let user_a: CqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b: CqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let inner = request.get_ref();
        let a_to_b_type = inner.a_to_b_type;
        let b_to_a_type = inner.b_to_a_type;

        db().await.execute_unpaged(&self.delete_relationship_prepared,
                (
                    &user_a,
                    &user_b,
                    &a_to_b_type,
                    &user_b,
                    &user_a,
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
        let user_a: CqlTimeuuid = req_tuuid!(request, user_id_a)?;
        let user_b: CqlTimeuuid = req_tuuid!(request, user_id_b)?;
        let inner = request.get_ref();
        let relationship_type = inner.relationship_type;

        let rows = db().await.execute_unpaged(
            &self.read_relationship_prepared,
            (&user_a, &user_b, &relationship_type)
        ).await?.into_rows_result()?;

        let exists = rows.rows_num() > 0;

        

        Ok(Response::new(RelationshipTestResponse {exists}))
    }

    async fn read_relationships_impl(
        &self,
        request: Request<ReadRelationshipsRequest>,
    ) -> DSResult<Response<RelationshipsResponse>> {
        let user_id: CqlTimeuuid = req_tuuid!(request, user_id)?;

        let mut pager = db().await.execute_iter(
            self.read_relationships_prepared.clone(),
            (user_id,)
        ).await?.rows_stream::<Relationship>()?;


        let mut relationships = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;
            relationships.push(HalfRelationship {
                user_id_b: Some(row.user_id_b.into()),
                relationship_type: row.relationship_type
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
    
}