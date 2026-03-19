use futures::StreamExt;
use scylla::{statement::prepared::PreparedStatement, value::CqlTimeuuid};
use tonic::{Request, Response, async_trait};
use uuid::Uuid;

use crate::{db_conn::db, errors::DSResult, helpers::gen_timeuuid, models::message::Message, profile_statement, protos::dataservices::message_service::{
    CreateMessageRequest, DeleteMessageRequest, DeleteMessageResponse, MessageObject, ReadMessageRequest, ReadMessagesRequest, ReadMessagesResponse, UpdateMessageRequest, message_service_server::{MessageService, MessageServiceServer}
}, req_tuuid};


#[derive(Debug)]
pub struct ScyllaMessageServiceServer {
    create_message_prepared: PreparedStatement,
    read_messages_prepared: PreparedStatement,
    read_messages_prepared_no_before: PreparedStatement,

}


fn calc_message_bucket(message_id: CqlTimeuuid) -> i64 {
    let uuid: Uuid = message_id.into();
    let secs = uuid.get_timestamp().unwrap().to_unix().0;

    // buckets of 7 days
    let bucket = secs / (7 * 24 * 60 * 60);
    bucket as i64

}


impl ScyllaMessageServiceServer {
    
    pub async fn server() -> Option<MessageServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            eprintln!("Error creating MessageService server: {:?}", e);
            None
        } else {
            Some(MessageServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaMessageServiceServer, Box<dyn std::error::Error>> {

        
        let create_message_prepared = db().await.prepare(
            "INSERT INTO dataservices.message \
            (channel_id, bucket, message_id, message_type, opt_last_edited, opt_content, opt_attachment_asset_id, author_id)\
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).await?;

        let read_messages_prepared = db().await.prepare(
            "SELECT * FROM dataservices.message WHERE channel_id = ? AND bucket = ? AND message_Id < ? ORDER BY message_id DESC LIMIT ?"
        ).await?;

        let read_messages_prepared_no_before = db().await.prepare(
            "SELECT * FROM dataservices.message WHERE channel_id = ? AND bucket = ? ORDER BY message_id DESC LIMIT ?"
        ).await?;

        Ok(Self {
            create_message_prepared,
            read_messages_prepared,
            read_messages_prepared_no_before
        })
    }



    async fn _read_message_reuse(
        &self,
        message_id: CqlTimeuuid,
        channel_id: CqlTimeuuid,
        bucket: i64,
    ) -> DSResult<MessageObject> {
        todo!();
    }



    async fn create_message_impl(
        &self,
        request: tonic::Request<CreateMessageRequest>,
    ) -> DSResult<tonic::Response<MessageObject>> {
        
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;
        let author_id: CqlTimeuuid = req_tuuid!(request, author_id)?;
        
        let inner = request.into_inner();

        let message_id = gen_timeuuid();
        let bucket = calc_message_bucket(message_id);

        let message_type = inner.message_type;
        let last_edited = inner.opt_last_edited;
        let content = inner.opt_content;
        let attachment_asset_id: Option<CqlTimeuuid> = inner.opt_attachment_asset_id.map(Into::into);

        db().await.execute_unpaged(
            &self.create_message_prepared,
            (
                channel_id,
                bucket,
                message_id,
                message_type,
                last_edited,
                &content,
                attachment_asset_id,
                author_id
            )
        ).await?;


        Ok(Response::new(MessageObject {
            channel_id: Some(channel_id.into()),
            bucket,
            message_id: Some(message_id.into()),
            message_type,
            opt_last_edited: last_edited,
            opt_content: content,
            opt_attachment_asset_id: attachment_asset_id.map(Into::into),
            author_id: Some(author_id.into())
        }))
    }

    async fn read_message_impl(
        &self,
        request: Request<ReadMessageRequest>,
    ) -> DSResult<Response<MessageObject>> {
        let message_id: CqlTimeuuid = req_tuuid!(request, message_id)?;
        let channel_id = req_tuuid!(request, channel_id)?;
        let bucket = calc_message_bucket(message_id);
        
        Ok(Response::new(self._read_message_reuse(message_id, channel_id, bucket).await?))
    }

    async fn read_messages_impl(
        &self,
        request: tonic::Request<ReadMessagesRequest>,
    ) -> DSResult<tonic::Response<ReadMessagesResponse>> {
        let channel_id: CqlTimeuuid = req_tuuid!(request, channel_id)?;

        let inner = request.get_ref();

        let before: Option<CqlTimeuuid> = inner.before.map(Into::into);
        let count = inner.count;
        let bucket = inner.latest_bucket;

        let mut pager = match before {
            Some(b) =>  {
                profile_statement!("read_messages_prepared", db().await.execute_iter(
                    self.read_messages_prepared.clone(), 
                    (
                        channel_id,
                        bucket,
                        b,
                        count
                    )
                ).await)
            }
            None => {
                profile_statement!("read_messages_prepared_no_before", db().await.execute_iter(
                    self.read_messages_prepared_no_before.clone(), 
                    (
                        channel_id,
                        bucket,
                        count
                    )
                ).await)
            }
        }?.rows_stream::<Message>()?;

        let _guard: tracing::Span = tracing::span!(tracing::Level::INFO, "do_paging");

        let mut out = Vec::new();

        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            out.push(MessageObject {
                channel_id: Some(row.channel_id.into()),
                bucket: row.bucket,
                message_id: Some(row.message_id.into()),
                message_type: row.message_type,
                opt_last_edited: row.opt_last_edited.map(|v| v.0),
                opt_content: row.opt_content,
                opt_attachment_asset_id: row.opt_attachment_asset_id.map(Into::into),
                author_id: Some(row.author_id.into())
            })
        }
        drop(_guard);


        Ok(Response::new(ReadMessagesResponse { messages: out }))
    }
}

#[async_trait]
impl MessageService for ScyllaMessageServiceServer {
    async fn create_message(
        &self,
        request: tonic::Request<CreateMessageRequest>,
    ) -> Result<tonic::Response<MessageObject>, tonic::Status> {
        Ok(self.create_message_impl(request).await?)
    }

    async fn update_message(
        &self,
        request: tonic::Request<UpdateMessageRequest>,
    ) -> Result<tonic::Response<MessageObject>, tonic::Status> {
        todo!();
    }

    async fn read_message(
        &self,
        request: tonic::Request<ReadMessageRequest>,
    ) -> Result<tonic::Response<MessageObject>, tonic::Status> {
        Ok(self.read_message_impl(request).await?)
    }

    async fn delete_message(
        &self,
        request: tonic::Request<DeleteMessageRequest>,
    ) -> Result<
        tonic::Response<DeleteMessageResponse>,
        tonic::Status,
    > {
        todo!();
    }

    async fn read_messages(
        &self,
        request: tonic::Request<ReadMessagesRequest>,
    ) -> Result<
        tonic::Response<ReadMessagesResponse>,
        tonic::Status,
    > {
        Ok(self.read_messages_impl(request).await?)
    }
    
}