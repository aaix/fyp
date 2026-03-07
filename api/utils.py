from typing import Any, Literal, LiteralString, Never, overload


from collections.abc import Callable
from datetime import datetime, UTC

from grpc import RpcError, StatusCode

from api.middleware.auth import SessionParam
from api.responses import ErrorResponse, errors, ApiErrExc
from api.types.extensions import SupportsStr
from shared.py.grpc.id import id_compare
from shared.py.grpcgen import user_pb2


__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))

def now() -> int:
    """Return the current unix timestamp in ms"""
    return int(datetime.now(UTC).timestamp())


def assert_user_isnt_self(s: SessionParam, peer: user_pb2.ReadUserResponse):
    if id_compare(s.user_id, peer.user_id):
        raise ApiErrExc(errors.BadRequest("A request cannot target the current user", api_error_code=errors.ERROR_BAD_REQUEST))


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