

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError 
from starlette.middleware import Middleware

from typing import Literal

import api.middleware as middleware
from api import  ApiErrExc
from api.middleware import exception_handlers
from api.routes.account.account import AccountRouter

# middlewares
middlewares = ( # outer
    Middleware(middleware.JWTMiddleware), 
) # inner

app = FastAPI(middleware=middlewares)

# routers
app.include_router(AccountRouter, prefix="/account")

# exception handlers
app.add_exception_handler(RequestValidationError, exception_handlers.request_validation_error_handler)
app.add_exception_handler(ApiErrExc, exception_handlers.api_err_exc_error_handler)

@app.get("/")
async def root() -> dict[Literal["hello"], Literal["world"]]:
    return {"hello": "world"}

