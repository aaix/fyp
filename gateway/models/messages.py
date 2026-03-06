from enum import StrEnum
from typing import Annotated, Any, Literal, Final

from abc import ABC
from uuid import UUID

from pydantic import BaseModel, Field, TypeAdapter

from gateway.models.events import Event_t
from gateway.utils import unwrap
from shared.py.grpc.id import puuid_str
from shared.py.grpcgen.user_pb2 import DeviceObjectResponse
from shared.py.pydantic.base64 import Base64Input, Base64Output
from shared.py.pydantic.common import DeviceName, Username
from shared.py.pydantic.pem import PEMPublicKey


__all__ = (
    "ClientMessageAdapter",
    "ClientMessage_T",
    "UserBulkRequest",
    "ClientHello",
    "ClientAuth",
    "AddDeviceOK",
    "SelectDeviceIntention",
    "SelectDeviceCancel",
    "ServerHello",
    "SessionComplete",
    "EventMessage",
    "NewDeviceServerHello",
    "SelectDeviceIntentionFailure",
    "NewDeviceClientHello",
    "NewDeviceOK",
    "AddDeviceRequest",
)

class BaseMessage(BaseModel, ABC):
    """Base class for connection management messages"""
    op: Any
    seq: Any

class ClientMessage(BaseMessage, ABC):
    seq: int
    ack: int | None = None

class ServerMessage(BaseMessage, ABC):
    seq: int | None = None # server doesnt need to specify a seq on model creation, only on serialise

type ClientMessage_T = Annotated[UserBulkRequest | ClientHello | ClientAuth | AddDeviceOK | SelectDeviceIntention | SelectDeviceCancel,  Field(discriminator="op")]
ClientMessageAdapter: TypeAdapter[ClientMessage_T] = TypeAdapter(ClientMessage_T)

# for normal operations
class ClientHello(ClientMessage):
    """Sent by a client connecting to identify"""
    op: Literal["client_hello"]
    user_id: UUID
    device_id: UUID

class ServerHello(ServerMessage):
    """Sent by the server to an identifying client for a challenge"""
    op: Literal["server_hello"]
    ### The part the client needs to sign
    device_challenge: Base64Output
    account_challenge: Base64Output

class ClientAuth(ClientMessage):
    """Authenticates the client device"""
    op: Literal["client_auth"]
    solved_device_challenge: Base64Input
    solved_account_challenge: Base64Input

class SessionComplete(ServerMessage):
    """Confirms to the client the handshake is complete"""
    op: Literal["session_complete"]

class EventMessage(ServerMessage):
    """Base message for a business logic event"""
    op: Literal["event"]
    d: Event_t = Field(discriminator="intent")
    
# for new device registration
class NewDeviceClientHello(ClientMessage):
    op: Literal["new_device_hello"]
    username: Username
    device_name: DeviceName
    device_public_key: PEMPublicKey

class NewDeviceServerHello(ServerMessage):
    """Hello to the new device requesting to be added"""
    op: Literal["new_device_server_hello"]
    code: int

class SelectDeviceIntention(ClientMessage):
    """Selects the device by the code shared out of band"""
    op: Literal["select_device_intention"]
    code: int

class SelectDeviceIntentionFailure(ServerMessage):
    """Sent when a code is not valid"""
    op: Literal["select_device_intention_failure"]
    failure_type: Type

    class Type(StrEnum):
        NOT_FOUND = "not_found"
        DEVICE_LIMIT_REACHED = "device_limit_reached"

class SelectDeviceCancel(ClientMessage):
    """Client cancels adding new device"""
    op: Literal["select_device_cancel"]

class AddDeviceRequest(ServerMessage):
    """Server shares new device info to authenticated device"""
    op: Literal["add_device_request"]
    device_name: DeviceName
    device_public_key: PEMPublicKey

class AddDeviceOK(ClientMessage):
    """Authenticated client encrypts account key with device public key"""
    op: Literal["add_device_ok"]
    encrypted_account_key: Base64Input

class NewDeviceOK(ServerMessage):
    """New device object to be returned to new device client"""
    op: Literal["new_device_ok"]
    device_id: str
    user_id: str
    device_name: str
    device_public_key: PEMPublicKey
    encrypted_account_key: Base64Output

    @classmethod
    def from_rpc(cls, res: DeviceObjectResponse, public_key: PEMPublicKey):
        return cls(
            op="new_device_ok",
            device_id=puuid_str(res.device_id) or unwrap(),
            user_id=puuid_str(res.user_id) or unwrap(),
            device_name=res.device_name,
            device_public_key=public_key,
            encrypted_account_key=res.encrypted_account_key
        )

class UserBulkRequest(ClientMessage):
    op: Literal["user_bulk_request"]
    user_ids: Annotated[list[UUID], Field(..., max_length=50)] 

ClientMessageAdapter.rebuild()