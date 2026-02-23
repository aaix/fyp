from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

from pydantic_core import CoreSchema, core_schema
from pydantic import GetCoreSchemaHandler



class PEMPublicKey:
    def __init__(self, inner: RSAPublicKey):
        self.__inner = inner

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.union_schema(
            choices=[
                core_schema.is_instance_schema(cls),
                core_schema.no_info_after_validator_function(
                    cls.from_bytes,
                    handler(bytes),
                ),
            ],
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda v: v.to_bytes(),
                return_schema=handler(bytes),
            )
        )

    def to_bytes(self) -> bytes:
        return self.__inner.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

    @classmethod
    def from_bytes(cls, v: bytes | str):
        if isinstance(v, str):
            v = v.encode()
        key = serialization.load_pem_public_key(v)
        if not isinstance(key, RSAPublicKey):
            raise TypeError("Incorrect key type")
        return cls(key)

