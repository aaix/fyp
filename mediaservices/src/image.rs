use std::io;

use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageError, ImageFormat, ImageReader, codecs::{gif::{GifDecoder}, png::{PngDecoder}, webp::WebPDecoder}};
use webp::{AnimEncoder, AnimFrame, WebPConfig};

use crate::errors::ConversionError;

const ANIMATED_FORMATS : [ImageFormat; 3] = [ImageFormat::Png, ImageFormat::WebP, ImageFormat::Gif];


pub fn transcode<'i, 'o, R, W>(
    mut input: R,
    input_format: Option<ImageFormat>,
    output_format: ImageFormat,
    output: &'o mut W,
) -> Result<(), ConversionError>
where R: 'i + io::BufRead + io::Seek, W: 'o + io::Write + io:: Seek,
{

    let mut reader  = ImageReader::new(&mut input).with_guessed_format()?;

    if reader.format().is_none() && let Some(format) = input_format {
        reader.set_format(format);
    }

    let format = match reader.format() {
        None => return Err(ConversionError::NoInputFormat),
        Some(f) => f,
    };

    if ! ANIMATED_FORMATS.contains(&format) {
        let decoded = reader.decode()?;
        decoded.write_to(output, output_format)?; 
        return Ok(())
    }

    drop(reader); // we are borrowing input as mutable again so drop for clarity


    match format {
        // annimated formats
        ImageFormat::Png => {
            let png = PngDecoder::new(&mut input)?;
            if png.is_apng()? {
                let dimensions = png.dimensions();
                let apng = png.apng()?;
                return Ok(transcode_animated(apng, output, output_format, dimensions)?);
            }
        }
        ImageFormat::Gif => {
            let gif = GifDecoder::new(&mut input)?;
            let dimensions = gif.dimensions();
            return Ok(transcode_animated(gif, output, output_format, dimensions)?);
        }
        ImageFormat::WebP => {
            let webp = WebPDecoder::new(&mut input)?;
            if webp.has_animation() {
                let dimensions = webp.dimensions();
                return Ok(transcode_animated(webp, output, output_format, dimensions)?);
            }

        }
        _ => {unreachable!()},
    }

    // fall back to dynamic handling when its not animated
    let reader: ImageReader<&mut R> = ImageReader::with_format(&mut input, format);

    let decoded = reader.decode()?;
    decoded.write_to(output, output_format)?; 


    Ok(())
}


fn transcode_animated<'i, 'o, A, W>(animated: A, mut output: W, output_format: ImageFormat, dimensions: (u32, u32)) -> Result<(), ConversionError>
where A: AnimationDecoder<'i>, W: io::Seek + io::Write + 'o
{
    let (width, height) = dimensions;
    let frames = animated.into_frames();


    match output_format {
        ImageFormat::WebP  => {
            let mut config = WebPConfig::new().map_err(|_| {ConversionError::Unknown})?;
            config.alpha_compression = 1;
            config.quality = 75f32;
            let mut encoder = AnimEncoder::new(width, height, &config);

            let mut timestamp: u32 = 0;
            let frames_with_time = frames.map(|frame_res| {
                let f = frame_res?;
                let delay: (u32, u32) = f.delay().numer_denom_ms();

                let image = DynamicImage::from(f.into_buffer());

                let r = (image, timestamp.clone());
                let delay_ms = (delay.0 as f32 / delay.1 as f32) as u32;
                timestamp += delay_ms;
                Ok::<(DynamicImage, u32), ImageError>(r)

            }).collect::<Result<Vec<(DynamicImage, u32)>, ImageError>>()?;

            for (frame, time) in &frames_with_time {

                let aframe = AnimFrame::from_image(
                    &frame,
                    *time as i32
                ).map_err(|m| ConversionError::BadFrame(m.to_string()))?;
            
                encoder.add_frame(aframe);

            }

            let d = encoder.try_encode()?;
            output.write(&d)?;
            drop(d);

        }

        _ => todo!()
    }


    return Ok(());
}