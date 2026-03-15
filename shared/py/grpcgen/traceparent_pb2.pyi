from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class TraceParent(_message.Message):
    __slots__ = ("trace_id_lo", "trace_id_hi", "parent_id", "flags")
    TRACE_ID_LO_FIELD_NUMBER: _ClassVar[int]
    TRACE_ID_HI_FIELD_NUMBER: _ClassVar[int]
    PARENT_ID_FIELD_NUMBER: _ClassVar[int]
    FLAGS_FIELD_NUMBER: _ClassVar[int]
    trace_id_lo: int
    trace_id_hi: int
    parent_id: int
    flags: int
    def __init__(self, trace_id_lo: _Optional[int] = ..., trace_id_hi: _Optional[int] = ..., parent_id: _Optional[int] = ..., flags: _Optional[int] = ...) -> None: ...
