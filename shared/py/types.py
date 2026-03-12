from typing import Literal
from enum import Enum

class UnsetType(Enum):
    _unset = ()

    def __bool__(self) -> Literal[False]:
        return False

UNSET = UnsetType._unset

type MaybeUnset[T] = T | UnsetType