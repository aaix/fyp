from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class pUUID(_message.Message):
    __slots__ = ("id_high", "id_low")
    ID_HIGH_FIELD_NUMBER: _ClassVar[int]
    ID_LOW_FIELD_NUMBER: _ClassVar[int]
    id_high: int
    id_low: int
    def __init__(self, id_high: _Optional[int] = ..., id_low: _Optional[int] = ...) -> None: ...
