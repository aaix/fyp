from uuid import UUID

from api.grpcgen.plib_pb2 import pUUID
from api.responses import errors, ApiErrExc

from pydantic import EncodedBytes, EncoderProtocol 

import base64

from typing import Annotated, Never

__all__ = (
    "puuid_int",
    "puuid_str",
     "Base64Input",
    "unwrap",
)

def unwrap() -> Never:
    raise ApiErrExc(errors.InternalServerError("Illegal state occured"))


def puuid_int(uuid: pUUID) -> int | None:
    """Convert pUUID to int"""
    if uuid.id_low + uuid.id_high == 0:
        return None
    return (uuid.id_high << 64) | uuid.id_low

def int_puuid(data: int) -> pUUID:
    """Convert an int to a pUUID"""
    return pUUID(
        id_high=data >> 64,
        id_low=data & ((1 << 64) - 1)
    )


def puuid_str(uuid: pUUID) -> str | None:
    """Convert pUUID to str"""
    if int_id := puuid_int(uuid):
        return f"{int_id:032x}"
    return None

def str_puuid(uuid: str) -> pUUID:
    """Convert str to pUUID"""
    data = int(uuid, 16)
    return int_puuid(data)

def uuid_puuid(uuid: UUID) -> pUUID:
    return int_puuid(uuid.int) # pyright: ignore[reportArgumentType]

def id_compare(id1: str | pUUID | UUID, id2: str | pUUID | UUID) -> bool:
    """Return if two ids are equivalent regardless of their "id" type"""
    id1_int = _id_int(id1)
    id2_int = _id_int(id2)
    if any((id1_int is None, id1_int is None)):
        return False
    
    return id1_int == id2_int


def _id_int(id1: str | pUUID | UUID) -> int | None:
    """Convert an "id" type to an integer"""
    if isinstance(id1, pUUID):
        return puuid_int(id1)
    elif isinstance(id1, str):
        return int(id1.replace('-', ''), 16)
    elif isinstance(id1, UUID):
        return id1.int # pyright: ignore[reportReturnType]

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


Base64Input = Annotated[bytes, EncodedBytes(encoder=Base64InputEncoder)]
Base64Output = Annotated[bytes, EncodedBytes(encoder=Base64OutputEncoder)]

