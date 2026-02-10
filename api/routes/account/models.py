
from pydantic import Base64Bytes, BaseModel, Field

from api.crypto.models import PEMPublicKey

from typing import Annotated


__all__ = (
    "SignupBody",
    "SignupResponse",
    "NewDeviceBody",
    "DeviceResponse",
)



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

class NewDeviceBody(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=32)]
    public_key: PEMPublicKey
    encrypted_private_key: Base64Bytes

class DeviceResponse(BaseModel):
    user_id: str
    device_id: str
    device_name: str
    device_public_key: PEMPublicKey
    encrypted_account_key: Base64Bytes