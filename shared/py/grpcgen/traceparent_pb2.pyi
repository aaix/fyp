from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class TraceParent(_message.Message):
    __slots__ = ("trace_id", "parent_id", "flags")
    TRACE_ID_FIELD_NUMBER: _ClassVar[int]
    PARENT_ID_FIELD_NUMBER: _ClassVar[int]
    FLAGS_FIELD_NUMBER: _ClassVar[int]
    trace_id: bytes
    parent_id: bytes
    flags: int
    def __init__(self, trace_id: _Optional[bytes] = ..., parent_id: _Optional[bytes] = ..., flags: _Optional[int] = ...) -> None: ...
