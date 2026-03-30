from typing import Annotated, Self
from uuid import UUID

from fastapi import Query
from pydantic import BaseModel, Field

from api.utils import unwrap


from shared.py.constraints import USERNAME_MAX_LENGTH
from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.grpc.id import puuid_str, puuid_uuid
from shared.py.grpcgen import user_pb2
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.pydantic.common import DeviceName, Username





__all__ = (
    "SignupBody",
    "SignupResponse",
    "NewDeviceBody",
    "DeviceResponse",
    "DeviceKeyResponse",
    "AccountResponse",
    "UpdateDeviceBody",
    "UpdateAccountBody",
)



class SignupBody(BaseModel):
    username: Username
    email: Annotated[str, Field(min_length=6, max_length=64)]
    account_public_key: PEMPublicKey
    device: NewDeviceBody


class SignupResponse(BaseModel):
    user_id: UUID
    username: str
    email: str
    public_key: PEMPublicKey
    avatar_asset_id: UUID | None
    device: DeviceResponse

class NewDeviceBody(BaseModel):
    name: DeviceName
    public_key: PEMPublicKey
    encrypted_private_key: Base64Input

class UpdateDeviceBody(BaseModel):
    device_name: DeviceName

class DeviceResponse(BaseModel):
    user_id: UUID
    device_id: UUID
    device_name: str
    device_public_key: PEMPublicKey
    encrypted_account_key: Base64Output | None

    @classmethod
    def from_rpc(cls, res: user_pb2.DeviceObjectResponse,
        user_id: UUID | None = None,
        public_key: PEMPublicKey | None = None,
        account_key: bool = True,
    ):
        return cls(
            user_id=user_id or puuid_uuid(res.user_id) or unwrap(),
            device_id=puuid_uuid(res.device_id) or unwrap(),
            device_name=res.device_name,
            device_public_key=public_key or PEMPublicKey.from_bytes(res.device_public_key),
            encrypted_account_key=res.encrypted_account_key if account_key else None,
        )

class DeviceKeyResponse(BaseModel):
    encrypted_account_key: Base64Output
    account_public_key: PEMPublicKey

class AccountResponse(BaseModel):
    user_id: UUID
    avatar_asset_id: UUID | None
    public_key: PEMPublicKey
    username: str
    email: str
    assigned_gateway: str | None
    profile_is_public: bool

    @classmethod
    def from_rpc(cls, rpc: user_pb2.ReadUserResponse, gateway: str | None = None) -> Self:
        return cls(
            user_id=puuid_uuid(rpc.user_id) or unwrap(),
            avatar_asset_id=puuid_uuid(rpc.avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(rpc.public_key),
            username=rpc.username,
            email=rpc.email,
            assigned_gateway=gateway,
            profile_is_public=rpc.is_public,
        )

class UpdateAccountBody(BaseModel):
    public_profile: bool | None