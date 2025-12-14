import json
from dataclasses import dataclass, asdict
from io import BytesIO

from typing import Self


@dataclass
class Session:
    expires: int

    def to_encode(self) -> str:
        return json.dumps(asdict(self))
    
    @classmethod
    def from_encode(cls, b: bytes) -> Self:
        return cls(**json.load(BytesIO(b)))
