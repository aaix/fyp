from typing import cast

from shared.py.grpc.id import id_compare, id_t, id_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import user_pb2
from shared.py.grpcgen.user_pb2_grpc import UserDeviceServiceStub
from shared.py.pydantic.pem import PEMPublicKey

async def read_devices(lazy: LazyGRPC[UserDeviceServiceStub], user_id: id_t, count_only=False) -> user_pb2.ReadDevicesResponse:
    return cast(user_pb2.ReadDevicesResponse, await lazy.stub.ReadDevices(user_pb2.ReadDevicesRequest(
        user_id=id_puuid(user_id),
        count_only=count_only,
    )))

def find_device_by_id(devices: user_pb2.ReadDevicesResponse, device_id: id_t) -> None | user_pb2.DeviceObjectResponse:
    for device in devices.devices:
        if id_compare(device.device_id, device_id):
            return device

async def create_device(
        lazy:LazyGRPC[UserDeviceServiceStub],
        user_id: id_t,
        device_name: str,
        public_key: bytes,
        encrypted_account_key: bytes
    ) -> user_pb2.DeviceObjectResponse:
    return cast(user_pb2.DeviceObjectResponse, await lazy.stub.CreateDevice(user_pb2.CreateDeviceRequest(
        user_id=id_puuid(user_id),
        device_name=device_name,
        public_key=public_key,
        encrypted_account_key=encrypted_account_key,
    )))