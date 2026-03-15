import traceparent_pb2 as _traceparent_pb2
import plib_pb2 as _plib_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class IntraMessage(_message.Message):
    __slots__ = ("to", "traceparent", "session_create")
    TO_FIELD_NUMBER: _ClassVar[int]
    TRACEPARENT_FIELD_NUMBER: _ClassVar[int]
    SESSION_CREATE_FIELD_NUMBER: _ClassVar[int]
    to: _plib_pb2.pUUID
    traceparent: _traceparent_pb2.TraceParent
    session_create: EventSessionCreate
    def __init__(self, to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., traceparent: _Optional[_Union[_traceparent_pb2.TraceParent, _Mapping]] = ..., session_create: _Optional[_Union[EventSessionCreate, _Mapping]] = ...) -> None: ...

class EventSessionCreate(_message.Message):
    __slots__ = ("device_id", "device_name", "ipaddress")
    DEVICE_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    IPADDRESS_FIELD_NUMBER: _ClassVar[int]
    device_id: _plib_pb2.pUUID
    device_name: str
    ipaddress: int
    def __init__(self, device_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_name: _Optional[str] = ..., ipaddress: _Optional[int] = ...) -> None: ...
