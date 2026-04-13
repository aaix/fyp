import asyncio
import threading
from typing import Self
from types import TracebackType

from collections.abc import Iterable, Callable, Hashable
from collections import deque
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


class PoisonableThreadssafeEvent(asyncio.Event):
    __slots__  = ("poisoned","loop")
    def __init__(self, loop):
        super().__init__()
        self.loop: asyncio.AbstractEventLoop = loop
        self.poisoned = False

    def set_threadsafe(self):
        self.loop.call_soon_threadsafe(self.set)
    
class MultiRuntimeLock:
    """Non reentrant, simple thread safe version of asyncio.Lock()"""
    def __init__(self):
        self.__lock = threading.Lock()
        self.locked = False
        self.owner: PoisonableThreadssafeEvent | None = None
        self.queue: deque[PoisonableThreadssafeEvent] = deque()
    

    async def __aenter__(self):
        event = PoisonableThreadssafeEvent(asyncio.get_event_loop())
        with self.__lock:
            if not self.locked:
                self.locked = True
                self.owner = event
                return
            self.queue.append(event)

        try:
            return await event.wait()
        except asyncio.CancelledError:
            with self.__lock:
                event.poisoned = True
                if self.owner == event:
                    self.__pass_to_next()
            raise

    async def __aexit__(self, exc_type, exc, tb):
        with self.__lock:
            assert self.locked
            self.__pass_to_next()
    
    def __pass_to_next(self):
        while len(self.queue) > 0:
            event = self.queue.pop()
            if not event.poisoned:
                event.set_threadsafe()
                self.owner = event
                return

        self.locked = False
        self.owner = None

                