import asyncio
import aioboto3


from shared.py.discovery import DiscoveryManager
from shared.py.grpc.id import id_t, id_uuid
from shared.py.tracing import tracer

discovery = DiscoveryManager()

ENDPOINT_URL, ACCESS_KEY_ID, ACCESS_KEY_SECRET = discovery.find_s3_creds()
PUBLIC_BUCKET, PRIVATE_BUCKET = discovery.find_s3_buckets()

session = aioboto3.Session(
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=ACCESS_KEY_SECRET,
)


_client = None
_lock = asyncio.Lock()
async def client():
    global _client
    if _client is not None: return _client

    async with _lock:
        if _client is not None: return _client
        _client = await session.client("s3", endpoint_url=ENDPOINT_URL, region_name="auto").__aenter__()
    return _client

@tracer.start_as_current_span("s3.delete_asset")
async def delete_asset(*, public: bool, bucket_id: id_t, asset_id: id_t):

    if public:
        bucket = PUBLIC_BUCKET
    else:
        bucket = PRIVATE_BUCKET


    path = asset_path(bucket_id=bucket_id, asset_id=asset_id)

    s3 = await client()
    await s3.delete_object(Bucket=bucket, Key=path)


def asset_path(*, bucket_id: id_t, asset_id: id_t) -> str:
    return f"{id_uuid(bucket_id)}/{id_uuid(asset_id)}"