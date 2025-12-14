from dataclasses import asdict

from fastapi import FastAPI, Request
from starlette.middleware import Middleware

from typing import Literal

import api.middleware as middleware
from api.models.session import Session
from api.crypto.session import encode_jose_session
from api.routes.account.account import AccountRouter

middlewares = (
    Middleware(middleware.JWTMiddleware),
)

app = FastAPI(middleware=middlewares)

app.include_router(AccountRouter, prefix="/account")


@app.get("/")
async def root() -> dict[Literal["hello"], Literal["world"]]:
    return {"hello": "world"}

@app.get("/auth")
async def auth_test(request: Request) -> dict[str, object]:
    session: Session | None = request.state.session
    return {
        "session": asdict(session) if session else session
    }

@app.get("/session")
async def session(request: Request) -> dict[str, object]:

    return {
        "token": encode_jose_session(Session(314).to_encode())
    }

