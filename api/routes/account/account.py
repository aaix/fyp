from fastapi import APIRouter, Request

import grpc
from grpc import RpcError
from grpc import StatusCode

from api import ApiErrExc
from api.responses.errors import BadRequest, ERROR_ALREADY_EXISTS, ERROR_INVALID_KEY
from api.grpc import user_pb2_grpc
from api.grpc import user_pb2
from api.utils import puuid_str, unwrap
from api.discovery import DiscoveryManager
from api.routes.account.models import *

discovery = DiscoveryManager()

from typing import cast

AccountRouter = APIRouter()

channel = grpc.aio.insecure_channel(discovery.discover_dataservices())
grpcuser = user_pb2_grpc.UserServiceStub(channel)

@AccountRouter.post("/signup")
async def signup(request: Request, body: SignupBody) -> SignupResponse:

    if len(body.public_key) == 0:
        raise ApiErrExc(BadRequest("incorrect key length", api_error_code=ERROR_INVALID_KEY))

    try:
        res = cast(user_pb2.ReadUserResponse, await grpcuser.CreateUser(user_pb2.CreateUserRequest(
            username=body.username,
            email=body.email,
            public_key=body.public_key
        )))
    except RpcError as e:
        if e.code() == StatusCode.ALREADY_EXISTS:
            raise ApiErrExc(BadRequest("username already exists", api_error_code=ERROR_ALREADY_EXISTS))
        else:
            raise e


    return SignupResponse(
        user_id=puuid_str(res.user_id) or unwrap(),
        username=res.username,
        email=res.email,
        public_key=res.public_key,
        avatar_asset_id=puuid_str(res.avatar_asset_id)
    )