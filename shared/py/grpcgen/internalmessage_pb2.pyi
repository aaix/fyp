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
    __slots__ = ("ipaddress",)
    IPADDRESS_FIELD_NUMBER: _ClassVar[int]
    ipaddress: int
    def __init__(self, ipaddress: _Optional[int] = ...) -> None: ...
