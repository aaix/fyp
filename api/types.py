"""Helpers for python types, does not include any business logic types"""

import typing
from typing import SupportsAbs, SupportsBytes, SupportsComplex, SupportsFloat, SupportsIndex, SupportsInt, SupportsRound


__all__ = (
    # typing rexports
    "SupportsAbs",
    "SupportsBytes",
    "SupportsComplex",
    "SupportsFloat",
    "SupportsIndex",
    "SupportsInt",
    "SupportsRound",

    # custom types
    "SupportsStr",
)

@typing.runtime_checkable
class _SupportsStr(typing.Protocol):
    """"""
    def __str__(self) -> str:...

type SupportsStr = _SupportsStr
