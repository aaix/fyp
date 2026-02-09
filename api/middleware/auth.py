from typing import Annotated
from fastapi import Depends, Request, Response
from annotated_doc import Doc

from starlette.middleware.base import BaseHTTPMiddleware
from joserfc.errors import DecodeError

from collections.abc import Callable, Awaitable

from json import JSONDecodeError

from api.models import Session
from api.responses import ApiErrExc, errors
from api.crypto.session import decode_jose_session
from api.logger import log



__all__ = (
    "JWTMiddleware",
    "SessionParam",
)


class JWTMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if not (token := request.headers.get("Authorization")):
            request.state.session = None
            return await call_next(request)
        

        try:
            raw = decode_jose_session(token)
        except DecodeError:
            return errors.Unauthorized("Garbage authorization", api_error_code=errors.ERROR_GARBAGE_SESSION)

        try:
            session = Session.from_encode(raw)
        except TypeError, JSONDecodeError:
            return errors.Unauthorized("Invalid session", api_error_code=errors.ERROR_INVALID_SESSION)
        
        if err := session.validate():
            return err
        
        request.state.session = session
        return await call_next(request)

def raise_for_session(request: Request) -> Session:
    if not (session := request.state.session):
        raise ApiErrExc(errors.Forbidden(
            "Authentication required for this endpoint",
            api_error_code=errors.ERROR_AUTH_REQUIRED
        ))
    return session

SessionParam = Annotated[
    Session,
    Depends(raise_for_session),
    Doc("Annotated param to require authentication and provide the session")
]