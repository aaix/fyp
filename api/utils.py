from typing import Any, Literal, LiteralString, Never, overload


from collections.abc import Callable
from uuid import UUID

from grpc import RpcError, StatusCode

from api.responses import ErrorResponse, errors, ApiErrExc
from api.types.extensions import SupportsStr


__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))

class RpcErrHandler:
    """Helper to return an API error on a specific rpc exception raised"""
    def __init__(self, code: StatusCode, callback: Callable[[], ErrorResponse]):
        self.__code = code
        self.__callback = callback

    def __enter__(self):
        pass

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
            raise ApiErrExc(self.__callback())
        
        return False # dont suppress other rpc errors


class ResourceNotFoundRpcHandler(RpcErrHandler):
    """Special case for mapping rpc not found to 404 user not found error"""
    def __init__(self, resource_id: SupportsStr):
        super().__init__(
            StatusCode.NOT_FOUND,
            lambda: errors.NotFound(f"Resource {resource_id} not found", api_error_code=errors.ERROR_NO_SUCH_RESOURCE)
        )