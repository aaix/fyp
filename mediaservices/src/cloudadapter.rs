
use aws_sdk_s3::{Client, config::http::HttpResponse, error::SdkError, operation::{complete_multipart_upload::CompleteMultipartUploadError, create_multipart_upload::CreateMultipartUploadError, put_object::{PutObjectError, PutObjectOutput}, upload_part::UploadPartError}, primitives::ByteStream, types::{CompletedMultipartUpload, CompletedPart}};
use init_tracing_opentelemetry::tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing::Instrument;

static CLIENT: tokio::sync::OnceCell<Client> = tokio::sync::OnceCell::const_new();
static PUBLIC_BUCKET: tokio::sync::OnceCell<String> = tokio::sync::OnceCell::const_new();
static PRIVATE_BUCKET: tokio::sync::OnceCell<String> = tokio::sync::OnceCell::const_new();

pub async fn public_url() -> &'static str {
    PUBLIC_BUCKET.get_or_init(async || {
        std::env::var("S3_PUBLIC_BUCKET").unwrap()
    }).await
}

pub async fn private_url() -> &'static str {
    PRIVATE_BUCKET.get_or_init(async || {
        std::env::var("S3_PRIVATE_BUCKET").unwrap()
    }).await
}

#[derive(Debug)]
pub enum CloudadapterError {
    PutFail(SdkError<PutObjectError, HttpResponse>),
    MultipartStartFail(SdkError<CreateMultipartUploadError, HttpResponse>),
    MultipartStartNoUploadID,
    MultipartUploadPartFail(SdkError<UploadPartError, HttpResponse>),
    MultipartFinalFail(SdkError<CompleteMultipartUploadError, HttpResponse>)
}

impl From<SdkError<PutObjectError, HttpResponse>> for CloudadapterError {
    fn from(value: SdkError<PutObjectError, HttpResponse>) -> Self {
        Self::PutFail(value)
    }
}

impl From<SdkError<CreateMultipartUploadError, HttpResponse>> for CloudadapterError {
    fn from(value: SdkError<CreateMultipartUploadError, HttpResponse>) -> Self {
        Self::MultipartStartFail(value)
    }
}

impl From<SdkError<UploadPartError, HttpResponse>> for CloudadapterError {
    fn from(value: SdkError<UploadPartError, HttpResponse>) -> Self {
        Self::MultipartUploadPartFail(value)
    }
}

impl From<SdkError<CompleteMultipartUploadError, HttpResponse>> for CloudadapterError {
    fn from(value: SdkError<CompleteMultipartUploadError, HttpResponse>) -> Self {
        Self::MultipartFinalFail(value)
    }
}



pub async fn client() -> &'static Client {
    CLIENT.get_or_init(|| async {
        let endpoint_url = std::env::var("S3_ENDPOINT_URL").unwrap();
        let access_key_id = std::env::var("S3_ACCESS_KEY_ID").unwrap();
        let access_key_secret = std::env::var("S3_ACCESS_KEY_SECRET").unwrap();

        let config = aws_config::from_env()
            .endpoint_url(endpoint_url)
            .credentials_provider(aws_sdk_s3::config::Credentials::new(
                access_key_id,
                access_key_secret,
                None, // session token is not used with R2
                None,
                "R2",
            ))
            .region("auto") // Required by SDK but not used by R2
            .load()
            .await;

        Client::new(&config)
    })
    .await
}


pub async fn put_object<S: Into<String>>(bucket: &'static str, path: &String, body: ByteStream, content_type: S) -> Result<PutObjectOutput, CloudadapterError> {
    let upload_span = tracing::info_span!("s3 upload");
    upload_span.set_attribute("az.mediaservices.s3.path", path.clone());
    upload_span.set_attribute("az.mediaservices.s3.bucket", bucket);

    let upload = client().await.put_object()
        .bucket(bucket)
        .body(body)
        .content_type(content_type)
        .key(path)
        .send().await.instrument(upload_span).into_inner()?;

    Ok(upload)
}

#[derive(Debug)]
pub struct CloudMultipartUpload {
    bucket: &'static str,
    upload_id: String,
    path: String,
    parts: Vec<CompletedPart>,
    part_number: i32,
    completed: bool,
}

impl CloudMultipartUpload {
    pub async fn new(bucket:  &'static str, path: String, mime: &str) -> Result<Self, CloudadapterError> {
        let multipart = client().await
            .create_multipart_upload()
            .bucket(bucket)
            .content_type(mime)
            .key(&path)
            .send()
            .await?;

        let upload_id = multipart.upload_id.ok_or(CloudadapterError::MultipartStartNoUploadID)?;

        Ok(Self {
            bucket,
            upload_id,
            path,
            parts: Vec::new(),
            part_number: 0,
            completed: false,
        })
    }

    pub async fn part(&mut self, buf: Vec<u8>) -> Result<(), CloudadapterError>  {
        self.part_number += 1;
        let part = client().await
            .upload_part()
            .bucket(self.bucket)
            .key(&self.path)
            .upload_id(&self.upload_id)
            .part_number(self.part_number)
            .body(ByteStream::from(buf))
            .send()
            .await?;

        self.parts.push(
            CompletedPart::builder()
                .e_tag(part.e_tag().unwrap())
                .part_number(self.part_number)
                .build()
        );

        Ok(())
    }

    pub async fn complete(mut self) -> Result<(), CloudadapterError> {


        // take so we dont move out of self so we can still drop
        let parts = std::mem::take(&mut self.parts);
        
        let completed_upload = CompletedMultipartUpload::builder()
        .set_parts(Some(parts))
        .build();

        client().await
            .complete_multipart_upload()
            .bucket(self.bucket)
            .key(&self.path)
            .upload_id(&self.upload_id)
            .multipart_upload(completed_upload)
            .send()
            .await?;

        self.completed = true;
        Ok(())
    }

    pub async fn cancel(self) {
        cancel_multipart(self.bucket, &self.path, &self.upload_id).await;
    }
}

impl Drop for CloudMultipartUpload {
    fn drop(&mut self) {
        if self.completed {
            return
        }
        let bucket = self.bucket;
        let path = self.path.clone();
        let upload_id = self.upload_id.clone();
        tokio::spawn(async move {
            cancel_multipart(bucket, &path, &upload_id).await;
        });
    }
}

async fn cancel_multipart(bucket: &'static str, path: &String, upload_id: &String) {
    let res = client().await.abort_multipart_upload()
        .bucket(bucket)
        .key(path)
        .upload_id(upload_id)
        .send().await;

    if let Err(e) = res {
        tracing::error!("Error aborting multipart upload {e:?}");
    }
}