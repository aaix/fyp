from shared.py.grpc.id import id_t, id_uuid

async def delete_asset(*, public: bool, bucket_id: id_t, asset_id: id_t): ...


def asset_path(*, bucket_id: id_t, asset_id: id_t) -> str:
    return f"{id_uuid(bucket_id)}/{id_uuid(asset_id)}"