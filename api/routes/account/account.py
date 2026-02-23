from fastapi import APIRouter, Request
from uuid import UUID

import grpc
from grpc import RpcError
from grpc import StatusCode

from api import *
from api import ApiErrExc
from api.crypto.models import PEMPublicKey
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import user_pb2_grpc
from shared.py.grpcgen import user_pb2
from shared.py.grpcgen.plib_pb2 import pUUID
from api.models.common import Username
from api.models.session import Session
from api.routes.account.models import *
from api.utils import unwrap

from shared.py.grpc.id import id_compare, puuid_str, str_puuid, uuid_puuid


from typing import cast

CONF_USER_MAX_DEVICES = 8

discovery = DiscoveryManager()

AccountRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcdevice = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserDeviceServiceStub)

async def read_devices(user_id: str | pUUID, count_only=False) -> user_pb2.ReadDevicesResponse:
    return cast(user_pb2.ReadDevicesResponse, await grpcdevice.stub.ReadDevices(user_pb2.ReadDevicesRequest(
        user_id=user_id if isinstance(user_id, pUUID) else str_puuid(user_id),
        count_only=count_only,
    )))

@AccountRouter.post("/signup")
async def signup(r: Request, body: SignupBody) -> SignupResponse:

    try:
        res = cast(user_pb2.ReadUserResponse, await grpcuser.stub.CreateUser(user_pb2.CreateUserRequest(
            username=body.username,
            email=body.email,
            public_key=body.account_public_key.to_bytes()
        )))
    except RpcError as e:
        if e.code() == StatusCode.ALREADY_EXISTS:
            raise ApiErrExc(errors.BadRequest("username already exists", api_error_code=errors.ERROR_ALREADY_EXISTS))
        else:
            raise e
    
    session = Session.new(user_id=puuid_str(res.user_id) or unwrap())
    
    try:
        device = await new_device(r, session, body.device)
    except Exception as e:
        cast(user_pb2.DeleteUserResponse, await grpcuser.stub.DeleteUser(user_pb2.DeleteUserRequest(
            user_id=res.user_id
        )))
        raise ApiErrExc(errors.InternalServerError("Invalid transient state encountered during transaction"))



    return SignupResponse(
        user_id=puuid_str(res.user_id) or unwrap(),
        username=res.username,
        email=res.email,
        public_key=body.account_public_key,
        avatar_asset_id=puuid_str(res.avatar_asset_id),
        device=device
    )

@AccountRouter.get("/devicehandshake/{username}/{device_id}")
async def device_key_handshake(r: Request, username: Username, device_id: UUID) -> DeviceKeyResponse:

    try:
        user = cast(user_pb2.ReadUserResponse, await grpcuser.stub.ReadUserByUsername(user_pb2.ReadUserByUsernameRequest(
            username=username
        )))
    except RpcError as e:
        if e.code() == StatusCode.NOT_FOUND:
            raise ApiErrExc(errors.NotFound("no such user exists", api_error_code=errors.ERROR_NO_SUCH_USER))
        else:
            raise e

    res = await read_devices(user.user_id)

    for device in res.devices:
        if id_compare(device.device_id, device_id):
            break
    else:
        raise ApiErrExc(errors.NotFound("No such device"))

    return DeviceKeyResponse(
        encrypted_account_key=device.encrypted_account_key,
        account_public_key=PEMPublicKey.from_bytes(user.public_key)
    )


@AccountRouter.get("/devices")
async def get_all_devices(r: Request, s: SessionParam) -> list[DeviceResponse]:

    res = await read_devices(s.user_id)

    devices = []
    for device in res.devices:
        devices.append(DeviceResponse.from_rpc(device, s.user_id))
    return devices



@AccountRouter.post("/device")
async def new_device(r: Request, s: SessionParam, body: NewDeviceBody) -> DeviceResponse:

    res = await read_devices(s.user_id, count_only=True)

    if res.device_count >= CONF_USER_MAX_DEVICES:
        raise ApiErrExc(errors.BadRequest("Device limit reached", api_error_code=errors.ERROR_LIMIT_REACHED))

    res = cast(user_pb2.DeviceObjectResponse, await grpcdevice.stub.CreateDevice(user_pb2.CreateDeviceRequest(
        user_id=str_puuid(s.user_id),
        device_name=body.name,
        public_key=body.public_key.to_bytes(),
        encrypted_account_key=body.encrypted_private_key,
    )))

    return DeviceResponse.from_rpc(
        res,
        s.user_id,
        body.public_key
    )

@AccountRouter.delete("/device/{device_id}")
async def delete_device(r: Request, s: SessionParam, device_id: UUID) -> None:

    res = await read_devices(s.user_id, count_only=True)

    if res.device_count <= 1:
        raise ApiErrExc(errors.BadRequest("Unable to delete a users only device", api_error_code=errors.ERROR_LIMIT_REACHED))

    
    res = cast(user_pb2.DeleteDeviceResponse, await grpcdevice.stub.DeleteDevice(user_pb2.DeleteDeviceRequest(
        user_id=str_puuid(s.user_id),
        device_id=uuid_puuid(device_id)
    )))


@AccountRouter.get("/@me")
async def my_account(s: SessionParam) -> AccountResponse:
    res = cast(user_pb2.ReadUserResponse, await grpcuser.stub.ReadUser(user_pb2.ReadUserRequest(
        user_id=str_puuid(s.user_id)
    )))

    return AccountResponse(
        user_id=s.user_id,
        avatar_asset_id=puuid_str(res.avatar_asset_id),
        public_key=PEMPublicKey.from_bytes(res.public_key),
        username=res.username,
        email=res.email,
    )
