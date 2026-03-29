from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class Asset(_message.Message):
    __slots__ = ("path", "public", "input_size", "content_type", "output_type", "output_width", "output_height")
    PATH_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_FIELD_NUMBER: _ClassVar[int]
    INPUT_SIZE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_TYPE_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_WIDTH_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_HEIGHT_FIELD_NUMBER: _ClassVar[int]
    path: str
    public: bool
    input_size: int
    content_type: str
    output_type: str
    output_width: int
    output_height: int
    def __init__(self, path: _Optional[str] = ..., public: bool = ..., input_size: _Optional[int] = ..., content_type: _Optional[str] = ..., output_type: _Optional[str] = ..., output_width: _Optional[int] = ..., output_height: _Optional[int] = ...) -> None: ...
