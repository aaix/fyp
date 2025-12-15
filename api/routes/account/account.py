from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

import grpc
from grpc import RpcError
from grpc import StatusCode

from api import ApiErrExc
from api.utils import Base64Input, Base64Output
from api.responses.errors import BadRequest, ERROR_ALREADY_EXISTS
from api.grpc import user_pb2_grpc
from api.grpc import user_pb2
from api.utils import puuid_str

from typing import Annotated

AccountRouter = APIRouter()

channel = grpc.aio.insecure_channel('localhost:3114')
grpcuser = user_pb2_grpc.UserServiceStub(channel)


class SignupBody(BaseModel):
    username: Annotated[str, Field(max_length=16, min_length=3)]
    email: Annotated[str, Field(min_length=6, max_length=64)]
    public_key: Base64Input


class SignupResponse(BaseModel):
    user_id: str
    username: str
    email: str
    public_key: Base64Output
    avatar_asset_id: str | None


@AccountRouter.post("/signup")
async def signup(request: Request, body: SignupBody) -> SignupResponse:
    try:
        res: user_pb2.ReadUserResponse = await grpcuser.CreateUser(user_pb2.CreateUserRequest(
            username=body.username,
            email=body.email,
            public_key=body.public_key
        ))
    except RpcError as e:
        if e.code() == StatusCode.ALREADY_EXISTS:
            raise ApiErrExc(BadRequest("username already exists", api_error_code=ERROR_ALREADY_EXISTS))
        else:
            raise e

    
    return SignupResponse(
        user_id=puuid_str(res.user_id),
        username=res.username,
        email=res.email,
        public_key=res.public_key,
        avatar_asset_id=puuid_str(res.avatar_asset_id)
    )