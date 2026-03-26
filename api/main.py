import asyncio
from typing import Literal

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError 
from fastapi.middleware.cors import CORSMiddleware
from grpc import RpcError
from starlette.middleware import Middleware



from api import tracing
from api.middleware.auth import JWTMiddleware
from api.middleware.misc import HeaderValidationMiddleware
from api.middleware.tracing import TracingMiddleware
from api import *
from api.responses import SuccessResponse
from api.middleware import exception_handlers

# routers
from api.routes.account.account import AccountRouter
from api.routes.channel.message import MessageRouter
from api.routes.session.session import SessionRouter
from api.routes.user.user import UserRouter
from api.routes.channel.channel import ChannelRouter

# shared
from shared.py.intraservice.discoverystore import DATASERVICES_SERVICE, GATEWAY_SERVICE
from shared.py.intraservice.discoverystore.client import BigPictureClientServiceFactory

loop = asyncio.get_event_loop()

discovery = DiscoveryManager()
gateway_bigpicture = BigPictureClientServiceFactory(GATEWAY_SERVICE)
dataservices_bigpicture = BigPictureClientServiceFactory(DATASERVICES_SERVICE) 

# middlewares
middlewares = ( # outer
    Middleware(
        CORSMiddleware, 
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["Authorization"],
    ),
    Middleware(HeaderValidationMiddleware),
    Middleware(JWTMiddleware),
    Middleware(TracingMiddleware),
) # inner


app = FastAPI(
    middleware=middlewares,
    default_response_class=SuccessResponse,
    on_startup=(
        gateway_bigpicture.valkey_connect,
        dataservices_bigpicture.valkey_connect
    )
)

# routers
app.include_router(AccountRouter, prefix="/account")
app.include_router(SessionRouter, prefix="/session")
app.include_router(UserRouter, prefix="/user")
app.include_router(ChannelRouter, prefix="/chat")
app.include_router(MessageRouter, prefix="/chat")

# exception handlers
app.add_exception_handler(RequestValidationError, exception_handlers.request_validation_error_handler)
app.add_exception_handler(ApiErrExc, exception_handlers.api_err_exc_error_handler)
app.add_exception_handler(Exception, exception_handlers.unhandled_exception_handler)
app.add_exception_handler(404, exception_handlers.not_found_exception_handler)
app.add_exception_handler(RpcError, exception_handlers.grpc_error_handler)

@app.get("/")
async def root() -> dict[Literal["hello"], Literal["world"]]:
    return {"hello": "world"}

tracing.instrument_fastapi_app(app)


