from fastapi import APIRouter, Request
from grpc import RpcError, StatusCode


from api.crypto import session as session_crypto
from api.grpc.lazy import LazyGRPC
from api.grpcgen import user_pb2_grpc
from api.grpcgen import user_pb2
from api.discovery import DiscoveryManager
from api.middleware.auth import SessionParam
from api.models.session import Session
from api.responses import ApiErrExc
from api.responses.errors import *
from api.routes.session.models import *
from api.logger import log

from typing import cast

from api.utils import puuid_str, unwrap

discovery = DiscoveryManager()

SessionRouter = APIRouter()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)


@SessionRouter.post("/login")
async def login(request: Request, body: LoginBody) -> LoginResponse:
    try:
        user = cast(user_pb2.ReadUserResponse, await grpcuser.stub.ReadUserByUsername(user_pb2.ReadUserByUsernameRequest(
            username=body.username
        )))
    except RpcError as e:
        if e.code() == StatusCode.NOT_FOUND:
            raise ApiErrExc(NotFound("no such user exists", api_error_code=ERROR_NO_SUCH_USER))
        else:
            raise e

    user_id = puuid_str(user.user_id) or unwrap()

    session = Session.new(user_id=user_id)
    token = session_crypto.encode_jose_session(session.to_encode())

    return LoginResponse(
        encrypted_session=session_crypto.encrypt_session_with_key(token, user.public_key)
    )
    
@SessionRouter.get("/renew")
async def renew(request: Request, s: SessionParam):
    log(f"Session is {s}")
    return