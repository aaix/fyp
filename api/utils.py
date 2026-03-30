
from typing import Any, Literal, LiteralString, Never, Self, overload

from ipaddress import IPv4Address, IPv6Address, ip_address
import traceback

from collections.abc import Callable
from datetime import datetime, UTC

from fastapi import Request
from grpc import RpcError, StatusCode

from api.responses import ErrorResponse, errors, ApiErrExc
from api.tracing import tracer
from api.types.extensions import SupportsStr


__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    with tracer.start_as_current_span("unwrap info") as span:
        stack = '\n'.join(traceback.format_stack())
        span.set_attribute("az.api.unwrap.exc_stack", stack)
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))

def now() -> int:
    """Return the current unix timestamp in ms"""
    return int(datetime.now(UTC).timestamp())




class RpcErrHandler:
    """Helper to return an API error on a specific rpc exception raised"""
    def __init__(self, code: StatusCode, callback: Callable[[RpcError], ErrorResponse]):
        self.__code = code
        self.__callback = callback

    def __enter__(self) -> Self:
        return self

    @overload # add these overloads so that the typechecker knows no exceptions are supressed
    def __exit__(self, exc_type: None, exc: None, tb: None) -> Literal[True]: ...

    @overload
    def __exit__(self, exc_type: type[Exception], exc: Exception, tb: Any) -> Literal[False]: ...


    def __exit__(self, exc_type: type[Exception] | None, exc: Exception | None, tb: Any) -> bool:
        if exc_type is None:
            return True
        
        if not isinstance(exc, RpcError):
            return False

        if exc.code() == self.__code:
            self.do_raise(exc)
        
        return False # dont suppress other rpc errors

    def do_raise(self, error: RpcError) -> Never:
        raise ApiErrExc(self.__callback(error))

class ResourceNotFoundRpcHandler(RpcErrHandler):
    """Special case for mapping rpc not found to 404 user not found error"""

    @staticmethod
    def make_error(param_type: LiteralString, resource_id: SupportsStr) -> errors.NotFound:
        return errors.NotFound(f"Resource {param_type} {resource_id} not found", api_error_code=errors.ERROR_NO_SUCH_RESOURCE)

    def __init__(self, param_type: LiteralString, resource_id: SupportsStr):
        self.resource_id = resource_id
        self.param_type: LiteralString = param_type
        super().__init__(
            StatusCode.NOT_FOUND,
            self.error
        )
    def error(self, _: object = None) -> errors.NotFound:
        return self.make_error(self.param_type, self.resource_id)

def get_ip_from_request(request: Request) -> IPv4Address | IPv6Address | None:
    cf_connecting_ip = request.headers.get("CF-Connecting-IP", None)
    ip = cf_connecting_ip if cf_connecting_ip else request.client[0] if request.client else None

    if ip:
        return ip_address(ip)
    return None
