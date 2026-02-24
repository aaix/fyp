from typing import Literal

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError 
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware


import api.middleware as middlewares
from api import *
from api.responses import SuccessResponse
from api.middleware import exception_handlers

# routers
from api.routes.account.account import AccountRouter
from api.routes.session.session import SessionRouter

discovery = DiscoveryManager()

# middlewares
middlewares = ( # outer
    Middleware(
        CORSMiddleware, 
        allow_origins=["http://localhost:5500", "http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["Authorization"],
    ),
    Middleware(middlewares.HeaderValidationMiddleware),
    Middleware(middlewares.JWTMiddleware), 
) # inner


app = FastAPI(
    middleware=middlewares,
    default_response_class=SuccessResponse,
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

