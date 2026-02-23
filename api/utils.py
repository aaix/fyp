
from api.responses import errors, ApiErrExc

from typing import Annotated, Never

__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))
