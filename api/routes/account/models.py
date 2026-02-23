from typing import Annotated

from pydantic import BaseModel, Field

from api.models.common import Username
from api.utils import unwrap


from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.grpc.id import puuid_str
from shared.py.grpcgen.user_pb2 import DeviceObjectResponse
from shared.py.pydantic.pem import PEMPublicKey




__all__ = (
    "SignupBody",
    "SignupResponse",
    "NewDeviceBody",
    "DeviceResponse",
    "DeviceKeyResponse",
    "AccountResponse",
)



class SignupBody(BaseModel):
    username: Username
    email: Annotated[str, Field(min_length=6, max_length=64)]
    account_public_key: PEMPublicKey
    device: NewDeviceBody


class SignupResponse(BaseModel):
    user_id: str
    username: str
    email: str
    public_key: PEMPublicKey
    avatar_asset_id: str | None
    device: DeviceResponse

class NewDeviceBody(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=32)]
    public_key: PEMPublicKey
    encrypted_private_key: Base64Input

class DeviceResponse(BaseModel):
    user_id: str
    device_id: str
    device_name: str
    device_public_key: PEMPublicKey
    encrypted_account_key: Base64Output

    @classmethod
    def from_rpc(cls, res: DeviceObjectResponse,
        user_id: str | None = None,
        public_key: PEMPublicKey | None = None,
    ):
        return cls(
            user_id=user_id or puuid_str(res.user_id) or unwrap(),
            device_id=puuid_str(res.device_id) or unwrap(),
            device_name=res.device_name,
            device_public_key=public_key or PEMPublicKey.from_bytes(res.device_public_key),
            encrypted_account_key=res.encrypted_account_key,
        )

class DeviceKeyResponse(BaseModel):
    encrypted_account_key: Base64Output
    account_public_key: PEMPublicKey

class AccountResponse(BaseModel):
    user_id: str
    avatar_asset_id: str | None
    public_key: PEMPublicKey
    username: str
    email: str