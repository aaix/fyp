

import ssl
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError 
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware

from typing import Literal

import api.middleware as middlewares
from api import  ApiErrExc
from api.responses import SuccessResponse
from api.middleware import exception_handlers
from api.discovery import DiscoveryManager

# routers
from api.routes.account.account import AccountRouter
from api.routes.session.session import SessionRouter

discovery = DiscoveryManager()

# middlewares
middlewares = ( # outer
    Middleware(
        CORSMiddleware, 
        allow_origins=["http://localhost:5500"],
        allow_methods=["*"],
        allow_headers=["Authorization"],
    ),
    Middleware(middlewares.HeaderValidationMiddleware),
    Middleware(middlewares.JWTMiddleware), 
) # inner

ssl_context = None
if discovery.is_prod():
    print("Using ssl context")
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain("/az7/api/certs/cert.pem", keyfile="/az7/api/certs/key.pem")

app = FastAPI(
    middleware=middlewares,
    default_response_class=SuccessResponse,
    ssl_context=ssl_context
)

# routers
app.include_router(AccountRouter, prefix="/account")
app.include_router(SessionRouter, prefix="/session")

# exception handlers
app.add_exception_handler(RequestValidationError, exception_handlers.request_validation_error_handler)
app.add_exception_handler(ApiErrExc, exception_handlers.api_err_exc_error_handler)
app.add_exception_handler(Exception, exception_handlers.unhandled_exception_handler)
app.add_exception_handler(404, exception_handlers.not_found_exception_handler)

@app.get("/")
async def root() -> dict[Literal["hello"], Literal["world"]]:
    return {"hello": "world"}

