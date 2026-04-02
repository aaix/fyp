use std::{num::NonZeroU32, process::Stdio};

use futures::TryFutureExt;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, process::Command};

use crate::{cloudadapter::{self, CloudMultipartUpload}, errors::{ConversionError, MSError, MSResult}, protos::mediaservices::{asset::Asset, transformer::MediaInput}, rpc::get_next_chunk};



pub async fn transcode(
    mut input: tonic::Streaming<MediaInput>,
    to_dimensions: Option<(NonZeroU32, NonZeroU32)>,
    asset: Asset,
) -> MSResult<()>
{

    let bucket = match asset.public {
        true => cloudadapter::public_url().await,
        false => cloudadapter::private_url().await,
    };

    let mut process = Command::new("ffmpeg")
        .kill_on_drop(true)
        .arg("-i").arg("pipe:0")
        .arg("-c:v").arg("libvpx-vp9") // video codec
        .arg("-c:a").arg("libopus")    // audio vodec
        .arg("-f").arg("webm") // webm out
        .arg("-error-resilient").arg("1")
        .arg("-cpu-used").arg("6")
        .arg("-threads").arg("8") 
        .arg("-row-mt").arg("1")
        .arg("-deadline").arg("realtime ")
        .arg("pipe:1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn().map_err(|e| {ConversionError::IoError(e.kind())})?;


    let mut stdin = process.stdin.take().ok_or(MSError::Unknown("Could not bind stdin"))?;
    let mut stdout = process.stdout.take().ok_or(MSError::Unknown("Could not bind stdin"))?;


    let writer_future = tokio::spawn(async move {
        while let Some(data) = get_next_chunk(&mut input).await? {
            let to_write = data.len();
            tracing::info!("Got {} bytes from input", to_write);
            let mut head = 0;
            loop {
                let written = stdin.write(&data[head..]).await.map_err(|e| {ConversionError::IoError(e.kind())})?;
                tracing::info!("Wrote {} bytes to ffmpeg", written);
                if written + head >= to_write {
                    break
                }
                head += written;
            }

        }
        drop(stdin); // explicit drop bc we are done with input data
        MSResult::Ok(())
    }).map_err(|j| {tracing::error!("Error joining writer {j:?}"); MSError::Unknown("Error joining writer")});


    let reader_future = tokio::spawn(async move {
        let mut uploader = CloudMultipartUpload::new(bucket, asset.path, "video/webm").await?;
        const BUFF_SIZE: usize = 10 * 1000 * 1000; // 10mb buf
        let mut buf = vec![0; BUFF_SIZE]; 
        let mut current_head = 0;
        loop {
            
            let written = stdout.read(&mut buf[current_head..]).await.map_err(|e| {ConversionError::IoError(e.kind())})?;
            current_head += written;
            tracing::info!("Read {written} from ffmpeg");
            if current_head >= BUFF_SIZE || written == 0 {
                let owned = Vec::from(&buf[0..current_head]);
                tracing::info!("Taking ffmpeg chunk of {current_head}");
                uploader.part(owned).await?;
                current_head = 0;
            }
            if written == 0 {
                break
            }
            
        };

        MSResult::Ok(uploader)
    }).map_err(|j| {tracing::error!("Error joining reader {j:?}"); MSError::Unknown("Error joining reader")});


    let process_future = process.wait().map_err(|e| {MSError::from(e)});

    let (reader, writer, exit) = tokio::try_join!(reader_future, writer_future, process_future)?;
    let uploader = reader?;
    writer?;

    if exit.success() {
        uploader.complete().await?;
        Ok(())
    } else {
        uploader.cancel().await;
        Err(ConversionError::ErrorExitStatus(exit.code()).into())
    }
    
}