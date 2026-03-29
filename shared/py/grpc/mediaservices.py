from collections.abc import AsyncGenerator
from typing import cast

from fastapi import UploadFile

from shared.py import asset
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen.asset_pb2 import Asset
from shared.py.grpcgen.media_pb2 import MediaInput, TransformImageRequest, TransformImageResponse
from shared.py.grpcgen import media_pb2_grpc

CHUNK_SIZE = 1 * 1000 * 1000 # 1mb


async def async_bytes_generator(first: MediaInput, data: UploadFile) -> AsyncGenerator[MediaInput]:
    yield first
    while b := await data.read(CHUNK_SIZE):
        yield MediaInput(chunk=b)


async def stream_to(grpc: LazyGRPC[media_pb2_grpc.TransformerServiceStub], data: UploadFile) -> None:
    grpc.stub.TransformVideo()



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
) -> TransformImageResponse:
    
    width, height = dimensions or (None, None)
    
    first = MediaInput(asset=Asset(
        path=asset.asset_path(bucket_id=bucket_id, asset_id=asset_id),
        public=public,
        content_type=mime_in,
        output_type=mime_out,
        input_size=data.size,
        output_height=height,
        output_width=width,
    ))

    return cast(TransformImageResponse, await grpc.stub.TransformImage(async_bytes_generator(first, data)))

    return cast(TransformImageResponse, await grpc.stub.TransformImage(TransformImageRequest(
        asset=Asset(
            path=asset.asset_path(bucket_id=bucket_id, asset_id=asset_id),
            public=public,
            content_type=mime_in,
            output_type=mime_out,
        ),
        data=data,
    )))