from typing import Literal, Self
from collections.abc import Callable

from threading import Lock
from enum import Enum

class UnsetType(Enum):
    _unset = ()

    def __bool__(self) -> Literal[False]:
        return False

UNSET = UnsetType._unset

type MaybeUnset[T] = T | UnsetType

class SingletonMixin:
    __instance = None
    __lock = Lock()
    def __new__(cls, *args, **kwargs) -> Self:
        if cls.__instance is not None:
            return cls.__instance

        with cls.__lock:
            if cls.__instance is None:
                cls.__instance = super().__new__(cls)
            else:
                # we raced
                assert cls.__instance
        return cls.__instance


class KeyedDefaultDict[K, V](dict[K, V]):
    """
    Like collections.defaultdict but passes the key to the factory function
    allegedly thread safe
    """
    def __init__(self, factory: Callable[[K], V]):
        self.factory = factory
        self.__add_lock = Lock()
        
    def __missing__(self, key: K) -> V:
        with self.__add_lock:
            # its possible to race to __missing__
            if self.get(key, None) is None:
                self[key] = self.factory(key)
        return self[key]
