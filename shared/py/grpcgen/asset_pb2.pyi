from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class Asset(_message.Message):
    __slots__ = ("path", "public", "content_type", "output_type")
    PATH_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_TYPE_FIELD_NUMBER: _ClassVar[int]
    path: str
    public: bool
    content_type: str
    output_type: str
    def __init__(self, path: _Optional[str] = ..., public: bool = ..., content_type: _Optional[str] = ..., output_type: _Optional[str] = ...) -> None: ...
