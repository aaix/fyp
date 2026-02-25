from enum import IntEnum

class GatewayCloseCode(IntEnum):
    """4xxx application area close codes"""
    MALFORMED_DATA = 4000
    NOT_FOUND = 4001
    HANDSHAKE_FAILED = 4003
    INVALID_STATE = 4004