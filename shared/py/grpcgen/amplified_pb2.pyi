import plib_pb2 as _plib_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class AmplifiedIntraMessage(_message.Message):
    __slots__ = ("intramessage", "recipients")
    INTRAMESSAGE_FIELD_NUMBER: _ClassVar[int]
    RECIPIENTS_FIELD_NUMBER: _ClassVar[int]
    intramessage: bytes
    recipients: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, intramessage: _Optional[bytes] = ..., recipients: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...
