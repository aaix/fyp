from collections.abc import Iterable


import asyncio
import threading
import aioboto3
from pydantic import BaseModel


from shared.py.discovery import DiscoveryManager
from shared.py.grpc.id import id_t, id_uuid
from shared.py.tracing import tracer

discovery = DiscoveryManager()

ENDPOINT_URL, ACCESS_KEY_ID, ACCESS_KEY_SECRET = discovery.find_s3_creds()
PUBLIC_BUCKET, PRIVATE_BUCKET = discovery.find_s3_buckets()

__all__ = (
    "client",
    "PUBLIC_BUCKET",
    "PRIVATE_BUCKET",
    "generate_signed_put",
)

session = aioboto3.Session(
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=ACCESS_KEY_SECRET,
)



_lock = asyncio.Lock()
local = threading.local()
async def client():
    
    if hasattr(local, "asset_client"):
        return local.asset_client

    async with _lock:
        if hasattr(local, "asset_client"):
            return local.asset_client
        local.asset_client = await session.client("s3", endpoint_url=ENDPOINT_URL, region_name="auto").__aenter__()
    return local.asset_client

@tracer.start_as_current_span("s3.delete_asset")
async def delete_asset(*, public: bool, bucket_id: id_t, asset_id: id_t, extra: str | None = None):

    if public:
        bucket = PUBLIC_BUCKET
    else:
        bucket = PRIVATE_BUCKET


    path = asset_path(bucket_id=bucket_id, asset_id=asset_id)

    if extra:
        path += extra

    s3 = await client()
    await s3.delete_object(Bucket=bucket, Key=path)


@tracer.start_as_current_span("s3.delete_many_assets")
async def delete_many_assets(*, public: bool, bucket_id: id_t, asset_ids: Iterable[id_t]):

    if public:
        bucket = PUBLIC_BUCKET
    else:
        bucket = PRIVATE_BUCKET


    objects = [
        {
            "Key": asset_path(bucket_id=bucket_id, asset_id=asset_id)
        } for asset_id in asset_ids
    ]

    s3 = await client()
    await s3.delete_objects(Bucket=bucket, Delete={"Objects": objects})


def asset_path(*, bucket_id: id_t, asset_id: id_t) -> str:
    return f"{id_uuid(bucket_id)}/{id_uuid(asset_id)}"


async def generate_signed_get(
    *,
    public: bool,
    bucket_id: id_t,
    asset_id: id_t,
    duration: int = 120,
    version: str | None = None
) -> str:
    s3 = await client()

    path = asset_path(
        bucket_id=bucket_id,
        asset_id=asset_id
    )
    if version:
        path += version

    if public:
        bucket = PUBLIC_BUCKET
    else:
        bucket = PRIVATE_BUCKET


    with tracer.start_as_current_span("s3.generate_signed") as span:
        presigned =  await s3.generate_presigned_url(
            'get_object',
            Params={
                "Bucket": bucket,
                "Key": path,
            },
            ExpiresIn=duration,
        )
        span.set_attribute("az.shared.s3.signed", str(presigned))
    
    return presigned




async def generate_signed_put(
    *,
    public: bool,
    bucket_id: id_t,
    asset_id: id_t,
    duration: int = 120,
    mime_type: str,
    size: int,
) -> str:
    s3 = await client()

    path = asset_path(
        bucket_id=bucket_id,
        asset_id=asset_id
    )

    if public:
        bucket = PUBLIC_BUCKET
    else:
        bucket = PRIVATE_BUCKET


    with tracer.start_as_current_span("s3.generate_signed") as span:
        presigned =  await s3.generate_presigned_url(
            'put_object',
            Params={
                "Bucket": bucket,
                "Key": path,
                "ContentType":mime_type,
                "ContentLength": size,
            },
            ExpiresIn=duration,
        )
        span.set_attribute("az.shared.s3.signed", str(presigned))
    
    return presigned


class PresignedParams(BaseModel):
    url: str
    fields: dict[str, str]
