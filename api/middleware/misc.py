from collections.abc import Callable, Awaitable


from fastapi import Request, Response


from api.middleware import InstrumentedMiddleware
from api.responses import errors



class HeaderValidationMiddleware(InstrumentedMiddleware):
    """Mandate appropriate content type"""
    async def dispatch_traced(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:

        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi.json") or path.startswith("/redoc"):
            return await call_next(request)

        if not (content_type := request.headers.get("content-type")):
            return errors.UnsupportedMediaType("Unexpected missing content type")

        if not content_type.startswith("multipart/form-data") and content_type != "application/json":
            return errors.UnsupportedMediaType("Unexpected content type, execting application/json or multipart/form-data")

        return await call_next(request)