from typing import Never

from api.responses import errors, ApiErrExc


__all__ = (
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))
