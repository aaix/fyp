use futures::StreamExt;
use scylla::statement::prepared::PreparedStatement;
use tonic::{Response, async_trait};

use crate::{db_conn::db, errors::DSResult, models::needs_gc::NeedsGc, protos::{dataservices::gc_service::{garbage_service_server::{GarbageService, GarbageServiceServer}, *}, plib::AllignedCqlTimeuuid}, req_tuuid};


pub struct ScyllaGarbageServiceServer {
    insert_prepared: PreparedStatement,
    read_prepared: PreparedStatement, 
}


impl ScyllaGarbageServiceServer {
    
    pub async fn server() -> Option<GarbageServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating GarbageService server: {:?}", e);
            None
        } else {
            Some(GarbageServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaGarbageServiceServer, Box<dyn std::error::Error>> {

        let insert_prepared = db().await.prepare(
            "INSERT INTO dataservices.needs_gc (bucket, object_id, garbage_type) VALUES (?, ?, ?)"
        ).await?;

        let read_prepared = db().await.prepare(
            "SELECT * FROM dataservices.needs_gc WHERE bucket = ? AND object_id > ? ORDER BY object_id ASC LIMIT ?"
        ).await?;

        Ok(Self {
            insert_prepared,
            read_prepared,
        })
    }
}


impl ScyllaGarbageServiceServer {
    async fn file_for_collection_impl(
        &self,
        request: tonic::Request<FileGarbageRequest>,
    ) -> DSResult<
        tonic::Response<FileGarbageResponse>> {
        
        let object_id: AllignedCqlTimeuuid = req_tuuid!(request, object_id)?;
        let inner = request.get_ref();

        let bucket = inner.bucket;
        let garbage_type = inner.garbage_type;

        db().await.execute_unpaged(
            &self.insert_prepared, 
            (
                bucket,
                object_id,
                garbage_type
            )
        ).await?;


        Ok(Response::new(FileGarbageResponse {}))

    }
    async fn read_garbage_impl(
        &self,
        request: tonic::Request<ReadGarbageRequest>,
    ) -> DSResult<tonic::Response<GarbageResponse>> {
        let after: AllignedCqlTimeuuid = req_tuuid!(request, after)?;
        let inner = request.get_ref();

        let bucket = inner.bucket;
        let limit = inner.limit;

        let mut pager = db().await.execute_iter(
            self.read_prepared.clone(), 
            (
                bucket,
                after,
                limit
            )
        ).await?.rows_stream::<NeedsGc>()?;

        let mut for_collection = Vec::with_capacity(limit as usize);


        while let Some(row_res) = pager.next().await {
            let row = row_res?;
            for_collection.push(
                GarbageItem {
                    bucket: row.bucket,
                    object_id: Some(row.object_id.into()),
                    garbage_type: row.garbage_type,
                }
            );

        }

        Ok(Response::new(GarbageResponse { for_collection }))        

    }
}



#[async_trait]
impl GarbageService for ScyllaGarbageServiceServer {
    async fn file_for_collection(
        &self,
        request: tonic::Request<FileGarbageRequest>,
    ) -> std::result::Result<
        tonic::Response<FileGarbageResponse>,
        tonic::Status,
    > {
        Ok(self.file_for_collection_impl(request).await?)
    }
    async fn read_garbage(
        &self,
        request: tonic::Request<ReadGarbageRequest>,
    ) -> std::result::Result<tonic::Response<GarbageResponse>, tonic::Status> {
        Ok(self.read_garbage_impl(request).await?)
    }
}