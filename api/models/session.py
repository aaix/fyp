import json
from dataclasses import dataclass, asdict
from io import BytesIO

from typing import Self

from datetime import datetime, UTC

from api.responses import ApiErrExc
from api.responses.errors import Unauthorized
from api.responses.status_codes import ERROR_SESSION_EXPIRED

CONF_SESSION_DURATION = 4 * 60 * 60 # 4 hours

def _timenow() -> float:
    return datetime.now(UTC).timestamp()


@dataclass
class Session:
    issued: float
    version: int
    user_id: str

    def to_encode(self) -> str:
        return json.dumps(asdict(self))
    
    @classmethod
    def from_encode(cls, b: bytes) -> Self:
        return cls(**json.load(BytesIO(b)))
    
    @classmethod
    def new(cls, user_id: str) -> Self:
        return cls(
            issued=_timenow(),
            version=0,
            user_id=user_id,
        )

    def validate(self):
        if self.issued + CONF_SESSION_DURATION > _timenow():
            raise ApiErrExc(Unauthorized("Session expired", api_error_code=ERROR_SESSION_EXPIRED))

