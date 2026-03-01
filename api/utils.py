from typing import Any, Literal, Never, overload


from collections.abc import Callable

from grpc import RpcError, StatusCode

from api.responses import ErrorResponse, errors, ApiErrExc


__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))

class RpcErrHandler():
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