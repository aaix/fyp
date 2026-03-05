from typing import final
from collections.abc import Callable, Awaitable

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

from api.tracing import tracer


class InstrumentedMiddleware(BaseHTTPMiddleware):

    async def dispatch_traced(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        raise NotImplementedError("subclass should define dispatch_traced")

    @final
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:

        with tracer.start_as_current_span(self.__class__.__name__):
            return await self.dispatch_traced(request, call_next)