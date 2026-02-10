from fastapi import APIRouter, Request

import grpc
from grpc import RpcError
from grpc import StatusCode

from api import *
from api import ApiErrExc
from api.crypto.models import PEMPublicKey
from api.grpc.lazy import LazyGRPC
from api.grpcgen import user_pb2_grpc
from api.grpcgen import user_pb2
from api.utils import puuid_str, unwrap
from api.routes.account.models import *

from typing import cast

discovery = DiscoveryManager()


AccountRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)

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
async def device_key_handshake(r: Request, s: SessionParam, device_id: str): ...

@AccountRouter.post("/device")
async def new_device(r: Request, s: SessionParam, body: NewDeviceBody) -> DeviceResponse: ...