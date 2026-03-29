use std::{io::{Read}, num::NonZeroU32};

use aws_sdk_s3::primitives::ByteStream;
use image::ImageFormat;
use init_tracing_opentelemetry::tracing_opentelemetry::OpenTelemetrySpanExt;
use tonic::{Response, async_trait};
use tracing::Instrument;

use crate::{cloudadapter, errors::{MSError, MSResult}, protos::mediaservices::transformer::{MediaInput, TransformImageResponse, TransformVideoResponse, media_input, transformer_service_server::{TransformerService, TransformerServiceServer}}, streamer::AsyncStreamer};

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
        request: tonic::Request<tonic::Streaming<MediaInput>>,
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
    request: tonic::Request<tonic::Streaming<MediaInput>>,
) -> MSResult<tonic::Response<TransformImageResponse>> {

    let req = request.into_inner();

    let (mut async_stream, mut sync_stream) = AsyncStreamer::new(req);

    let first = async_stream.get_one().await.map_err(|e| {tracing::error!("{e:?}"); MSError::Cancelled})?.ok_or(MSError::Cancelled)?;

    let recv_future = async_stream.recv();


    let asset = match first.next.ok_or(MSError::Cancelled)? {
        media_input::Next::Asset(asset) => asset,
        media_input::Next::Chunk(_) => return Err(MSError::BadInternalInput("Missing asset submessage")),
    };

    let path = &asset.path;

    // if path len is too short probably something unintended has occured
    if path.len()  < 8 {
        return Err(MSError::BadInternalInput("Unexpected short path len"))
    };

    let input_format = ImageFormat::from_mime_type(&asset.content_type);
    let output_format = ImageFormat::from_mime_type(&asset.output_type)
        .ok_or(MSError::BadInternalInput("Could not determine requested output mime type"))?;

    let bucket = match asset.public {
        true => cloudadapter::public_url().await,
        false => cloudadapter::private_url().await,
    };
    
    let input_length = asset.input_size;

    let dimensions = match (asset.output_width.unwrap_or(0), asset.output_height.unwrap_or(0)) {
        (0, _) => None,
        (_, 0) => None,
        (w, h) => Some((NonZeroU32::new(w).unwrap(), NonZeroU32::new(h).unwrap()))
    };
    

    let transform_span = tracing::info_span!("image transform");
    transform_span.set_attribute("az.mediaservices.img.from", input_format.map(|f| f.to_mime_type()).unwrap_or("unknown"));
    transform_span.set_attribute("az.mediaservices.img.to", output_format.to_mime_type());

    // run in executor because image-rs is slow and not async``
    let transform_join_future = tokio::task::spawn_blocking(move || {

        let mut data = Vec::with_capacity(input_length as usize);
        tracing::info!("Allocated with capacity {}", data.len());
        sync_stream.read_to_end(&mut data)?;
        let reader = std::io::Cursor::new(data);

        // we have to have the entire input and output in memory
        // because image-rs requires io::Seek
        let mut out: Vec<u8> = Vec::new();
        crate::image::transcode(reader, input_format, output_format, &mut std::io::Cursor::new(&mut out), dimensions)
            .map(|_| out)

    }).instrument(transform_span);

    // wrap in a future so that join error and transform error will cause an early Err() return from try_join
    let transform_future = async || {
        let data = transform_join_future.await.map_err(|e| {
            tracing::error!("{e:?}");
            MSError::Unknown
        })??;
        Ok(data)
    };

    let (out, _) = tokio::try_join!(transform_future(), recv_future)?;


    cloudadapter::put_object(bucket, path, ByteStream::from(out), output_format.to_mime_type()).await?;



    Ok(Response::new(TransformImageResponse {  }))
}

// async fn transform_video(
//     request: tonic::Request<tonic::Streaming<MediaInput>>,
// ) -> MSResult<tonic::Response<TransformImageResponse>> {

//     let streaming = request.into_inner();

//     let (mut streamer, mut out) = AsyncStreamer::new(streaming);


//     let first = streamer.get_one().await.map_err(|e| {tracing::error!("{e:?}"); MSError::Cancelled})?.ok_or(MSError::Cancelled)?;

//     let next = first.next.ok_or(MSError::BadUserInput("Missing 'next'"))?;
//     let asset = match next {
//         media_input::Next::Asset(asset) => Ok(asset),
//         media_input::Next::Chunk(items) => Err(MSError::BadUserInput("Unexpected chunk as first")),
//     }?;


//     tokio::task::spawn_blocking(move || {
//         let reader = BufReader::new(out);

//     }).await?;



//      todo!();
// }
