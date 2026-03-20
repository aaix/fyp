use std::io;

use image::{ImageFormat, ImageReader};

use crate::errors::ConversionError;



pub fn transcode<'i, 'o, R, W>(
    input: R,
    input_format: Option<ImageFormat>,
    output_format: ImageFormat,
    output_writer: &'o mut W,
) -> Result<(), ConversionError>
where R: 'i + io::BufRead + io::Seek, W: 'o + io::Write + io:: Seek,
{

    let mut reader  = ImageReader::new(input).with_guessed_format()?;

    if reader.format().is_none() && let Some(format) = input_format {
        reader.set_format(format);
    }

    let decoded = reader.decode()?;
    decoded.write_to(output_writer, output_format)?; 

    Ok(())
}