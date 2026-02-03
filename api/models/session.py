import json
from dataclasses import dataclass, asdict
from io import BytesIO

from typing import Self

from api.grpcgen.plib_pb2 import pUUID


@dataclass
class Session:
    expires: int
    user_id: pUUID

    def to_encode(self) -> str:
        return json.dumps(asdict(self))
    
    @classmethod
    def from_encode(cls, b: bytes) -> Self:
        return cls(**json.load(BytesIO(b)))
