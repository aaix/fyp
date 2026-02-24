from typing import Never

from gateway.models.exceptions import InternalError


def unwrap() -> Never:
    raise InternalError()