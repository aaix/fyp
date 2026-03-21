import asset_pb2 as _asset_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class TransformImageRequest(_message.Message):
    __slots__ = ("asset", "data")
    ASSET_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    asset: _asset_pb2.Asset
    data: bytes
    def __init__(self, asset: _Optional[_Union[_asset_pb2.Asset, _Mapping]] = ..., data: _Optional[bytes] = ...) -> None: ...

class TransformImageResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class MediaInput(_message.Message):
    __slots__ = ("asset", "chunk")
    ASSET_FIELD_NUMBER: _ClassVar[int]
    CHUNK_FIELD_NUMBER: _ClassVar[int]
    asset: _asset_pb2.Asset
    chunk: bytes
    def __init__(self, asset: _Optional[_Union[_asset_pb2.Asset, _Mapping]] = ..., chunk: _Optional[bytes] = ...) -> None: ...

class TransformVideoResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
