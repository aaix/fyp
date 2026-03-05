from collections.abc import Callable, Awaitable

from fastapi import Request, Response
from opentelemetry import trace

from api.middleware import InstrumentedMiddleware


class TracingMiddleware(InstrumentedMiddleware):
    """Adds additional info to the current span"""
    async def dispatch_traced(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:

        if (session := request.state.session) and (span := trace.get_current_span()).is_recording():
            user_id = session.user_id
            span.set_attribute("az.api.user_id", str(user_id))


        return await call_next(request)