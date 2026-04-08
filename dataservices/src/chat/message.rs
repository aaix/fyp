use futures::StreamExt;
use init_tracing_opentelemetry::tracing_opentelemetry::OpenTelemetrySpanExt;
use scylla::{statement::prepared::PreparedStatement, value::{MaybeUnset}};
use tonic::{Request, Response, Status, async_trait};

use crate::{db_conn::db, errors::DSResult, helpers::{calc_bucket, gen_timeuuid, time_now}, models::message::Message, profile_statement, protos::{dataservices::message_service::{*, message_service_server::{MessageService, MessageServiceServer}
}, plib::AllignedCqlTimeuuid}, req_tuuid};


#[derive(Debug)]
pub struct ScyllaMessageServiceServer {
    create_message_prepared: PreparedStatement,
    read_messages_prepared: PreparedStatement,
    read_messages_prepared_no_before: PreparedStatement,
    read_message_prepared: PreparedStatement,
    delete_message_prepared: PreparedStatement,
    update_message_prepared: PreparedStatement,
    delete_messages_by_bucket_prepared: PreparedStatement,

}


fn message_from_row(row: Message) -> MessageObject {
    MessageObject {
        channel_id: Some(row.channel_id.into()),
        bucket: row.bucket,
        message_id: Some(row.message_id.into()),
        message_type: row.message_type,
        opt_last_edited: row.opt_last_edited.map(|v| v.0),
        opt_content: row.opt_content,
        opt_attachment_asset_id: row.opt_attachment_asset_id.map(Into::into),
        author_id: Some(row.author_id.into()),
        opt_in_reply_to: row.opt_in_reply_to.map(Into::into),
        opt_additional_content: row.opt_additional_content,
    }
}


impl ScyllaMessageServiceServer {
    
    pub async fn server() -> Option<MessageServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating MessageService server: {:?}", e);
            None
        } else {
            Some(MessageServiceServer::new(server.unwrap()))
        }
    }

    pub async fn new() -> Result<ScyllaMessageServiceServer, Box<dyn std::error::Error>> {

        
        let create_message_prepared = db().await.prepare(
            "INSERT INTO dataservices.message \
            (channel_id, bucket, message_id, message_type, opt_last_edited, opt_content, opt_attachment_asset_id, author_id, opt_in_reply_to, opt_additional_content)\
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).await?;

        let read_messages_prepared = db().await.prepare(
            "SELECT * FROM dataservices.message WHERE channel_id = ? AND bucket = ? AND message_Id < ? ORDER BY message_id DESC LIMIT ?"
        ).await?;

        let read_message_prepared = db().await.prepare(
            "SELECT * FROM dataservices.message WHERE channel_id = ? AND bucket = ? AND message_id = ?"
        ).await?;

        let delete_message_prepared = db().await.prepare(
            "DELETE FROM dataservices.message WHERE channel_id = ? AND bucket = ? AND message_id = ?"
        ).await?;

        let read_messages_prepared_no_before = db().await.prepare(
            "SELECT * FROM dataservices.message WHERE channel_id = ? AND bucket = ? ORDER BY message_id DESC LIMIT ?"
        ).await?;

        let update_message_prepared = db().await.prepare(
            "UPDATE dataservices.message SET opt_content = ?, message_type = ?, opt_last_edited = ? WHERE channel_id = ? AND bucket = ? AND message_id = ?"
        ).await?;


        let delete_messages_by_bucket_prepared = db().await.prepare(
            "DELETE FROM dataservices.message WHERE channel_id = ? AND bucket = ?"
        ).await?;

        Ok(Self {
            create_message_prepared,
            read_messages_prepared,
            read_messages_prepared_no_before,
            read_message_prepared,
            delete_message_prepared,
            update_message_prepared,
            delete_messages_by_bucket_prepared,
        })
    }



    async fn _read_message_reuse(
        &self,
        message_id: &AllignedCqlTimeuuid,
        channel_id: &AllignedCqlTimeuuid,
        bucket: i64,
    ) -> DSResult<Message> {

        let msg = db().await.execute_unpaged(
            &self.read_message_prepared, 
            (channel_id, bucket, message_id)
        ).await?.into_rows_result()?.first_row::<Message>()?;

        Ok(msg)
    }





    async fn create_message_impl(
        &self,
        request: tonic::Request<CreateMessageRequest>,
    ) -> DSResult<tonic::Response<MessageObject>> {
        
        let channel_id: AllignedCqlTimeuuid = req_tuuid!(request, channel_id)?;
        let author_id: AllignedCqlTimeuuid = req_tuuid!(request, author_id)?;
        
        let inner = request.into_inner();

        let message_id = gen_timeuuid();
        let bucket = calc_bucket(message_id);

        let message_type = inner.message_type;
        let last_edited = inner.opt_last_edited;
        let content = inner.opt_content;
        let additional_content = inner.opt_additional_content;

        let attachment_asset_id: Option<AllignedCqlTimeuuid> = if let Some(request_asset) = inner.request_asset {
            if !request_asset {
                return Err(Status::invalid_argument("Unexpected false asset request").into());                    
            }
            Some(gen_timeuuid())
        } else {
            None
        };


        let in_reply_to: Option<AllignedCqlTimeuuid> = inner.opt_in_reply_to.map(Into::into);

        db().await.execute_unpaged(
            &self.create_message_prepared,
            (
                channel_id,
                bucket,
                message_id,
                message_type,
                last_edited,
                &content,
                MaybeUnset::from_option(attachment_asset_id),
                author_id,
                in_reply_to,
                &additional_content,
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
            author_id: Some(author_id.into()),
            opt_in_reply_to: inner.opt_in_reply_to,
            opt_additional_content: additional_content,
        }))
    }

    async fn read_message_impl(
        &self,
        request: Request<ReadMessageRequest>,
    ) -> DSResult<Response<MessageObject>> {
        let message_id: AllignedCqlTimeuuid = req_tuuid!(request, message_id)?;
        let channel_id = req_tuuid!(request, channel_id)?;
        let bucket = calc_bucket(message_id);
        
        let row = self._read_message_reuse(&message_id, &channel_id, bucket).await?;



        Ok(Response::new(message_from_row(row)))
    }


    async fn _read_messages_single_iter(
        &self,
        channel_id: &AllignedCqlTimeuuid,
        bucket: i64,
        before: Option<AllignedCqlTimeuuid>,
        max_to_fetch: i32,
        output: &mut Vec<MessageObject>,
    ) -> DSResult<()> {

        let mut pager = match before {
            Some(b) =>  {
                profile_statement!("read_messages_prepared", db().await.execute_iter(
                    self.read_messages_prepared.clone(), 
                    (
                        channel_id,
                        bucket,
                        b,
                        max_to_fetch
                    )
                ).await)
            }
            None => {
                profile_statement!("read_messages_prepared_no_before", db().await.execute_iter(
                    self.read_messages_prepared_no_before.clone(), 
                    (
                        channel_id,
                        bucket,
                        max_to_fetch
                    )
                ).await)
            }
        }?.rows_stream::<Message>()?;


        while let Some(row_res) = pager.next().await {
            let row = row_res?;

            output.push(message_from_row(row))
        }

        Ok(())
    }

    async fn read_messages_impl(
        &self,
        request: tonic::Request<ReadMessagesRequest>,
    ) -> DSResult<tonic::Response<ReadMessagesResponse>> {
        let channel_id: AllignedCqlTimeuuid = req_tuuid!(request, channel_id)?;

        let inner = request.get_ref();

        let before: Option<AllignedCqlTimeuuid> = inner.before.map(Into::into);
        let count = inner.count as usize;
        let mut bucket = inner.latest_bucket;

        // we cant go back before the channel was CREATED
        let min_bucket = calc_bucket(channel_id);

        let span: tracing::Span = tracing::span!(tracing::Level::INFO, "page buckets");

        let mut output: Vec<MessageObject> = Vec::with_capacity(count);


        // we must backscan because we dont know which bucket has messages in
        while output.len() < count && bucket >= min_bucket {
            let max_to_fetch = count - output.len();
            self._read_messages_single_iter(&channel_id, bucket, before, max_to_fetch as i32, &mut output).await?;
            bucket -= 1;
        }

        span.set_attribute("az.dataservices.channel.buckets_searched", inner.latest_bucket - bucket);

        drop(span);

        Ok(Response::new(ReadMessagesResponse { messages: output }))
    }


    async fn delete_message(
        &self,
        request: tonic::Request<DeleteMessageRequest>,
    ) -> DSResult<tonic::Response<DeleteMessageResponse>> {
        let channel_id: AllignedCqlTimeuuid = req_tuuid!(request, channel_id)?;
        let message_id: AllignedCqlTimeuuid = req_tuuid!(request, message_id)?;

        let bucket = calc_bucket(message_id);

        db().await.execute_unpaged(
            &self.delete_message_prepared, 
            (channel_id, bucket, message_id)
        ).await?;

        Ok(Response::new(DeleteMessageResponse {  }))
    }

    async fn update_message(
        &self,
        request: tonic::Request<UpdateMessageRequest>,
    ) -> DSResult<tonic::Response<MessageObject>> {
        let channel_id: AllignedCqlTimeuuid = req_tuuid!(request, channel_id)?;
        let message_id: AllignedCqlTimeuuid = req_tuuid!(request, message_id)?;

        let bucket = calc_bucket(message_id);

        let inner = request.get_ref();

        if inner.content.is_none() && inner.message_type.is_none() {
            return Err(Status::invalid_argument("Missing param to update").into());
        }

        let new_content = MaybeUnset::from_option(inner.content.as_ref());
        let new_message_type = MaybeUnset::from_option(inner.message_type);


        let updated_at = time_now();

        db().await.execute_unpaged(
            &self.update_message_prepared, 
            (new_content, new_message_type, updated_at, channel_id, bucket, message_id)
        ).await?;

        
        let updated = self._read_message_reuse(&message_id, &channel_id, bucket).await?;
        Ok(Response::new(message_from_row(updated)))

    }

    async fn delete_messages_by_bucket_impl(
        &self,
        request: tonic::Request<DeleteMessagesByBucketRequest>,
    ) -> DSResult<
        tonic::Response<DeleteMessagesByBucketResponse>> {
        let channel_id: AllignedCqlTimeuuid = req_tuuid!(request, channel_id)?;

        let bucket = request.get_ref().bucket;

        db().await.execute_unpaged(
            &self.delete_messages_by_bucket_prepared,
            (
                channel_id,
                bucket
            )
        ).await?;

        Ok(Response::new(DeleteMessagesByBucketResponse {  }))
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
        Ok(self.update_message(request).await?)
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
        Ok(self.delete_message(request).await?)
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
    
    async fn delete_messages_by_bucket(
        &self,
        request: tonic::Request<DeleteMessagesByBucketRequest>,
    ) -> std::result::Result<
        tonic::Response<DeleteMessagesByBucketResponse>,
        tonic::Status,
    > {
        Ok(self.delete_messages_by_bucket_impl(request).await?)
    }
}