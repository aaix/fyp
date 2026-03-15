from uuid import UUID

from shared.py.grpcgen.plib_pb2 import pUUID

type id_t = str | pUUID | UUID

def puuid_int(uuid: pUUID) -> int | None:
    """Convert pUUID to int"""
    if uuid.id_low + uuid.id_high == 0:
        return None
    return (uuid.id_high << 64) | uuid.id_low

def puuid_str(uuid: pUUID) -> str | None:
    """Convert pUUID to str"""
    if int_id := puuid_int(uuid):
        return f"{int_id:032x}"
    return None

def puuid_uuid(puuid: pUUID) -> UUID | None:
    id_int = puuid_int(puuid)
    if not id_int:
        return None
    return UUID(int=id_int)


def int_puuid(data: int) -> pUUID:
    """Convert an int to a pUUID"""
    return pUUID(
        id_high=data >> 64,
        id_low=data & ((1 << 64) - 1)
    )

def str_puuid(uuid: str) -> pUUID:
    """Convert str to pUUID"""
    data = int(uuid, 16)
    return int_puuid(data)

def uuid_puuid(uuid: UUID) -> pUUID:
    return int_puuid(uuid.int) # pyright: ignore[reportArgumentType]

def id_compare(id1: id_t, id2: id_t) -> bool:
    """Return if two ids are equivalent regardless of their "id" type"""
    id1_int = _id_int(id1)
    id2_int = _id_int(id2)
    if any((id1_int is None, id1_int is None)):
        return False
    
    return id1_int == id2_int

def id_puuid(id1: id_t) -> pUUID | None:
    if isinstance(id1, pUUID):
        return id1
    if not (id_int := _id_int(id1)):
        return None
    return int_puuid(id_int)

def id_uuid(id1: id_t) -> UUID | None:
    if not (id_int := _id_int(id1)):
        return None
    return UUID(int=id_int)

def _id_int(id1: id_t) -> int | None:
    """Convert an "id" type to an integer"""
    if isinstance(id1, pUUID):
        return puuid_int(id1)
    elif isinstance(id1, str):
        return int(id1.replace('-', ''), 16)
    elif isinstance(id1, UUID):
        return id1.int # pyright: ignore[reportReturnType]