from typing import Self
from types import TracebackType

from collections.abc import Iterable, Callable, Hashable, Awaitable
from contextlib import AbstractContextManager
from collections import defaultdict


from grpc import RpcError, StatusCode



def bucketby[K: Hashable, V](iterable: Iterable[V], bucketer: Callable[[V], K]) -> dict[K, list[V]]:
    """Turn an Iterable[T] into a dict of {k: {f(v),} = k}, the bucketer is not run in parallel"""
    buckets: dict[K, list[V]] = defaultdict(list)

    for value in iterable:
        buckets[bucketer(value)].append(value)

    return buckets

class SuppressRpcErr(AbstractContextManager):
    """Context manager to suppress rpc errors, predicate should return true if exc is handled"""
    def __init__(self, code: StatusCode | None = None, predicate: Callable[[RpcError], bool] | None = None):
        if not (code is not None) ^ (predicate is not None):
            raise TypeError("Code xor predicate should be specified")
        

        if predicate is None:
            predicate = lambda exc: exc.code() == code

        self.predicate = predicate

    
    def __enter__(self) -> Self:
        return self
    
    def __exit__(self, exc_type: type[BaseException] | None, exc_value: BaseException | None, traceback: TracebackType | None) -> bool:
        if exc_value is None:
            return False
        
        if not isinstance(exc_value, RpcError):
            return False
        
        return self.predicate(exc_value)