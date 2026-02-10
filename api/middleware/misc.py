from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from collections.abc import Callable, Awaitable

from api.responses import errors



class HeaderValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:

        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi.json") or path.startswith("/redoc"):
            return await call_next(request)

        if not (content_type := request.headers.get("content-type")) or content_type != "application/json":
            return errors.UnsupportedMediaType("Excpected application/json content type")

        return await call_next(request)