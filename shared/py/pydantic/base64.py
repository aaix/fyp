import base64

from typing import Annotated

from pydantic import EncodedBytes, EncoderProtocol 


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

