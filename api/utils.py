from api.grpcgen.plib_pb2 import pUUID
from api.responses import errors, ApiErrExc

from pydantic import EncodedBytes, EncoderProtocol 

import base64

from typing import Annotated, Never

__all__ = (
    "puuid_int",
    "puuid_str",
#     "Base64Input",
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))


def puuid_int(uuid: pUUID) -> int | None:
    if uuid.id_low + uuid.id_high == 0:
        return None
    return (uuid.id_high << 64) | uuid.id_low

def puuid_str(uuid: pUUID) -> str | None:
    if int_id := puuid_int(uuid):
        return f"{int_id:X}"
    return None

def str_puuid(uuid: str) -> pUUID:
    data = int(uuid, 16)
    return pUUID(
        id_high=data >> 64
        id_low=data & 1 << 64
    )

class Base64InputEncoder(EncoderProtocol):
    """Helper for base64 str inputs decoding to bytes"""
    @classmethod
    def encode(cls, value: bytes) -> bytes:
        return base64.b64encode(value)

    @classmethod
    def decode(cls, data: bytes) -> bytes:
        decoded = base64.b64decode(data)
        return decoded
    
    @classmethod
    def get_json_format(cls) -> str:
        return "b64"

class Base64OutputEncoder(Base64InputEncoder):
    """Helper for byte outputs encoded into base64 inputs"""
    @classmethod
    def decode(cls, data: bytes) -> bytes:
        return data


# Base64Input = Annotated[bytes, EncodedBytes(encoder=Base64InputEncoder)]
# Base64Output = Annotated[bytes, EncodedBytes(encoder=Base64OutputEncoder)]

