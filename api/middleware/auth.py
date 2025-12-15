from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from joserfc.errors import DecodeError

from collections.abc import Callable, Awaitable

from json import JSONDecodeError

from api.models import Session
from api.responses import errors
from api.crypto.session import decode_jose_session




class JWTMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if not (token := request.headers.get("Authorization")):
            request.state.session = None
            return await call_next(request)
        

        try:
            raw = decode_jose_session(token)
        except DecodeError as e:
            print(e)
            return errors.Unauthorized("Garbage authorization", errors.ERROR_GARBAGE_SESSION)

        try:
            session = Session.from_encode(raw)
        except TypeError, JSONDecodeError:
            return errors.Unauthorized("Invalid session", errors.ERROR_INVALID_SESSION)
        
        request.state.session = session
        return await call_next(request)