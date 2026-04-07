from typing import cast

from collections.abc import AsyncGenerator


from fastapi import UploadFile
from grpc import RpcError, StatusCode

from api.responses import errors
from api.utils import RpcErrHandler
from shared.py import asset
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen.asset_pb2 import Asset
from shared.py.grpcgen.media_pb2 import MediaInput, TransformImageResponse, TransformVideoResponse
from shared.py.grpcgen import media_pb2_grpc


CHUNK_SIZE = 1 * 1000 * 1000 # 1mb


async def async_bytes_generator(first: MediaInput, data: UploadFile) -> AsyncGenerator[MediaInput]:
    yield first
    while b := await data.read(CHUNK_SIZE):
        yield MediaInput(chunk=b)


async def stream_to(grpc: LazyGRPC[media_pb2_grpc.TransformerServiceStub], data: UploadFile) -> None:
    grpc.stub.TransformVideo()



class MediaservicesErrHandler(RpcErrHandler):
    """Handle bad requests from mediaservices"""
    def __init__(self):
        super().__init__(
            StatusCode.INVALID_ARGUMENT,
            self.make_error
        )
    
    def make_error(self, exc: RpcError) -> errors.BadRequest:
        return errors.BadRequest(f"Invalid media input, message: {exc.details()}", api_error_code=errors.ERROR_BAD_MEDIA)


async def transform_image(
    grpc: LazyGRPC[media_pb2_grpc.TransformerServiceStub],
    *,
    public: bool,
    bucket_id: id_t,
    asset_id: id_t,
    mime_in: str | None,
    mime_out: str,
    data: UploadFile,
    dimensions: tuple[int, int] | None,
    thumb_dimensions: tuple[int, int] | None,
) -> TransformImageResponse:
    
    width, height = dimensions or (None, None)
    thumb_w, thumb_h = thumb_dimensions or (None, None)

    
    first = MediaInput(asset=Asset(
        path=asset.asset_path(bucket_id=bucket_id, asset_id=asset_id),
        public=public,
        content_type=mime_in,
        output_type=mime_out,
        input_size=data.size,
        output_height=height,
        output_width=width,
        thumb_max_height=thumb_h,
        thumb_max_width=thumb_w,
    ))

    with MediaservicesErrHandler():
        return cast(TransformImageResponse, await grpc.stub.TransformImage(async_bytes_generator(first, data)))

async def transform_video(
    grpc: LazyGRPC[media_pb2_grpc.TransformerServiceStub],
    *,
    public: bool,
    bucket_id: id_t,
    asset_id: id_t,
    mime_in: str | None,
    mime_out: str,
    data: UploadFile,
    dimensions: tuple[int, int] | None,
    thumb_dimensions: tuple[int, int] | None,
) -> TransformVideoResponse:
    width, height = dimensions or (None, None)
    thumb_w, thumb_h = thumb_dimensions or (None, None)
    
    first = MediaInput(asset=Asset(
        path=asset.asset_path(bucket_id=bucket_id, asset_id=asset_id),
        public=public,
        content_type=mime_in,
        output_type=mime_out,
        input_size=data.size,
        output_height=height,
        output_width=width,
        thumb_max_height=thumb_h,
        thumb_max_width=thumb_w,
    ))
    with MediaservicesErrHandler():
        return cast(TransformVideoResponse, await grpc.stub.TransformVideo(async_bytes_generator(first, data)))
