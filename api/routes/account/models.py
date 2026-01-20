from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from pydantic import BaseModel, EncoderProtocol, Field

from pydantic_core import CoreSchema, core_schema

from pydantic import GetCoreSchemaHandler, TypeAdapter


from typing import Annotated, Any

from api.utils import Base64Input, Base64Output


__all__ = (
    "SignupBody",
    "SignupResponse",
)


class PEMPublicKey(RSAPublicKey):
    """
    Validate a field is in PEM format
    """

    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_after_validator_function(cls, handler(str))


    @classmethod
    def _pydantic_validate(cls, v):
        if not isinstance(v, bytes):
            raise TypeError('Expected bytes')
        key = serialization.load_pem_public_key(v)
        if not isinstance(key, RSAPublicKey):
            raise TypeError("Incorrect key type")
        return key



class SignupBody(BaseModel):
    username: Annotated[str, Field(max_length=16, min_length=3)]
    email: Annotated[str, Field(min_length=6, max_length=64)]
    public_key: PEMPublicKey


class SignupResponse(BaseModel):
    user_id: str
    username: str
    email: str
    public_key: PEMPublicKey
    avatar_asset_id: str | None

