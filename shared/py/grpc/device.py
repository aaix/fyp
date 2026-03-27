from typing import cast

from shared.py.grpc.id import id_compare, id_t, id_puuid
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpcgen.user_pb2_grpc import UserDeviceServiceStub

async def read_devices(lazy: DataservicesLazyGRPC[UserDeviceServiceStub], user_id: id_t, count_only=False) -> user_pb2.ReadDevicesResponse:
    stub = await lazy(user_id)
    return cast(user_pb2.ReadDevicesResponse, await stub.ReadDevices(user_pb2.ReadDevicesRequest(
        user_id=id_puuid(user_id),
        count_only=count_only,
    )))


async def get_device(lazy: DataservicesLazyGRPC[UserDeviceServiceStub], user_id: id_t, device_id: id_t) -> user_pb2.DeviceObjectResponse:
    stub = await lazy(user_id)
    return cast(user_pb2.DeviceObjectResponse, await stub.ReadDevice(user_pb2.ReadDeviceRequest(
        user_id=id_puuid(user_id),
        device_id=id_puuid(device_id)
    )))

async def create_device(
        lazy:DataservicesLazyGRPC[UserDeviceServiceStub],
        user_id: id_t,
        device_name: str,
        public_key: bytes,
        encrypted_account_key: bytes
    ) -> user_pb2.DeviceObjectResponse:
    stub = await lazy(user_id)
    return cast(user_pb2.DeviceObjectResponse, await stub.CreateDevice(user_pb2.CreateDeviceRequest(
        user_id=id_puuid(user_id),
        device_name=device_name,
        public_key=public_key,
        encrypted_account_key=encrypted_account_key,
    )))