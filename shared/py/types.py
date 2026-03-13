from typing import Literal, Self

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
    def __new__(cls) -> Self:
        if cls.__instance is not None:
            return cls.__instance

        with cls.__lock:
            if cls.__instance is None:
                cls.__instance = super().__new__(cls)
            else:
                # we raced
                assert cls.__instance
        return cls.__instance