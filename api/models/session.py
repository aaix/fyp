import json
from dataclasses import dataclass, asdict
from io import BytesIO

from typing import Self

from datetime import datetime, UTC


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

