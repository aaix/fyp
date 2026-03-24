use std::io::BufReader;

use aws_sdk_s3::primitives::ByteStream;
use image::ImageFormat;
use init_tracing_opentelemetry::tracing_opentelemetry::OpenTelemetrySpanExt;
use tonic::{Response, async_trait};
use tracing::Instrument;

use crate::{cloudadapter, errors::{MSError, MSResult}, protos::mediaservices::transformer::{MediaInput, TransformImageRequest, TransformImageResponse, TransformVideoResponse, media_input, transformer_service_server::{TransformerService, TransformerServiceServer}}, streamer::AsyncStreamer};

pub struct TransformerServer {

}
impl TransformerServer {
    pub fn server() -> TransformerServiceServer<Self> {

        let server = TransformerServiceServer::new(Self {});

        server
    }
}

#[async_trait]
impl TransformerService for TransformerServer {
    async fn transform_image(
        &self,
        request: tonic::Request<TransformImageRequest>,
    ) -> std::result::Result<tonic::Response<TransformImageResponse>, tonic::Status> {
        
        Ok(transform_image(request).await?)
    }
    async fn transform_video(
        &self,
        request: tonic::Request<tonic::Streaming<MediaInput> >,
    ) -> std::result::Result<
        tonic::Response<TransformVideoResponse>,
        tonic::Status,
    > {
        todo!();
    }
}

async fn transform_image(
    request: tonic::Request<TransformImageRequest>,
) -> MSResult<tonic::Response<TransformImageResponse>> {

    let req = request.into_inner();


    let asset = req.asset.as_ref().ok_or(MSError::BadInternalInput("missing asset submessage"))?;
    let path = &asset.path;

    // if path len is too short probably something unintended has occured
    if path.len()  < 8 {
        return Err(MSError::BadInternalInput("Unexpected short path len"))
    };

    let data = req.data;

    let input_format = ImageFormat::from_mime_type(&asset.content_type);
    let output_format = ImageFormat::from_mime_type(&asset.output_type)
        .ok_or(MSError::BadInternalInput("Could not determine requested output mime type"))?;

    let bucket = match asset.public {
        true => cloudadapter::public_url().await,
        false => cloudadapter::private_url().await,
    };
    

    

    let transform_span = tracing::info_span!("image transform");
    transform_span.set_attribute("az.mediaservices.img.from", input_format.map(|f| f.to_mime_type()).unwrap_or("unknown"));
    transform_span.set_attribute("az.mediaservices.img.to", output_format.to_mime_type());

    // run in executor because image-rs is slow and not async``
    let out = tokio::task::spawn_blocking(move || {
        let reader = std::io::Cursor::new(data);

        // we have to have the entire input and output in memory
        // because image-rs requires io::Seek
        let mut out: Vec<u8> = Vec::new();
        crate::image::transcode(reader, input_format, output_format, &mut std::io::Cursor::new(&mut out))
            .map(|_| out)

    }).await?.instrument(transform_span).into_inner()?;


    cloudadapter::put_object(bucket, path, ByteStream::from(out), output_format.to_mime_type()).await?;



    Ok(Response::new(TransformImageResponse {  }))
}

async fn transform_video(
    request: tonic::Request<tonic::Streaming<MediaInput>>,
) -> MSResult<tonic::Response<TransformImageResponse>> {

    let streaming = request.into_inner();

    let (streamer, mut out) = AsyncStreamer::new(streaming);


    let first = out.get_one().await.ok_or(MSError::Cancelled)?;

    let next = first.next.ok_or(MSError::BadUserInput("Missing 'next'"))?;
    let asset = match next {
        media_input::Next::Asset(asset) => Ok(asset),
        media_input::Next::Chunk(items) => Err(MSError::BadUserInput("Unexpected chunk as first")),
    }?;


    tokio::task::spawn_blocking(move || {
        let reader = BufReader::new(out);

    }).await?;



     todo!();
}
