from typing import Annotated

from collections.abc import Callable, Awaitable
from json import JSONDecodeError
from annotated_doc import Doc


from fastapi import Depends, Request, Response
from joserfc.errors import DecodeError


from api.middleware import InstrumentedMiddleware
from api.types import Session
from api.responses import ApiErrExc, errors

from shared.py.crypto.session import decode_jose_session




__all__ = (
    "JWTMiddleware",
    "SessionParam",
)


class JWTMiddleware(InstrumentedMiddleware):
    """Populate request.state.session with the user's session, if it exists and is valid"""
    async def dispatch_traced(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
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
        raise ApiErrExc(errors.Unauthorized(
            "Authentication required for this endpoint",
            api_error_code=errors.ERROR_AUTH_REQUIRED
        ))
    return session

# this cannot use the type keyword because fastapi will treat it as a query parameter
SessionParam = Annotated[
    Session,
    Depends(raise_for_session),
    Doc("Annotated param to require authentication and provide the session")
]