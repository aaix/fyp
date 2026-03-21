from typing import cast

from shared.py import asset
from shared.py.grpc.id import id_t
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen.asset_pb2 import Asset
from shared.py.grpcgen.media_pb2 import TransformImageRequest, TransformImageResponse
from shared.py.grpcgen import media_pb2_grpc

async def transform_image(
    grpc: LazyGRPC[media_pb2_grpc.TransformerServiceStub],
    *,
    public: bool,
    bucket_id: id_t,
    asset_id: id_t,
    mime_in: str | None,
    mime_out: str,
    data: bytes,
) -> TransformImageResponse:
    

    return cast(TransformImageResponse, await grpc.stub.TransformImage(TransformImageRequest(
        asset=Asset(
            path=asset.asset_path(bucket_id=bucket_id, asset_id=asset_id),
            public=public,
            content_type=mime_in,
            output_type=mime_out,
        ),
        data=data,
    )))