from fastapi import APIRouter, Request
from uuid import UUID

import grpc
from grpc import RpcError
from grpc import StatusCode

from api import *
from api import ApiErrExc
from api.crypto.models import PEMPublicKey
from api.grpc.lazy import LazyGRPC
from api.grpcgen import user_pb2_grpc
from api.grpcgen import user_pb2
from api.utils import puuid_str, str_puuid, unwrap
from api.routes.account.models import *

from typing import cast

discovery = DiscoveryManager()


AccountRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcdevice = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserDeviceServiceStub)

@AccountRouter.post("/signup")
async def signup(request: Request, body: SignupBody) -> SignupResponse:


    try:
        res = cast(user_pb2.ReadUserResponse, await grpcuser.stub.CreateUser(user_pb2.CreateUserRequest(
            username=body.username,
            email=body.email,
            public_key=body.public_key.to_bytes()
        )))
    except RpcError as e:
        if e.code() == StatusCode.ALREADY_EXISTS:
            raise ApiErrExc(errors.BadRequest("username already exists", api_error_code=errors.ERROR_ALREADY_EXISTS))
        else:
            raise e


    return SignupResponse(
        user_id=puuid_str(res.user_id) or unwrap(),
        username=res.username,
        email=res.email,
        public_key=body.public_key,
        avatar_asset_id=puuid_str(res.avatar_asset_id)
    )

@AccountRouter.get("/devicehandshake/{device_id}")
async def device_key_handshake(r: Request, s: SessionParam, device_id: UUID) -> DeviceKeyResponse:
    res = cast(user_pb2.ReadDevicesResponse, await grpcdevice.stub.ReadDevices(user_pb2.ReadDevicesRequest(
        user_id=str_puuid(s.user_id)
    )))





@AccountRouter.post("/device")
async def new_device(r: Request, s: SessionParam, body: NewDeviceBody) -> DeviceResponse:

    res = cast(user_pb2.ReadDevicesResponse, await grpcdevice.stub.ReadDevices(user_pb2.ReadDevicesRequest(
        user_id=str_puuid(s.user_id),
        count_only=True,
    )))

    if res.device_count >= CONF_USER_MAX_DEVICES:
        raise ApiErrExc()

    res = cast(user_pb2.DeviceObjectResponse, await grpcdevice.stub.CreateDevice(user_pb2.CreateDeviceRequest(
        user_id=str_puuid(s.user_id),
        device_name=body.name,
        public_key=body.public_key.to_bytes(),
        encrypted_account_key=body.encrypted_private_key,
    )))

    return DeviceResponse(
        user_id=s.user_id,
        device_id=puuid_str(res.device_id) or unwrap(),
        device_name=res.device_name,
        device_public_key=body.public_key,
        encrypted_account_key=res.encrypted_account_key,
    )
    