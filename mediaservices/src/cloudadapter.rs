
use aws_sdk_s3::{Client, config::http::HttpResponse, error::SdkError, operation::put_object::{PutObjectError, PutObjectOutput}, primitives::ByteStream};
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


pub async fn put_object<S: Into<String>>(bucket: &'static str, path: &String, body: ByteStream, content_type: S) -> Result<PutObjectOutput, SdkError<PutObjectError, HttpResponse>> {
    let upload_span = tracing::info_span!("s3 upload");
    upload_span.set_attribute("az.mediaservices.s3.path", path.clone());
    upload_span.set_attribute("az.mediaservices.s3.bucket", bucket);

    client().await.put_object()
        .bucket(bucket)
        .body(body)
        .content_type(content_type)
        .key(path)
        .send().await.instrument(upload_span).into_inner()
}