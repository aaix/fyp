from fastapi import APIRouter, Request
from grpc import RpcError, StatusCode


from api import *
from api.models.session import Session
from api.routes.session.models import *
from api.utils import UserNotFoundRpcHandler, unwrap

from shared.py.crypto import session as session_crypto
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.user import get_user_by_username
from shared.py.grpcgen import user_pb2_grpc
from shared.py.grpc.id import puuid_uuid

discovery = DiscoveryManager()

SessionRouter = APIRouter()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)


@SessionRouter.post("/login")
async def login(body: LoginBody) -> LoginResponse:
    with UserNotFoundRpcHandler(body.username):
        user = await get_user_by_username(grpcuser, body.username)

    user_id = puuid_uuid(user.user_id) or unwrap()

    session = Session.new(user_id=user_id)
    token = session_crypto.encode_jose_session(session.to_encode())

    return LoginResponse(
        encrypted_session=session_crypto.encrypt_session_with_key(token, user.public_key),
        user_id=session.user_id
    )
    
@SessionRouter.get("/renew")
async def renew(request: Request, s: SessionParam):
    log(f"Session is {s}")
    return