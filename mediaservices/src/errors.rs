use std::io::{ErrorKind, Error};

use aws_sdk_s3::{error::SdkError, operation::put_object::PutObjectError};
use image::{ImageError, error::{DecodingError, EncodingError, LimitErrorKind, UnsupportedErrorKind}};
use tokio::task::JoinError;
use tonic::Status;
use webp::AnimEncodeError;


pub type MSResult<T> = Result<T, MSError>;

pub enum MSError {
    ConversionError(ConversionError),
    BadUserInput(&'static str),
    BadInternalInput(&'static str),
    UploadError,
    Cancelled,
    Unknown
}

impl<R> From<SdkError<PutObjectError, R>> for MSError {
    fn from(_: SdkError<PutObjectError, R>) -> Self {
        Self::UploadError
    }
}

impl From<ConversionError> for MSError {
    fn from(value: ConversionError) -> Self {
        Self::ConversionError(value)
    }
}

impl From<JoinError> for MSError {
    fn from(value: JoinError) -> Self {
        if value.is_cancelled() {
            Self::Cancelled
        } else {
            Self::Unknown
        }
    }
}



impl From<MSError> for Status {
    fn from(value: MSError) -> Self {
        match value {
            MSError::ConversionError(conversion_error) => conversion_error.into(),
            MSError::Cancelled => Self::aborted("Operation cancelled"),
            MSError::Unknown => Self::internal("Unknown internal error"),
            MSError::BadUserInput(s) => Self::invalid_argument(s),
            MSError::BadInternalInput(s) => Self::internal(s),
            MSError::UploadError => Self::internal("S3 upload failed"),
        }
    }
}

impl From<ConversionError> for Status {
    fn from(value: ConversionError) -> Self {
        match value {
            ConversionError::IoError(error_kind) =>
                Status::internal(format!("{error_kind:?}")),
            ConversionError::UnknownInputFormat(decoding_error) =>
                Status::invalid_argument(format!("{decoding_error:?}")),
            ConversionError::UnsupportedInput(unsupported_error_kind) => 
                Status::invalid_argument(format!("{unsupported_error_kind:?}")),
            ConversionError::IncompatibleFormats(encoding_error) =>
                Status::invalid_argument(format!("{encoding_error:?}")),
            ConversionError::ResourceConstraint(limit_error_kind) =>
                Status::invalid_argument(format!("{limit_error_kind:?}")),
            ConversionError::Unknown=>
                Status::internal("Unknown conversion error"),
            ConversionError::NoInputFormat => Status::invalid_argument("Unkown format"),

            ConversionError::BadFrame(m) => Status::invalid_argument(m)
        }
    }
}



pub enum ConversionError {
    IoError(ErrorKind),
    UnknownInputFormat(DecodingError),
    /// Input 
    UnsupportedInput(UnsupportedErrorKind),
    /// Could not convert input format to output format
    IncompatibleFormats(EncodingError),
    /// Out of resources
    ResourceConstraint(LimitErrorKind),

    // could not parse a frame
    BadFrame(String),

    NoInputFormat,

    Unknown,
}

impl From<Error> for ConversionError {
    fn from(value: Error) -> Self {
        Self::IoError(value.kind())
    }
}

impl From<AnimEncodeError> for ConversionError {
    fn from(value: AnimEncodeError) -> Self {
        Self::BadFrame(format!("{value:?}"))
    }
}

impl From<ImageError> for ConversionError {
    fn from(value: ImageError) -> Self {
        match value {
            ImageError::Decoding(decoding_error) => ConversionError::UnknownInputFormat(decoding_error),
            ImageError::Encoding(encoding_error) => ConversionError::IncompatibleFormats(encoding_error),
            ImageError::Parameter(_) => ConversionError::Unknown,
            ImageError::Limits(limit_error) => ConversionError::ResourceConstraint(limit_error.kind()),
            ImageError::Unsupported(unsupported_error) => ConversionError::UnsupportedInput(unsupported_error.kind()),
            ImageError::IoError(error) => ConversionError::IoError(error.kind()),
        }
    }
} 
