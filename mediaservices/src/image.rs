use std::{io, num::NonZeroU32};

use image::{AnimationDecoder, DynamicImage, GenericImageView, ImageDecoder, ImageError, ImageFormat, ImageReader, codecs::{gif::GifDecoder, png::PngDecoder, webp::WebPDecoder}, imageops::FilterType};
use webp::{AnimEncoder, AnimFrame, WebPConfig};

use crate::errors::ConversionError;

const ANIMATED_FORMATS : [ImageFormat; 3] = [ImageFormat::Png, ImageFormat::WebP, ImageFormat::Gif];


fn maybe_crop(to_dimensions: Option<(NonZeroU32, NonZeroU32)>, decoded: DynamicImage) -> DynamicImage {
    match to_dimensions {
        None => {
            decoded
        },
        Some((to_w_nz, to_h_nz)) => {
            let (current_w, current_h) = decoded.dimensions();
            let (to_w, to_h) = (to_w_nz.get(), to_h_nz.get());

            // if we need to downscale
            if current_w > to_w || current_h > to_h {
                // triangle fast and ok quality
                decoded.resize_to_fill(to_w.into(), to_h.into(), FilterType::Triangle)
            } 
            // otherwise we crop to the aspect ratio while maintaining 1 dimension
            else {
                let to_aspect_ratio = to_w as f32 / to_h as f32;
                let from_aspect_ratio = current_w as f32 / current_h as f32;

                let (crop_w, crop_h) = if from_aspect_ratio > to_aspect_ratio {
                    // source width is to wide: height is the limiting factor
                    ((current_h as f32 * to_aspect_ratio) as u32, current_h)
                } else {
                    // source height is too tall: width is the limiting factor
                    (current_w, (current_w as f32 / to_aspect_ratio) as u32)
                };

                let x = (current_w - crop_w) / 2;
                let y = (current_h - crop_h) / 2;
                decoded.crop_imm(x, y, crop_w, crop_h)
            }

        }
    }
}


pub fn transcode<'i, 'o, R, W>(
    mut input: R,
    input_format: Option<ImageFormat>,
    output_format: ImageFormat,
    output: &'o mut W,
    to_dimensions: Option<(NonZeroU32, NonZeroU32)>,
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

    // short circuit if input is not animated
    if ! ANIMATED_FORMATS.contains(&format) {
        let decoded = reader.decode()?;
        let maybe_cropped = maybe_crop(to_dimensions, decoded);

        maybe_cropped.write_to(output, output_format)?; 
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
                return Ok(transcode_animated(apng, output, output_format, dimensions, to_dimensions)?);
            }
        }
        ImageFormat::Gif => {
            let gif = GifDecoder::new(&mut input)?;
            let dimensions = gif.dimensions();
            return Ok(transcode_animated(gif, output, output_format, dimensions, to_dimensions)?);
        }
        ImageFormat::WebP => {
            let webp = WebPDecoder::new(&mut input)?;
            if webp.has_animation() {
                let dimensions = webp.dimensions();
                return Ok(transcode_animated(webp, output, output_format, dimensions, to_dimensions)?);
            }

        }
        _ => {unreachable!()},
    }

    // fall back to dynamic handling when its not animated

    // we need to reset the cursor to the start
    input.seek(io::SeekFrom::Start(0)).ok().ok_or(ConversionError::Unknown("Failed to reset seek position"))?;

    let reader: ImageReader<&mut R> = ImageReader::with_format(&mut input, format);

    let decoded = reader.decode()?;


    let maybe_cropped = maybe_crop(to_dimensions, decoded);

    maybe_cropped.write_to(output, output_format)?; 


    Ok(())
}


fn transcode_animated<'i, 'o, A, W>(
    animated: A,
    mut output: W,
    output_format: ImageFormat,
    dimensions: (u32, u32),
    to_dimensions: Option<(NonZeroU32, NonZeroU32)>
) -> Result<(), ConversionError>
where A: AnimationDecoder<'i>, W: io::Seek + io::Write + 'o
{
    let (width, height) = match to_dimensions {
        Some(to) => (to.0.get(), to.1.get()),
        None => dimensions,
    };
    let frames = animated.into_frames();


    match output_format {
        ImageFormat::WebP  => {
            let mut config = WebPConfig::new().map_err(|_| {ConversionError::Unknown("Could not create webp config")})?;
            config.alpha_compression = 1;
            config.quality = 90f32;
            let mut encoder = AnimEncoder::new(width, height, &config);

            let mut timestamp: u32 = 0;
            let frames_with_time = frames.map(|frame_res| {
                let f = frame_res?;
                let delay: (u32, u32) = f.delay().numer_denom_ms();

                let image = maybe_crop(to_dimensions, DynamicImage::from(f.into_buffer()));

                let r = (image, timestamp.clone());
                let delay_ms = (delay.0 as f32 / delay.1 as f32) as u32;
                timestamp += delay_ms;
                Ok::<(DynamicImage, u32), ImageError>(r)

            }).collect::<Result<Vec<(DynamicImage, u32)>, ImageError>>()?;

            for (frame, time) in &frames_with_time {

                let aframe = AnimFrame::from_image(
                    frame,
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