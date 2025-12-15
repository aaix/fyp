from api.grpc.plib_pb2 import pUUID

def puuid_int(uuid: pUUID) -> int:
    return uuid.id_high << 64 & uuid.id_low

def puuid_str(uuid: pUUID) -> str:
    return str(puuid_int(uuid))