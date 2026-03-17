import traceparent_pb2 as _traceparent_pb2
import plib_pb2 as _plib_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class IntraMessage(_message.Message):
    __slots__ = ("to", "traceparent", "session_create", "channel_create", "friendship_update")
    TO_FIELD_NUMBER: _ClassVar[int]
    TRACEPARENT_FIELD_NUMBER: _ClassVar[int]
    SESSION_CREATE_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_CREATE_FIELD_NUMBER: _ClassVar[int]
    FRIENDSHIP_UPDATE_FIELD_NUMBER: _ClassVar[int]
    to: _plib_pb2.pUUID
    traceparent: _traceparent_pb2.TraceParent
    session_create: EventSessionCreate
    channel_create: EventChannelCreate
    friendship_update: EventFriendshipUpdate
    def __init__(self, to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., traceparent: _Optional[_Union[_traceparent_pb2.TraceParent, _Mapping]] = ..., session_create: _Optional[_Union[EventSessionCreate, _Mapping]] = ..., channel_create: _Optional[_Union[EventChannelCreate, _Mapping]] = ..., friendship_update: _Optional[_Union[EventFriendshipUpdate, _Mapping]] = ...) -> None: ...

class EventSessionCreate(_message.Message):
    __slots__ = ("ipaddress",)
    IPADDRESS_FIELD_NUMBER: _ClassVar[int]
    ipaddress: int
    def __init__(self, ipaddress: _Optional[int] = ...) -> None: ...

class EventChannelCreate(_message.Message):
    __slots__ = ("channel_id", "encrypted_channel_name", "encrypted_channel_key")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    encrypted_channel_name: bytes
    encrypted_channel_key: bytes
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_name: _Optional[bytes] = ..., encrypted_channel_key: _Optional[bytes] = ...) -> None: ...

class EventFriendshipUpdate(_message.Message):
    __slots__ = ("peer_id", "relationship_type")
    PEER_ID_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    peer_id: _plib_pb2.pUUID
    relationship_type: int
    def __init__(self, peer_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_type: _Optional[int] = ...) -> None: ...
