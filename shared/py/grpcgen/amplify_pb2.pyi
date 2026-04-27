import plib_pb2 as _plib_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FanOutRequest(_message.Message):
    __slots__ = ("single", "many")
    SINGLE_FIELD_NUMBER: _ClassVar[int]
    MANY_FIELD_NUMBER: _ClassVar[int]
    single: FanOutMessage
    many: FanOutPerUserMessages
    def __init__(self, single: _Optional[_Union[FanOutMessage, _Mapping]] = ..., many: _Optional[_Union[FanOutPerUserMessages, _Mapping]] = ...) -> None: ...

class FanOutMessage(_message.Message):
    __slots__ = ("recipients", "payload")
    RECIPIENTS_FIELD_NUMBER: _ClassVar[int]
    PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    recipients: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    payload: bytes
    def __init__(self, recipients: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., payload: _Optional[bytes] = ...) -> None: ...

class FanOutPerUserMessages(_message.Message):
    __slots__ = ("messages",)
    MESSAGES_FIELD_NUMBER: _ClassVar[int]
    messages: _containers.RepeatedCompositeFieldContainer[PerUserMessage]
    def __init__(self, messages: _Optional[_Iterable[_Union[PerUserMessage, _Mapping]]] = ...) -> None: ...

class PerUserMessage(_message.Message):
    __slots__ = ("to", "message")
    TO_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    to: _plib_pb2.pUUID
    message: bytes
    def __init__(self, to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message: _Optional[bytes] = ...) -> None: ...

class FanOutResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
