from typing import Annotated, Any, Literal, Final

from abc import ABC
from uuid import UUID

from pydantic import BaseModel, Field

from gateway.models.events import Event_t
from gateway.utils import unwrap
from shared.py.grpc.id import puuid_str
from shared.py.grpcgen.user_pb2 import DeviceObjectResponse
from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.pydantic.common import DeviceName, Username
from shared.py.pydantic.pem import PEMPublicKey



class BaseMessage(BaseModel, ABC):
    """Base class for connection management messages"""
    op: Any
    seq: None | int = None


# for normal operations
class ClientHello(BaseMessage):
    """Sent by a client connecting to identify"""
    op: Literal["client_hello"]
    user_id: UUID
    device_id: UUID

class ServerHello(BaseMessage):
    """Sent by the server to an identifying client for a challenge"""
    op: Literal["server_hello"]
    ### The part the client needs to sign
    device_challenge: Base64Output
    account_challenge: Base64Output

class ClientAuth(BaseMessage):
    """Authenticates the client device"""
    op: Literal["client_auth"]
    solved_device_challenge: Base64Input
    solved_account_challenge: Base64Input

class SessionComplete(BaseMessage):
    """Confirms to the client the handshake is complete"""
    op: Literal["session_complete"]

class ClientEvent(BaseMessage):
    """Base message for a business logic event"""
    op: Literal["event"]
    d: Event_t = Field(discriminator="intent")
    
# for new device registration
class NewDeviceClientHello(BaseMessage):
    op: Literal["new_device_hello"]
    username: Username
    device_name: Annotated[str, Field]
    device_public_key: PEMPublicKey

class NewDeviceServerHello(BaseMessage):
    """Hello to the new device requesting to be added"""
    op: Literal["new_device_server_hello"]
    gateway_id: UUID
    code: int

class AddDeviceIntention(BaseMessage):
    """Authenticated client signals to gateway that it is ready to add a new device"""
    op: Literal["add_device_intention"]

class SelectDeviceIntention(BaseMessage):
    """Selects the device by the code shared out of band"""
    op: Literal["select_device_intention"]
    code: int

class AddDeviceRequest(BaseMessage):
    """Server shares new device info to authenticated device"""
    op: Literal["add_device_request"]
    device_name: DeviceName
    device_public_key: PEMPublicKey
    device_gateway_id: UUID

class AddDeviceOK(BaseMessage):
    """Authenticated client encrypts account key with device public key"""
    op: Literal["add_device_request"]
    encrypted_account_key: Base64Input

class NewDeviceOk(BaseMessage):
    """New device object to be returned to new device client"""
    op: Literal["new_device_ok"]
    device_id: str
    user_id: str
    device_name: str
    device_public_key: Base64Output
    encrypted_account_key: Base64Output

    @classmethod
    def from_rpc(cls, res: DeviceObjectResponse):
        return cls(
            op="new_device_ok",
            device_id=puuid_str(res.device_id) or unwrap(),
            user_id=puuid_str(res.user_id) or unwrap(),
            device_name=res.device_name,
            device_public_key=res.device_public_key,
            encrypted_account_key=res.encrypted_account_key
        )

