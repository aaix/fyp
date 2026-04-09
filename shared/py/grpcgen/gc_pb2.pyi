import plib_pb2 as _plib_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FileGarbageRequest(_message.Message):
    __slots__ = ("bucket", "object_id", "garbage_type", "garbage_flags")
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    OBJECT_ID_FIELD_NUMBER: _ClassVar[int]
    GARBAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    GARBAGE_FLAGS_FIELD_NUMBER: _ClassVar[int]
    bucket: int
    object_id: _plib_pb2.pUUID
    garbage_type: int
    garbage_flags: int
    def __init__(self, bucket: _Optional[int] = ..., object_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., garbage_type: _Optional[int] = ..., garbage_flags: _Optional[int] = ...) -> None: ...

class FileGarbageResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ReadGarbageRequest(_message.Message):
    __slots__ = ("bucket", "after", "limit")
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    AFTER_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    bucket: int
    after: _plib_pb2.pUUID
    limit: int
    def __init__(self, bucket: _Optional[int] = ..., after: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., limit: _Optional[int] = ...) -> None: ...

class GarbageResponse(_message.Message):
    __slots__ = ("for_collection",)
    FOR_COLLECTION_FIELD_NUMBER: _ClassVar[int]
    for_collection: _containers.RepeatedCompositeFieldContainer[GarbageItem]
    def __init__(self, for_collection: _Optional[_Iterable[_Union[GarbageItem, _Mapping]]] = ...) -> None: ...

class GarbageItem(_message.Message):
    __slots__ = ("bucket", "object_id", "garbage_type", "garbage_flags")
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    OBJECT_ID_FIELD_NUMBER: _ClassVar[int]
    GARBAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    GARBAGE_FLAGS_FIELD_NUMBER: _ClassVar[int]
    bucket: int
    object_id: _plib_pb2.pUUID
    garbage_type: int
    garbage_flags: int
    def __init__(self, bucket: _Optional[int] = ..., object_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., garbage_type: _Optional[int] = ..., garbage_flags: _Optional[int] = ...) -> None: ...

class DeleteGarbageRequest(_message.Message):
    __slots__ = ("bucket", "object_id")
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    OBJECT_ID_FIELD_NUMBER: _ClassVar[int]
    bucket: int
    object_id: _plib_pb2.pUUID
    def __init__(self, bucket: _Optional[int] = ..., object_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteGarbageResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
