from enum import Enum

class UnsetType(Enum):
    _unset = ()

UNSET = UnsetType._unset

type MaybeUnset[T] = T | UnsetType