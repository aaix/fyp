from enum import Enum

class GatewayException(Exception): ...

class InternalError(GatewayException):
    """Raised whenever something unexpected goes wrong"""

class HandshakeFailed(GatewayException):
    """Raised when a client handshake fails"""
    def __init__(self, reason: Reason, message: str): 
        self.reason = reason
        self.message = message
    
    class Reason(Enum):
        BAD_AUTH = 1
        TIME_OUT = 2
        BAD_PAYLOAD = 3
        GOING_AWAY = 4
