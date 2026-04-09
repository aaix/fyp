from typing import cast

import random
from enum import IntEnum, IntFlag, auto

from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpcgen import gc_pb2_grpc
from shared.py.grpcgen.gc_pb2 import *
from shared.py.grpc.lazy import DataservicesLazyGRPC

CONF_NUM_BUCKETS = 1


class GarbageType(IntEnum):
    CHANNEL = 1
    POST = 2

class GarbageFlags(IntFlag):
    LARGE = auto()


def calculate_bucket() -> int:
    return random.randint(0, CONF_NUM_BUCKETS - 1)


async def file_for_gc(grpc: DataservicesLazyGRPC[gc_pb2_grpc.GarbageServiceStub], object_id: id_t, garbage_type: GarbageType, flags: GarbageFlags | None = None):
    stub = grpc()
    bucket = calculate_bucket()

    flag_value = flags.value if flags is not None else 0

    cast(FileGarbageResponse, await stub.FileForCollection(FileGarbageRequest(
        bucket=bucket,
        object_id=id_puuid(object_id),
        garbage_type=garbage_type.value,
        garbage_flags=flag_value,
    )))

async def read_gc(grpc: DataservicesLazyGRPC[gc_pb2_grpc.GarbageServiceStub], bucket: int, after: id_t, limit: int) -> GarbageResponse:
    stub = grpc()
    return cast(GarbageResponse, await stub.ReadGarbage(ReadGarbageRequest(
        bucket=bucket,
        after=id_puuid(after),
        limit=limit
    )))

async def delete_garbage(grpc: DataservicesLazyGRPC[gc_pb2_grpc.GarbageServiceStub], bucket: int, object_id: id_t):
    stub = grpc()
    cast(DeleteGarbageResponse, await stub.DeleteGarbage(DeleteGarbageRequest(
        bucket=bucket,
        object_id=id_puuid(object_id)
    )))